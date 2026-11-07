import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Customer, Order } from './models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);

  /** Poveca se nakon create/update/delete, lista kupaca se tada ponovo ucita. */
  readonly changed = signal(0);
  private bump = () => this.changed.update((n) => n + 1);

  getAll() {
    return this.http.get<Customer[]>('/api/customers');
  }
  /** Backend trazi po fullName ILI email. */
  search(keyword: string) {
    return this.http.get<Customer[]>('/api/customers/search', {
      params: new HttpParams().set('keyword', keyword),
    });
  }
  getById(id: number) {
    return this.http.get<Customer>(`/api/customers/${id}`);
  }
  create(c: Customer) {
    return this.http.post<Customer>('/api/customers/create', c).pipe(tap(this.bump));
  }
  update(id: number, c: Customer) {
    return this.http.put<Customer>(`/api/customers/update/${id}`, c).pipe(tap(this.bump));
  }
  delete(id: number) {
    return this.http
      .delete<{ message: string }>(`/api/customers/delete/${id}`)
      .pipe(tap(this.bump));
  }
  getOrders(customerId: number) {
    return this.http.get<Order[]>(`/api/orders/customer/${customerId}`);
  }
}
