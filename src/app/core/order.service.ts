import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Order } from './models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  getByBranch(branchId: number) {
    return this.http.get<Order[]>(`/api/orders/branch/${branchId}`);
  }
}
