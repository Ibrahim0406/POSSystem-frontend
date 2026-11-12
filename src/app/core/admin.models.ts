export type StoreStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type AdminUserRole =
  | 'ROLE_ADMIN'
  | 'ROLE_STORE_ADMIN'
  | 'ROLE_BRANCH_CASHIER'
  | 'ROLE_STORE_MANAGER'
  | 'ROLE_BRANCH_MANAGER';
export type SupportReportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface AdminDashboardData {
  stores: number;
  storesByStatus: Record<string, number>;
  users: number;
  usersByRole: Record<string, number>;
  openSupportReports: number;
}

export interface AdminStore {
  id: number;
  name: string;
  status: StoreStatus;
  createdAt: string;
  updatedAt?: string | null;
  contact?: { address?: string | null; phone?: string | null; email?: string | null } | null;
  storeAdminId?: number | null;
  storeAdminEmail?: string | null;
}

export interface StoreCreateRequest {
  brand: string;
  description: string;
  storeType: string;
  contact: {
    address: string;
    phone: string;
    email: string;
  };
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
  workingDays: string[];
  openTime: string;
  closeTime: string;
  storeId: number;
}

export type BranchCreateRequest = Omit<Branch, 'id'>;

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: AdminUserRole;
  status: AccountStatus;
  storeId?: number | null;
  branchId?: number | null;
  createdAt?: string | null;
  lastLogin?: string | null;
}

export interface SupportReport {
  id: number;
  title: string;
  description: string;
  status: SupportReportStatus;
  submittedById?: number | null;
  submittedByEmail?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AdminAuditLog {
  id: number;
  actorId: number;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  updatedAt?: string | null;
}
