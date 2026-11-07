import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { CustomerService } from '../../core/customer.service';
import { Customer } from '../../core/models';
import { toDate } from '../../core/loyalty';
import { CustomerForm } from '../../shared/customer-form';

@Component({
  selector: 'app-customer-list',
  imports: [DatePipe, CustomerForm, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.css',
})
export class CustomerList {
  private api = inject(CustomerService);
  private router = inject(Router);

  query = signal('');
  loading = signal(true);
  error = signal('');
  showForm = signal(false);
  /** true kad je neki kupac otvoren (aktivan child route) -> dvije kolone */
  hasDetail = signal(false);

  // query + signal iz servisa koji se poveca nakon create/update/delete
  private trigger = computed(() => ({ q: this.query().trim(), r: this.api.changed() }));

  customers = toSignal(
    toObservable(this.trigger).pipe(
      debounceTime(250),
      distinctUntilChanged((a, b) => a.q === b.q && a.r === b.r),
      tap(() => {
        this.loading.set(true);
        this.error.set('');
      }),
      switchMap(({ q }) =>
        (q ? this.api.search(q) : this.api.getAll()).pipe(
          catchError(() => {
            this.error.set(
              'Ne mogu učitati kupce. Provjerite da backend radi i da ste prijavljeni.',
            );
            return of([] as Customer[]);
          }),
        ),
      ),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: [] as Customer[] },
  );

  date = toDate;

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
