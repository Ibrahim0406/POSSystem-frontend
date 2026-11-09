export interface Customer {
  id?: number;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  createdAt?: string | number[] | null;
  updatedAt?: string | number[] | null;
}

export type PaymentType = 'CASH' | 'UPI' | 'CARD';

export interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  productId?: number;
  product?: { id: number; name: string; sku?: string; brand?: string; sellingPrice?: number };
}

export interface Order {
  id: number;
  totalAmount: number;
  createdAt: string | number[];
  customerId?: number | null;
  customer?: { id?: number; fullName?: string } | null;
  paymentType?: PaymentType | null;
  branch?: { id: number; name?: string } | null;
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

export interface AuthResponse {
  jwt: string;
  message: string;
  user: { id: number; fullName: string; email: string; role: string };
}
