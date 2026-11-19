import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Refund, RefundRequest } from './models';

@Injectable({ providedIn: 'root' })
export class RefundService {
  private readonly http = inject(HttpClient);

  getByBranch(branchId: number) {
    return this.http.get<Refund[]>(`/api/refunds/branch/${branchId}`);
  }

  create(refund: RefundRequest) {
    return this.http.post<Refund>('/api/refunds/create', refund);
  }
}
