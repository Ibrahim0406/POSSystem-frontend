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
  paymentType?: PaymentType | null;
  branch?: { id: number; name?: string } | null;
  cashier?: { id: number; fullName?: string } | null;
  items: OrderItem[];
}

export interface AuthResponse {
  jwt: string;
  message: string;
  user: { id: number; fullName: string; email: string; role: string };
}
