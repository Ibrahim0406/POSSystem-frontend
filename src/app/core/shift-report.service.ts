import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ShiftReport } from './models';

@Injectable({ providedIn: 'root' })
export class ShiftReportService {
  private http = inject(HttpClient);

  getCurrent() {
    return this.http.get<ShiftReport>('/api/shift-reports/current');
  }

  start() {
    return this.http.post<ShiftReport>('/api/shift-reports/start', null);
  }

  endCurrent() {
    return this.http.patch<ShiftReport>('/api/shift-reports/end', null);
  }

  getByCashier(cashierId: number) {
    return this.http.get<ShiftReport[]>(`/api/shift-reports/cashier/${cashierId}`);
  }

  getCurrentBranchActive() {
    return this.http.get<ShiftReport[]>('/api/shift-reports/branch/current/active');
  }
}
