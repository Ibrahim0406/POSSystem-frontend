import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  branchCashierGuard,
  branchOperationsGuard,
  branchOrdersGuard,
  landingGuard,
  shiftSummaryGuard,
  storeDashboardGuard,
  storeStatusGuard,
} from './core/auth.guard';
import { Login } from './pages/login/login';
import { CustomerList } from './pages/customer-list/customer-list';
import { CustomerDetail } from './pages/customer-detail/customer-detail';
import { ShiftSummary } from './pages/shift-summary/shift-summary';
import { OrderHistory } from './pages/order-history/order-history';
import { StoreStatusPage } from './pages/store-status/store-status';
import { AccountAccess } from './pages/account-access/account-access';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup').then((module) => module.Signup),
  },
  { path: 'store-status', component: StoreStatusPage, canActivate: [authGuard, storeStatusGuard] },
  {
    path: 'store-dashboard',
    loadComponent: () =>
      import('./pages/store-dashboard/store-dashboard').then((module) => module.StoreDashboard),
    canActivate: [authGuard, storeDashboardGuard],
  },
  { path: 'account-access', component: AccountAccess, canActivate: [authGuard] },
  {
    path: 'shift-summary',
    component: ShiftSummary,
    canActivate: [authGuard, shiftSummaryGuard],
  },
  {
    path: 'order-history',
    component: OrderHistory,
    canActivate: [authGuard, branchOrdersGuard],
  },
  {
    path: 'cashier',
    loadComponent: () =>
      import('./pages/cashier-dashboard/cashier-dashboard').then((m) => m.CashierDashboard),
    canActivate: [authGuard, branchCashierGuard],
  },
  {
    path: 'refund',
    loadComponent: () => import('./pages/refund/refund').then((m) => m.Refund),
    canActivate: [authGuard, branchCashierGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-console').then((m) => m.AdminConsole),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'customers',
    component: CustomerList,
    canActivate: [authGuard, branchOperationsGuard],
    // Detalji se prikazuju u <router-outlet> unutar CustomerList (desna strana iste stranice)
    children: [{ path: ':id', component: CustomerDetail }],
  },
  { path: '', pathMatch: 'full', canActivate: [authGuard, landingGuard], component: ShiftSummary },
  { path: '**', redirectTo: 'shift-summary' },
];
