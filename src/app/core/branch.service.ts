import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Branch } from './models';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);

  getById(branchId: number) {
    return this.http.get<Branch>(`/api/branches/${branchId}`);
  }
}
