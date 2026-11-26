import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, combineLatest, finalize, forkJoin, switchMap, tap } from 'rxjs';
import { CustomerService } from '../../core/customer.service';
import { Customer, Order } from '../../core/models';
import { SPEND_PER_POINT, calcLoyaltyPoints, toDate } from '../../core/loyalty';
import { CustomerForm } from '../../shared/customer-form';
import { HlmButton } from '@spartan-ng/helm/button/src';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error-message';

@Component({
  selector: 'app-customer-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, CustomerForm, HlmButton],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.css',
})
export class CustomerDetail {
  private api = inject(CustomerService);
  private router = inject(Router);
  private auth = inject(AuthService);

  /** Provided by /customers/:id through withComponentInputBinding. */
  id = input.required({ transform: numberAttribute });

  customer = signal<Customer | null>(null);
  orders = signal<Order[]>([]);
  loading = signal(true);
  error = signal('');
  editing = signal(false);
  expanded = signal<Set<number>>(new Set());

  spendPerPoint = SPEND_PER_POINT;
  date = toDate;

  sortedOrders = computed(() =>
    [...this.orders()].sort(
      (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
    ),
  );
  totalOrders = computed(() => this.orders().length);
  totalSpent = computed(() => this.orders().reduce((s, o) => s + (o.totalAmount ?? 0), 0));
  loyaltyPoints = computed(() => calcLoyaltyPoints(this.totalSpent()));
  avgOrder = computed(() => (this.totalOrders() ? this.totalSpent() / this.totalOrders() : 0));

  constructor() {
    // The component is reused across customer routes, so reload whenever :id changes.
    combineLatest([toObservable(this.id), toObservable(this.auth.scopeKey)])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.customer.set(null);
          this.orders.set([]);
          this.expanded.set(new Set());
          this.editing.set(false);
        }),
        switchMap(([id]) => {
          if (!this.auth.isLoggedIn() || !this.auth.canAccessCustomers()) {
            this.loading.set(false);
            return EMPTY;
          }
          return forkJoin({ customer: this.api.getById(id), orders: this.api.getOrders(id) }).pipe(
            tap((res) => {
              this.customer.set(res.customer);
              this.orders.set(res.orders);
            }),
            catchError((error: unknown) => {
              this.customer.set(null);
              this.orders.set([]);
              this.error.set(
                apiErrorMessage(error, 'Customer data could not be loaded. Please try again.'),
              );
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  toggle(orderId: number) {
    const s = new Set(this.expanded());
    s.has(orderId) ? s.delete(orderId) : s.add(orderId);
    this.expanded.set(s);
  }

  onSaved(c: Customer) {
    this.customer.set(c);
    this.editing.set(false);
  }

  remove() {
    const c = this.customer();
    if (!c?.id || !confirm(`Delete customer "${c.fullName}"?`)) return;
    const scope = this.auth.scopeKey();
    this.api.delete(c.id).subscribe({
      next: () => {
        if (scope === this.auth.scopeKey()) void this.router.navigate(['/customers']);
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.error.set(
          apiErrorMessage(error, 'Could not delete the customer. They may have linked orders.'),
        );
      },
    });
  }
}
