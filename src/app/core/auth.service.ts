import { Injectable, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthResponse, SignupRequest, SignupResponse } from './models';
import { StoreStatus } from './admin.models';

const TOKEN_KEY = 'cms_jwt';
const USER_KEY = 'cms_user';
const STORE_STATUS_KEY = 'cms_store_status';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _token = signal<string | null>(this.getItem(TOKEN_KEY));
  private _user = signal<AuthResponse['user'] | null>(JSON.parse(this.getItem(USER_KEY) ?? 'null'));
  private _storeStatus = signal<StoreStatus | null>(
    (this.getItem(STORE_STATUS_KEY) as StoreStatus | null) ??
      this._user()?.storeStatus ??
      null,
  );

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly storeStatus = this._storeStatus.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly role = computed(
    () => this._user()?.role.trim().toUpperCase().replace(/^ROLE_/, '') ?? null,
  );
  readonly scopeKey = computed(() => {
    const user = this._user();
    return user
      ? `${user.id}:${user.role}:${user.storeId ?? ''}:${user.branchId ?? ''}:${this._storeStatus() ?? ''}`
      : 'anonymous';
  });
  readonly canAccessCustomers = computed(() => {
    const user = this._user();
    const role = this.role();
    return (
      ((role === 'STORE_ADMIN' || role === 'STORE_MANAGER') && user?.storeId != null) ||
      ((role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER') && user?.branchId != null)
    );
  });
  readonly canViewShiftSummary = computed(() => {
    const role = this.role();
    return (
      (role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER') &&
      this._user()?.branchId != null
    );
  });
  readonly canViewBranchOrders = computed(() => {
    return this.canViewShiftSummary();
  });
  readonly canRefund = computed(() => {
    const user = this._user();
    return this.role() === 'BRANCH_CASHIER' && user?.branchId != null;
  });
  readonly isAdmin = computed(() => {
    return this.role() === 'ADMIN';
  });
  readonly homeRoute = computed(() => {
    if (this.isAdmin()) return '/admin';
    if (this._storeStatus() === 'PENDING' || this._storeStatus() === 'BLOCKED') {
      return '/store-status';
    }
    if (this.canRefund()) return '/cashier';
    if (this.canViewShiftSummary()) return '/shift-summary';
    if (this.canAccessCustomers()) return '/customers';
    return '/account-access';
  });

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/auth/signin', { email, password }).pipe(
      tap((res) => this.saveAuth(res)),
    );
  }

  signup(request: SignupRequest) {
    return this.http.post<SignupResponse>('/auth/signup', request).pipe(
      tap((res) => this.saveAuth(res)),
    );
  }

  logout() {
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_KEY);
    this.removeItem(STORE_STATUS_KEY);
    this._token.set(null);
    this._user.set(null);
    this._storeStatus.set(null);
    this.router.navigate(['/login']);
  }

  private saveAuth(response: AuthResponse): void {
    const storeStatus = response.storeStatus ?? response.user.storeStatus ?? null;
    this.setItem(TOKEN_KEY, response.jwt);
    this.setItem(USER_KEY, JSON.stringify(response.user));
    if (storeStatus) this.setItem(STORE_STATUS_KEY, storeStatus);
    else this.removeItem(STORE_STATUS_KEY);
    this._token.set(response.jwt);
    this._user.set(response.user);
    this._storeStatus.set(storeStatus);
  }

  // SSR-safe localStorage helpers
  private getItem(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }

  private setItem(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
    }
  }

  private removeItem(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    }
  }
}
