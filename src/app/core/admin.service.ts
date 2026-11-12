import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AccountStatus,
  AdminAuditLog,
  AdminDashboardData,
  AdminStore,
  AdminUser,
  AdminUserRole,
  Branch,
  BranchCreateRequest,
  StoreCreateRequest,
  StoreStatus,
  SupportReport,
  SupportReportStatus,
  SystemSetting,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  getDashboard() {
    return this.http.get<AdminDashboardData>('/api/admin/dashboard');
  }

  getStores(query = '', status: StoreStatus | '' = '') {
    let params = new HttpParams();
    if (query.trim()) params = params.set('query', query.trim());
    if (status) params = params.set('status', status);
    return this.http.get<AdminStore[]>('/api/admin/stores', { params });
  }

  getStore(id: number) {
    return this.http.get<AdminStore>(`/api/admin/stores/${id}`);
  }

  createStore(store: StoreCreateRequest) {
    return this.http.post<void>('/api/store/create', store);
  }

  updateStoreStatus(id: number, status: StoreStatus) {
    return this.http.patch<AdminStore>(`/api/admin/stores/${id}/status`, { status });
  }

  getBranches(storeId: number) {
    return this.http.get<Branch[]>(`/api/branches/store/${storeId}`);
  }

  createBranch(branch: BranchCreateRequest) {
    return this.http.post<Branch>('/api/branches/create', branch);
  }

  getUsers(filters: { query?: string; role?: AdminUserRole | ''; status?: AccountStatus | '' }) {
    let params = new HttpParams();
    if (filters.query?.trim()) params = params.set('query', filters.query.trim());
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<AdminUser[]>('/api/admin/users', { params });
  }

  updateUserRole(id: number, role: AdminUserRole) {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}/role`, { role });
  }

  updateUserStatus(id: number, status: AccountStatus) {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}/status`, { status });
  }

  getSupportReports(status: SupportReportStatus | '' = '') {
    const params = status ? new HttpParams().set('status', status) : new HttpParams();
    return this.http.get<SupportReport[]>('/api/admin/support-reports', { params });
  }

  updateSupportReportStatus(id: number, status: SupportReportStatus) {
    return this.http.patch<SupportReport>(`/api/admin/support-reports/${id}/status`, { status });
  }

  getAuditLogs() {
    return this.http.get<AdminAuditLog[]>('/api/admin/audit-logs');
  }

  getSettings() {
    return this.http.get<SystemSetting[]>('/api/admin/settings');
  }

  updateSetting(key: string, value: string) {
    return this.http.put<SystemSetting>(`/api/admin/settings/${encodeURIComponent(key)}`, {
      value,
    });
  }
}
