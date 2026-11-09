import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ShiftReport } from './models';

@Injectable({ providedIn: 'root' })
export class ShiftReportService {
  private http = inject(HttpClient);

  getCurrent() {
    return this.http.get<ShiftReport>('/api/shift-reports/current');
  }

  getByCashier(cashierId: number) {
    return this.http.get<ShiftReport[]>(`/api/shift-reports/cashier/${cashierId}`);
  }
}
