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
  return router.createUrlTree([auth.homeRoute()]);
};

export const storeStatusGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.storeStatus() === 'PENDING' || auth.storeStatus() === 'BLOCKED') return true;
  return inject(Router).createUrlTree([auth.homeRoute()]);
};

export const branchOrdersGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canViewBranchOrders()
    ? true
    : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const branchCashierGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canRefund() ? true : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const branchOperationsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canAccessCustomers()
    ? true
    : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const shiftSummaryGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canViewShiftSummary()
    ? true
    : inject(Router).createUrlTree([auth.homeRoute()]);
};
