import { DOCUMENT, CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';
import { Order, OrderItem } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { toDate } from '../../core/loyalty';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-order-history',
  imports: [CurrencyPipe, DatePipe, HlmButton],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistory {
  private api = inject(OrderService);
  private auth = inject(AuthService);
  private document = inject(DOCUMENT);

  readonly orders = signal<Order[]>([]);
  readonly selectedOrder = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly dateFilter = signal<DateFilter>('all');
  readonly customStart = signal('');
  readonly customEnd = signal('');
  readonly date = toDate;

  readonly filteredOrders = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const orderQuery = query.replace(/^#/, '');
    const range = this.dateRange();

    return [...this.orders()]
      .filter((order) => {
        const customer = order.customer?.fullName ?? '';
        const customerId = order.customerId ? `customer #${order.customerId}` : '';
        const matchesSearch =
          !query ||
          String(order.id).includes(orderQuery) ||
          customer.toLocaleLowerCase().includes(query) ||
          customerId.includes(query);
        const timestamp = this.timestamp(order.createdAt);
        const matchesDate =
          timestamp !== null &&
          (!range.start || timestamp >= range.start) &&
          (!range.end || timestamp < range.end);

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => (this.timestamp(b.createdAt) ?? 0) - (this.timestamp(a.createdAt) ?? 0));
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const user = this.auth.user();
    if (!this.auth.canViewBranchOrders()) {
      this.error.set('Order history is only available to branch managers and cashiers.');
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

  openDetails(order: Order) {
    this.selectedOrder.set(order);
  }

  closeDetails() {
    this.selectedOrder.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeDetails();
  }

  paymentLabel(paymentType: Order['paymentType']) {
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

  unitPrice(item: OrderItem) {
    return item.quantity > 0 ? item.price / item.quantity : (item.product?.sellingPrice ?? 0);
  }

  downloadPdf() {
    this.document.defaultView?.print();
  }

  printInvoice() {
    this.document.defaultView?.print();
  }

  private dateRange(): { start: number | null; end: number | null } {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    switch (this.dateFilter()) {
      case 'all':
        break;
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week': {
        const day = (now.getDay() + 6) % 7;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'custom':
        start = this.parseDateInput(this.customStart());
        end = this.parseDateInput(this.customEnd());
        if (end) end.setDate(end.getDate() + 1);
        break;
    }

    return { start: start?.getTime() ?? null, end: end?.getTime() ?? null };
  }

  private parseDateInput(value: string): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private timestamp(value: Order['createdAt']): number | null {
    const parsed = toDate(value);
    const timestamp = parsed?.getTime();
    return timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : null;
  }
}
