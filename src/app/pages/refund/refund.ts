import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, forkJoin, skip } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';
import { Order, OrderItem, PaymentType } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { toDate } from '../../core/loyalty';
import { RefundService } from '../../core/refund.service';
import { apiErrorMessage } from '../../core/api-error-message';

@Component({
  selector: 'app-refund',
  imports: [CurrencyPipe, DatePipe, HlmButton],
  templateUrl: './refund.html',
  styleUrl: './refund.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Refund {
  private readonly api = inject(OrderService);
  private readonly refundsApi = inject(RefundService);
  private readonly auth = inject(AuthService);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly selectedOrder = signal<Order | null>(null);
  readonly returnItemIds = signal<number[]>([]);
  readonly returnQuantities = signal<Record<number, number>>({});
  readonly refundedOrderIds = signal<Set<number>>(new Set());
  readonly returnReason = signal('');
  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly date = toDate;

  readonly filteredOrders = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const orderQuery = query.replace(/^#/, '');

    return [...this.orders()]
      .filter((order) => {
        const customer = order.customer?.fullName ?? '';
        const matchesSearch =
          !query ||
          String(order.id).includes(orderQuery) ||
          customer.toLocaleLowerCase().includes(query);
        const hasReturnableItems = order.items.some(
          (item) => this.remainingQuantity(order, item) > 0,
        );
        return matchesSearch && hasReturnableItems && this.isOwnBranchOrder(order);
      })
      .sort((a, b) => this.timestamp(b.createdAt) - this.timestamp(a.createdAt));
  });

  readonly selectedItems = computed(() => {
    const order = this.selectedOrder();
    if (!order) return [];

    return order.items
      .filter((item) => this.returnItemIds().includes(item.id))
      .map((item) => ({
        item,
        quantity: this.returnQuantities()[item.id] ?? 0,
        amount: this.unitPrice(item) * (this.returnQuantities()[item.id] ?? 0),
      }))
      .filter((selection) => selection.quantity > 0);
  });

  readonly refundAmount = computed(() =>
    this.selectedItems().reduce((total, selection) => total + selection.amount, 0),
  );

  constructor() {
    this.load();
    toObservable(computed(() => this.auth.scopeKey()))
      .pipe(distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => {
        this.orders.set([]);
        this.refundedOrderIds.set(new Set());
        this.selectedOrder.set(null);
        this.returnItemIds.set([]);
        this.returnQuantities.set({});
        this.returnReason.set('');
        this.confirming.set(false);
        this.saving.set(false);
        this.successMessage.set('');
        this.query.set('');
        this.error.set('');
        if (this.auth.isLoggedIn() && this.auth.canRefund()) this.load();
        else this.loading.set(false);
      });
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.orders.set([]);
    this.selectedOrder.set(null);
    this.refundedOrderIds.set(new Set());
    const user = this.auth.user();
    const scope = this.auth.scopeKey();
    if (!this.auth.canRefund()) {
      this.error.set('Refunds are only available to cashiers assigned to a branch.');
      this.loading.set(false);
      return;
    }
    if (user?.branchId == null) {
      this.error.set('Unable to identify your branch. Check your account and sign in again.');
      this.loading.set(false);
      return;
    }

    forkJoin({
      orders: this.api.getByBranch(user.branchId),
      refunds: this.refundsApi.getByBranch(user.branchId),
    }).subscribe({
      next: ({ orders, refunds }) => {
        if (scope !== this.auth.scopeKey()) return;
        const ownOrders = orders.filter(
          (order) => this.isOwnBranchOrder(order) && this.isOwnCashierOrder(order),
        );
        const ownRefunds = refunds.filter(
          (refund) =>
            (refund.branch?.id ?? refund.branchId) === user.branchId &&
            (refund.cashier?.id ?? refund.cashierId) === user.id,
        );
        this.orders.set(ownOrders);
        this.refundedOrderIds.set(
          new Set(
            ownRefunds
              .map((refund) => refund.orderId ?? refund.order?.id)
              .filter((orderId): orderId is number => orderId != null),
          ),
        );
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.orders.set([]);
        this.refundedOrderIds.set(new Set());
        this.error.set(
          apiErrorMessage(
            error,
            'Unable to load orders and refunds for this branch. Check the backend and try again.',
          ),
        );
        this.loading.set(false);
      },
    });
  }

  openOrder(order: Order) {
    if (
      !this.isOwnBranchOrder(order) ||
      !this.isOwnCashierOrder(order) ||
      this.refundedOrderIds().has(order.id)
    ) {
      return;
    }
    this.selectedOrder.set(order);
    this.returnItemIds.set([]);
    this.returnQuantities.set({});
    this.returnReason.set('');
    this.confirming.set(false);
    this.successMessage.set('');
  }

  backToSearch() {
    this.selectedOrder.set(null);
    this.confirming.set(false);
  }

  toggleItem(item: OrderItem) {
    const selected = this.returnItemIds();
    if (selected.includes(item.id)) {
      this.returnItemIds.set(selected.filter((id) => id !== item.id));
      return;
    }

    const order = this.selectedOrder();
    const remaining = order ? this.remainingQuantity(order, item) : 0;
    if (remaining <= 0) return;
    this.returnItemIds.set([...selected, item.id]);
    this.returnQuantities.update((quantities) => ({
      ...quantities,
      [item.id]: Math.min(1, remaining),
    }));
  }

  setReturnQuantity(item: OrderItem, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    const order = this.selectedOrder();
    if (!order) return;
    const quantity = Number.isFinite(value)
      ? Math.max(0, Math.min(Math.floor(value), this.remainingQuantity(order, item)))
      : 0;

    this.returnQuantities.update((quantities) => ({ ...quantities, [item.id]: quantity }));
  }

  showConfirmation() {
    if (!this.selectedItems().length || !this.returnReason().trim()) return;
    this.confirming.set(true);
  }

  cancelConfirmation() {
    this.confirming.set(false);
  }

  confirmRefund() {
    const order = this.selectedOrder();
    if (!order || !this.selectedItems().length || !this.returnReason().trim()) return;
    if (this.refundedOrderIds().has(order.id) || this.saving()) return;

    this.error.set('');
    this.saving.set(true);
    const scope = this.auth.scopeKey();
    this.refundsApi
      .create({
        orderId: order.id,
        amount: this.refundAmount(),
        reason: this.returnReason().trim(),
      })
      .subscribe({
        next: () => {
          if (scope !== this.auth.scopeKey()) return;
          this.saving.set(false);
          this.refundedOrderIds.update((ids) => new Set(ids).add(order.id));
          this.successMessage.set(`Refund recorded for order #${order.id}.`);
          this.selectedOrder.set(null);
          this.confirming.set(false);
          this.load();
        },
        error: (error: unknown) => {
          if (scope !== this.auth.scopeKey()) return;
          this.saving.set(false);
          this.error.set(this.refundErrorMessage(error));
          this.confirming.set(false);
          if (error instanceof HttpErrorResponse && [403, 404].includes(error.status)) {
            this.orders.set([]);
            this.refundedOrderIds.set(new Set());
            this.selectedOrder.set(null);
          }
        },
      });
  }

  unitPrice(item: OrderItem) {
    return item.quantity > 0 ? item.price / item.quantity : (item.product?.sellingPrice ?? 0);
  }

  returnQuantity(item: OrderItem) {
    return this.returnQuantities()[item.id] ?? 0;
  }

  remainingQuantity(order: Order, item: OrderItem) {
    return this.refundedOrderIds().has(order.id) ? 0 : item.quantity;
  }

  customerName(order: Order) {
    return (
      order.customer?.fullName ||
      (order.customerId ? `Customer #${order.customerId}` : 'Walk-in customer')
    );
  }

  paymentLabel(paymentType: PaymentType | null | undefined) {
    switch (paymentType) {
      case 'CASH':
        return 'Cash';
      case 'CARD':
        return 'Card';
      case 'UPI':
        return 'UPI';
      default:
        return '—';
    }
  }

  private timestamp(value: Order['createdAt']) {
    return toDate(value)?.getTime() ?? 0;
  }

  private isOwnBranchOrder(order: Order) {
    const branchId = this.auth.user()?.branchId;
    return (order.branch?.id ?? order.branchId) === branchId;
  }

  private isOwnCashierOrder(order: Order) {
    const cashierId = this.auth.user()?.id;
    return (order.cashier?.id ?? order.cashierId) === cashierId;
  }

  private refundErrorMessage(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400 || error.status === 409) {
        const message =
          typeof error.error === 'string'
            ? error.error
            : error.error && typeof error.error.message === 'string'
              ? error.error.message
              : null;
        return message
          ? `Refund rejected: ${message}`
          : error.status === 409
            ? 'Refund rejected: this order may already have a refund or is no longer eligible.'
            : 'Refund rejected: the order or refund amount does not meet the return rules.';
      }
      if (error.status === 403) {
        return 'Refund rejected: you are not allowed to refund this order.';
      }
    }
    return apiErrorMessage(error, 'The refund could not be recorded. Please try again.');
  }
}
