import { StoreStatus } from './admin.models';

export interface Customer {
  id?: number;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  createdAt?: string | number[] | null;
  updatedAt?: string | number[] | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  sellingPrice: number | null;
  mrp?: number | null;
  description?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  storeId?: number;
}

export interface Branch {
  id: number;
  storeId: number;
  name?: string;
}

export type PaymentType = 'CASH' | 'UPI' | 'CARD';

export interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  productId?: number;
  product?: {
    id: number;
    name: string;
    sku?: string;
    brand?: string;
    sellingPrice?: number;
    imageUrl?: string | null;
  };
}

export interface Order {
  id: number;
  totalAmount: number;
  createdAt: string | number[];
  status?: string | null;
  customerId?: number | null;
  customer?: {
    id?: number;
    fullName?: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  paymentType?: PaymentType | null;
  branchId?: number | null;
  branch?: { id: number; name?: string } | null;
  cashierId?: number | null;
  cashier?: { id: number; fullName?: string } | null;
  items: OrderItem[];
}

export interface ShiftPaymentSummary {
  type: PaymentType;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface ShiftProduct {
  id?: number;
  name: string;
}

export interface ShiftRefund {
  id: number;
  amount: number;
  createdAt?: string | number[] | null;
  orderId?: number | null;
  order?: { id: number } | null;
  reason?: string | null;
}

export interface ShiftReport {
  id: number;
  shiftStart: string | number[];
  shiftEnd: string | number[] | null;
  totalSales: number | null;
  totalRefunds: number | null;
  netSales: number | null;
  totalOrders: number | null;
  cashier?: { id?: number; fullName?: string } | null;
  paymentSummaries?: ShiftPaymentSummary[] | null;
  topSellingProducts?: ShiftProduct[] | null;
  recentOrders?: Order[] | null;
  refunds?: ShiftRefund[] | null;
}

export interface Refund {
  id: number;
  amount: number;
  reason?: string | null;
  orderId?: number | null;
  order?: { id: number } | null;
  branchId?: number | null;
  cashierId?: number | null;
  cashier?: { id?: number | null; fullName?: string | null; branchId?: number | null } | null;
  branch?: { id?: number | null } | null;
}

export interface RefundRequest {
  orderId: number;
  amount: number;
  reason: string;
}

export interface AuthResponse {
  jwt: string;
  message?: string;
  storeStatus?: StoreStatus | null;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    branchId?: number | null;
    storeId?: number | null;
    storeStatus?: StoreStatus | null;
  };
}

export interface SignupResponse extends AuthResponse {
  storeStatus: StoreStatus;
}

export interface SignupRequest {
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerPhone: string;
  storeBrand: string;
  storeDescription: string;
  storeType: string;
  contact: {
    address: string;
    phone: string;
    email: string;
  };
}
