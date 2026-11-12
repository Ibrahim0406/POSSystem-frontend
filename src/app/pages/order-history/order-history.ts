import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { toDate } from '../../core/loyalty';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

@Component({
  selector: 'app-order-history',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistory {
  private api = inject(OrderService);
  private auth = inject(AuthService);

  readonly orders = signal<Order[]>([]);
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
    const cashierId = this.auth.user()?.id;
    if (!cashierId) {
      this.error.set('Unable to identify the signed-in cashier. Sign in again and retry.');
      this.loading.set(false);
      return;
    }

    this.api.getByCashier(cashierId).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Unable to load this cashier’s orders. Check that the backend is available and try again.',
        );
        this.loading.set(false);
      },
    });
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
