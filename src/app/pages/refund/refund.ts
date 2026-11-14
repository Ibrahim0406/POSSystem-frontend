import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';
import { Order, OrderItem, PaymentType } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { toDate } from '../../core/loyalty';

@Component({
  selector: 'app-refund',
  imports: [CurrencyPipe, DatePipe, HlmButton],
  templateUrl: './refund.html',
  styleUrl: './refund.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Refund {
  private readonly api = inject(OrderService);
  private readonly auth = inject(AuthService);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly selectedOrder = signal<Order | null>(null);
  readonly returnItemIds = signal<number[]>([]);
  readonly returnQuantities = signal<Record<number, number>>({});
  readonly returnedQuantities = signal<Record<string, number>>({});
  readonly returnReason = signal('');
  readonly refundMethod = signal<PaymentType>('CASH');
  readonly confirming = signal(false);
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
        const orderBranchId = order.branch?.id;
        const matchesBranch =
          orderBranchId == null || orderBranchId === this.auth.user()?.branchId;
        return matchesSearch && hasReturnableItems && matchesBranch;
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
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const user = this.auth.user();
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

    this.api.getByBranch(user.branchId).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Unable to load orders for this branch. Check that the backend is available and try again.',
        );
        this.loading.set(false);
      },
    });
  }

  openOrder(order: Order) {
    this.selectedOrder.set(order);
    this.returnItemIds.set([]);
    this.returnQuantities.set({});
    this.returnReason.set('');
    this.refundMethod.set(order.paymentType ?? 'CASH');
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

    this.returnedQuantities.update((returned) => {
      const updated = { ...returned };
      for (const selection of this.selectedItems()) {
        const key = this.returnKey(order, selection.item);
        updated[key] = (updated[key] ?? 0) + selection.quantity;
      }
      return updated;
    });
    this.successMessage.set(`Refund recorded for order #${order.id}.`);
    this.selectedOrder.set(null);
    this.confirming.set(false);
  }

  unitPrice(item: OrderItem) {
    return item.quantity > 0 ? item.price / item.quantity : (item.product?.sellingPrice ?? 0);
  }

  returnQuantity(item: OrderItem) {
    return this.returnQuantities()[item.id] ?? 0;
  }

  remainingQuantity(order: Order, item: OrderItem) {
    return Math.max(
      0,
      item.quantity - (this.returnedQuantities()[this.returnKey(order, item)] ?? 0),
    );
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

  private returnKey(order: Order, item: OrderItem) {
    return `${order.id}:${item.id}`;
  }

  private timestamp(value: Order['createdAt']) {
    return toDate(value)?.getTime() ?? 0;
  }
}
