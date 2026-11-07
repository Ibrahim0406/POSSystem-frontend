import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Login } from './pages/login/login';
import { CustomerList } from './pages/customer-list/customer-list';
import { CustomerDetail } from './pages/customer-detail/customer-detail';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: 'customers',
    component: CustomerList,
    canActivate: [authGuard],
    // Detalji se prikazuju u <router-outlet> unutar CustomerList (desna strana iste stranice)
    children: [{ path: ':id', component: CustomerDetail }],
  },
  { path: '', pathMatch: 'full', redirectTo: 'customers' },
  { path: '**', redirectTo: 'customers' },
];
