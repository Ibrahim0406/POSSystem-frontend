import { StoreStatus } from './admin.models';

export type StoreUserRole =
  'ROLE_STORE_ADMIN' | 'ROLE_STORE_MANAGER' | 'ROLE_BRANCH_MANAGER' | 'ROLE_BRANCH_CASHIER';

export interface StoreContact {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface StoreRecord {
  id: number;
  brand: string;
  description?: string | null;
  storeType?: string | null;
  status: StoreStatus;
  contact?: StoreContact | null;
}

export interface StoreBranch {
  id: number;
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
  workingDays: string[];
  openTime: string | number[];
  closeTime: string | number[];
  storeId: number;
}

export interface BranchRequest {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
  workingDays: string[];
  openTime: string;
  closeTime: string;
}

export interface StoreCategory {
  id?: number | null;
  name: string;
  storeId: number;
}

export interface StoreProduct {
  id: number;
  sku: string;
  name: string;
  mrp: number | null;
  description?: string | null;
  sellingPrice: number | null;
  brand?: string | null;
  imageUrl?: string | null;
  category?: { name?: string | null } | null;
  categoryId?: number | null;
  storeId: number;
}

export interface InventoryRecord {
  id: number;
  branchId: number;
  productId: number;
  quantity: number;
  lastUpdated?: string | number[] | null;
  branch?: StoreBranch | null;
  product?: StoreProduct | null;
}

export interface StoreEmployee {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: StoreUserRole;
  status?: 'ACTIVE' | 'DISABLED';
  storeId?: number | null;
  branchId?: number | null;
  createdAt?: string | null;
}

export interface StoreEmployeeRequest {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role: StoreUserRole;
  branchId?: number;
}

export interface StoreOrder {
  id: number;
  totalAmount: number;
  createdAt: string | number[];
  branchId: number;
  customerId?: number | null;
  branch?: StoreBranch | null;
  cashier?: StoreEmployee | null;
  customer?: { id?: number; fullName?: string; email?: string | null } | null;
  paymentType?: 'CASH' | 'UPI' | 'CARD' | null;
  items: Array<{
    id?: number;
    quantity: number;
    price: number;
    product?: { name?: string; sku?: string } | null;
  }>;
}

export interface StoreRefund {
  id: number;
  reason?: string | null;
  amount: number;
  orderId?: number | null;
  cashierName?: string | null;
  branchId?: number | null;
  branch?: StoreBranch | null;
  createdAt?: string | number[] | null;
  paymentType?: 'CASH' | 'UPI' | 'CARD' | null;
}

export interface StoreShiftReport {
  id: number;
  shiftStart: string | number[];
  shiftEnd?: string | number[] | null;
  totalSales?: number | null;
  totalRefunds?: number | null;
  netSales?: number | null;
  totalOrders?: number | null;
  cashier?: StoreEmployee | null;
  branchId?: number | null;
  branch?: StoreBranch | null;
}
