import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, distinctUntilChanged, finalize, switchMap, tap, timer } from 'rxjs';
import { CustomerService } from '../../core/customer.service';
import { Customer } from '../../core/models';
import { toDate } from '../../core/loyalty';
import { CustomerForm } from '../../shared/customer-form';
import { HlmButton } from '@spartan-ng/helm/button/src';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error-message';

@Component({
  selector: 'app-customer-list',
  imports: [DatePipe, CustomerForm, RouterLink, RouterLinkActive, RouterOutlet, HlmButton],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.css',
})
export class CustomerList {
  private api = inject(CustomerService);
  private router = inject(Router);
  private auth = inject(AuthService);

  query = signal('');
  loading = signal(true);
  error = signal('');
  showForm = signal(false);
  canCreateCustomer = computed(() => {
    return this.auth.canAccessCustomers();
  });
  /** True when a customer is open in the child route, showing the two-column layout. */
  hasDetail = signal(false);

  // Reload customers when the query changes or the service reports a customer mutation.
  private trigger = computed(() => ({
    q: this.query().trim(),
    r: this.api.changed(),
    scope: this.auth.scopeKey(),
  }));
  customers = signal<Customer[]>([]);

  constructor() {
    let activeScope = this.auth.scopeKey();
    toObservable(this.trigger)
      .pipe(
        distinctUntilChanged((a, b) => a.q === b.q && a.r === b.r && a.scope === b.scope),
        switchMap(({ q, scope }) => {
          if (scope !== activeScope) {
            activeScope = scope;
            this.query.set('');
            this.showForm.set(false);
            if (this.hasDetail()) {
              this.hasDetail.set(false);
              void this.router.navigate([this.auth.homeRoute()]);
            }
          }
          this.customers.set([]);
          this.loading.set(true);
          this.error.set('');
          if (!this.auth.isLoggedIn() || !this.canCreateCustomer()) {
            this.loading.set(false);
            return EMPTY;
          }
          return timer(250).pipe(
            switchMap(() => (q ? this.api.search(q) : this.api.getAll())),
            tap((customers) => this.customers.set(customers)),
            catchError((error: unknown) => {
              this.customers.set([]);
              this.error.set(
                apiErrorMessage(
                  error,
                  'Unable to load customers. Check the backend and try again.',
                ),
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

  date = toDate;

  openCreateForm() {
    if (this.canCreateCustomer()) this.showForm.set(true);
  }

  initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  onSaved(c: Customer) {
    this.showForm.set(false);
    this.router.navigate(['/customers', c.id]);
  }
}
