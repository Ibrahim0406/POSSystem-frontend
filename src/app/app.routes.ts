import { Routes } from '@angular/router';
import { authGuard, branchOrdersGuard } from './core/auth.guard';
import { Login } from './pages/login/login';
import { CustomerList } from './pages/customer-list/customer-list';
import { CustomerDetail } from './pages/customer-detail/customer-detail';
import { ShiftSummary } from './pages/shift-summary/shift-summary';
import { OrderHistory } from './pages/order-history/order-history';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'shift-summary', component: ShiftSummary, canActivate: [authGuard] },
  {
    path: 'order-history',
    component: OrderHistory,
    canActivate: [authGuard, branchOrdersGuard],
  },
  {
    path: 'customers',
    component: CustomerList,
    canActivate: [authGuard],
    // Detalji se prikazuju u <router-outlet> unutar CustomerList (desna strana iste stranice)
    children: [{ path: ':id', component: CustomerDetail }],
  },
  { path: '', pathMatch: 'full', redirectTo: 'shift-summary' },
  { path: '**', redirectTo: 'shift-summary' },
];
