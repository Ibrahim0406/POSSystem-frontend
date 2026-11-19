import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/signup']);
  if (
    !auth.isAdmin() &&
    (auth.storeStatus() === 'PENDING' || auth.storeStatus() === 'BLOCKED')
  ) {
    return router.createUrlTree(['/store-status']);
  }
  return true;
};

export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin()) return router.createUrlTree(['/admin']);
  if (auth.storeStatus() === 'PENDING' || auth.storeStatus() === 'BLOCKED') {
    return router.createUrlTree(['/store-status']);
  }
  if (auth.canRefund()) return router.createUrlTree(['/cashier']);
  return router.createUrlTree(['/shift-summary']);
};

export const storeStatusGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.storeStatus() === 'PENDING' || auth.storeStatus() === 'BLOCKED') return true;
  return inject(Router).createUrlTree(['/']);
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
