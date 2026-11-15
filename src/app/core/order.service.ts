import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Order, PaymentType } from './models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  getByBranch(branchId: number) {
    return this.http.get<Order[]>(`/api/orders/branch/${branchId}`);
  }

  createOrder(order: {
    customer?: { id: number } | null;
    paymentType: PaymentType;
    items: { productId: number; quantity: number; price: number }[];
  }) {
    return this.http.post<Order>('/api/orders/create', order);
  }
}
