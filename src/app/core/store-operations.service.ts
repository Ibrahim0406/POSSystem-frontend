import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BranchRequest,
  InventoryRecord,
  StoreBranch,
  StoreCategory,
  StoreEmployee,
  StoreEmployeeRequest,
  StoreOrder,
  StoreProduct,
  StoreRecord,
  StoreRefund,
  StoreShiftReport,
  StoreUserRole,
} from './store.models';

@Injectable({ providedIn: 'root' })
export class StoreOperationsService {
  private readonly http = inject(HttpClient);

  getStoreForAdmin() {
    return this.http.get<StoreRecord>('/api/store/admin');
  }

  getStoreForEmployee() {
    return this.http.get<StoreRecord>('/api/store/employee');
  }

  getBranches(storeId: number) {
    return this.http.get<StoreBranch[]>(`/api/branches/store/${storeId}`);
  }

  getBranch(branchId: number) {
    return this.http.get<StoreBranch>(`/api/branches/${branchId}`);
  }

  createBranch(branch: BranchRequest) {
    return this.http.post<StoreBranch>('/api/branches/create', branch);
  }

  updateBranch(id: number, branch: BranchRequest) {
    return this.http.put<StoreBranch>(`/api/branches/update/${id}`, branch);
  }

  deleteBranch(id: number) {
    return this.http.delete<{ message: string }>(`/api/branches/delete/${id}`);
  }

  getProducts(storeId: number) {
    return this.http.get<StoreProduct[]>(`/api/products/${storeId}`);
  }

  createProduct(product: Omit<StoreProduct, 'id' | 'category'>) {
    return this.http.post<StoreProduct>('/api/products/create', product);
  }

  updateProduct(id: number, product: Omit<StoreProduct, 'id' | 'category'>) {
    return this.http.put<StoreProduct>(`/api/products/update/${id}`, product);
  }

  deleteProduct(id: number) {
    return this.http.delete<{ message: string }>(`/api/products/delete/${id}`);
  }

  getCategories(storeId: number) {
    return this.http.get<StoreCategory[]>(`/api/categories/store/${storeId}`);
  }

  createCategory(category: Omit<StoreCategory, 'id'>) {
    return this.http.post<StoreCategory>('/api/categories/create', category);
  }

  updateCategory(id: number, category: Pick<StoreCategory, 'name'>) {
    return this.http.put<StoreCategory>(`/api/categories/update/${id}`, category);
  }

  deleteCategory(id: number) {
    return this.http.delete<{ message: string }>(`/api/categories/delete/${id}`);
  }

  getInventory(branchId: number) {
    return this.http.get<InventoryRecord[]>(`/api/inventory/branch/${branchId}`);
  }

  createInventory(entry: Pick<InventoryRecord, 'branchId' | 'productId' | 'quantity'>) {
    return this.http.post<InventoryRecord>('/api/inventory/create', entry);
  }

  updateInventory(id: number, entry: Pick<InventoryRecord, 'quantity'>) {
    const params = new HttpParams().set('id', id);
    return this.http.put<InventoryRecord>('/api/inventory/update', entry, { params });
  }

  deleteInventory(id: number) {
    const params = new HttpParams().set('id', id);
    return this.http.delete<{ message: string }>('/api/inventory/delete', { params });
  }

  getStoreEmployees(storeId: number, role?: StoreUserRole) {
    const params = role ? new HttpParams().set('userRole', role) : undefined;
    return this.http.get<StoreEmployee[]>(`/api/employees/store/${storeId}`, { params });
  }

  getBranchEmployees(branchId: number, role?: StoreUserRole) {
    const params = role ? new HttpParams().set('userRole', role) : undefined;
    return this.http.get<StoreEmployee[]>(`/api/employees/branch/${branchId}`, { params });
  }

  createStoreEmployee(storeId: number, employee: StoreEmployeeRequest) {
    return this.http.post<StoreEmployee>(`/api/employees/store/${storeId}`, employee);
  }

  createBranchEmployee(branchId: number, employee: StoreEmployeeRequest) {
    return this.http.post<StoreEmployee>(`/api/employees/branch/${branchId}`, employee);
  }

  updateEmployee(id: number, employee: StoreEmployeeRequest) {
    return this.http.put<StoreEmployee>(`/api/employees/update/${id}`, employee);
  }

  deleteEmployee(id: number) {
    return this.http.delete<{ message: string }>(`/api/employees/delete/${id}`);
  }

  getOrders(branchId: number) {
    return this.http.get<StoreOrder[]>(`/api/orders/branch/${branchId}`);
  }

  getRefunds(branchId: number) {
    return this.http.get<StoreRefund[]>(`/api/refunds/branch/${branchId}`);
  }

  getShiftReports(branchId: number) {
    return this.http.get<StoreShiftReport[]>(`/api/shift-reports/branch/${branchId}`);
  }
}
