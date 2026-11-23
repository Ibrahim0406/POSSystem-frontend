import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  const currentPath = state.url.split('?')[0];
  if (currentPath === '/store-status') {
    return true;
  }
  if (
    !auth.isAdmin() &&
    (auth.storeStatus() === 'PENDING' || auth.storeStatus() === 'BLOCKED') &&
    currentPath !== '/store-status'
  ) {
    return router.createUrlTree(['/store-status']);
  }
  let hasValidScope = true;
  if (typeof auth.hasValidScope === 'function') {
    hasValidScope = auth.hasValidScope();
  } else {
    const role = typeof auth.role === 'function' ? auth.role() : null;
    const user = typeof auth.user === 'function' ? auth.user() : null;
    hasValidScope =
      auth.isAdmin() ||
      role === 'STORE_ADMIN' ||
      (role === 'STORE_MANAGER' && user?.storeId != null) ||
      ((role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER') &&
        user?.branchId != null);
  }
  if (!hasValidScope && currentPath !== '/account-access') {
    return router.createUrlTree(['/account-access']);
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
  const router = inject(Router);
  return auth.hasBranchScope()
    ? true
    : router.createUrlTree([auth.homeRoute()]);
};

export const branchCashierGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.role() !== 'BRANCH_CASHIER' || !auth.hasBranchScope()) {
    return router.createUrlTree([auth.homeRoute()]);
  }
  return true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() ? true : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const storeDashboardGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const role = auth.role();
  return role === 'STORE_ADMIN' ||
    (role === 'STORE_MANAGER' && auth.hasStoreScope()) ||
    (role === 'BRANCH_MANAGER' && auth.hasBranchScope())
    ? true
    : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const branchOperationsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canAccessCustomers() ? true : inject(Router).createUrlTree([auth.homeRoute()]);
};

export const shiftSummaryGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.canViewShiftSummary()
    ? true
    : inject(Router).createUrlTree([auth.homeRoute()]);
};
