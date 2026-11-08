import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { CustomerService } from '../../core/customer.service';
import { Customer, Order } from '../../core/models';
import { SPEND_PER_POINT, calcLoyaltyPoints, toDate } from '../../core/loyalty';
import { CustomerForm } from '../../shared/customer-form';
import { HlmButton } from '@spartan-ng/helm/button/src';

@Component({
  selector: 'app-customer-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, CustomerForm, HlmButton],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.css',
})
export class CustomerDetail {
  private api = inject(CustomerService);
  private router = inject(Router);

  /** Dolazi iz rute /customers/:id (withComponentInputBinding) */
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
    // Komponenta se ponovo koristi kad kliknes drugog kupca, pa pratimo promjenu :id
    toObservable(this.id)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.expanded.set(new Set());
          this.editing.set(false);
        }),
        switchMap((id) =>
          forkJoin({ customer: this.api.getById(id), orders: this.api.getOrders(id) }).pipe(
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        if (res) {
          this.customer.set(res.customer);
          this.orders.set(res.orders);
        } else {
          this.customer.set(null);
          this.orders.set([]);
          this.error.set('Kupac nije pronađen ili se podaci ne mogu učitati.');
        }
        this.loading.set(false);
      });
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
    if (!c?.id || !confirm(`Obrisati kupca "${c.fullName}"?`)) return;
    this.api.delete(c.id).subscribe({
      next: () => this.router.navigate(['/customers']),
      error: () => this.error.set('Brisanje nije uspjelo (kupac možda ima povezane narudžbe).'),
    });
  }
}
