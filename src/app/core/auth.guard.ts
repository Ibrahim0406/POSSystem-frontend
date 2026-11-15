import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['login']);
};

export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return inject(Router).createUrlTree(['/admin']);
  if (auth.canRefund()) return inject(Router).createUrlTree(['/cashier']);
  return inject(Router).createUrlTree(['/shift-summary']);
};

export const branchOrdersGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canViewBranchOrders() ? true : inject(Router).createUrlTree(['/shift-summary']);
};

export const branchCashierGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canRefund() ? true : inject(Router).createUrlTree(['/shift-summary']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree(['/shift-summary']);
};

export const branchOperationsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? inject(Router).createUrlTree(['/admin']) : true;
};
