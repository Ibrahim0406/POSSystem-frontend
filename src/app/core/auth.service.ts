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

  private _token = signal<string | null>(this.getValidStoredToken());
  private _user = signal<AuthResponse['user'] | null>(this.getStoredUser());
  private _storeStatus = signal<StoreStatus | null>(
    (this.getItem(STORE_STATUS_KEY) as StoreStatus | null) ?? this._user()?.storeStatus ?? null,
  );

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly storeStatus = this._storeStatus.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly role = computed(
    () =>
      this._user()
        ?.role.trim()
        .toUpperCase()
        .replace(/^ROLE_/, '') ?? null,
  );
  readonly hasStoreScope = computed(() => {
    const user = this._user();
    return (
      (this.role() === 'STORE_ADMIN' || this.role() === 'STORE_MANAGER') && user?.storeId != null
    );
  });
  readonly hasBranchScope = computed(() => {
    const user = this._user();
    return (
      (this.role() === 'BRANCH_MANAGER' || this.role() === 'BRANCH_CASHIER') &&
      user?.branchId != null
    );
  });
  readonly hasValidScope = computed(() => {
    const role = this.role();
    if (role === 'ADMIN') return true;
    if (role === 'STORE_ADMIN') return true;
    return this.hasStoreScope() || this.hasBranchScope();
  });
  readonly scopeKey = computed(() => {
    const user = this._user();
    return user
      ? `${user.id}:${user.role}:${user.storeId ?? ''}:${user.branchId ?? ''}:${this._storeStatus() ?? ''}`
      : 'anonymous';
  });
  readonly canAccessCustomers = computed(() => {
    return (
      this.role() === 'STORE_ADMIN' ||
      (this.role() === 'STORE_MANAGER' && this.hasStoreScope()) ||
      (this.role() === 'BRANCH_MANAGER' && this.hasBranchScope())
    );
  });
  readonly canViewShiftSummary = computed(() => {
    const role = this.role();
    return (
      (role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER') && this._user()?.branchId != null
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
    const role = this.role();
    if (!this.isLoggedIn()) return '/login';
    if (role === 'STORE_ADMIN') return '/store-dashboard';
    if (role === 'STORE_MANAGER') {
      return this.hasStoreScope() ? '/store-dashboard' : '/account-access';
    }
    if (role === 'BRANCH_MANAGER') {
      return this.hasBranchScope() ? '/store-dashboard' : '/account-access';
    }
    if (role === 'BRANCH_CASHIER') {
      return this.hasBranchScope() ? '/cashier' : '/account-access';
    }
    return '/account-access';
  });

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/auth/signin', { email, password })
      .pipe(tap((res) => this.saveAuth(res)));
  }

  signup(request: SignupRequest) {
    return this.http
      .post<SignupResponse>('/auth/signup', request)
      .pipe(tap((res) => this.saveAuth(res)));
  }

  logout() {
    this.clearAuthAndTenantState();
    this._token.set(null);
    this._user.set(null);
    this._storeStatus.set(null);
    void this.router.navigate(['/login']).catch(() => false);
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

  private getStoredUser(): AuthResponse['user'] | null {
    try {
      const value = this.getItem(USER_KEY);
      return value ? (JSON.parse(value) as AuthResponse['user']) : null;
    } catch {
      this.removeItem(USER_KEY);
      return null;
    }
  }

  private getValidStoredToken(): string | null {
    const token = this.getItem(TOKEN_KEY);
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return token;

    try {
      const payload = JSON.parse(
        decodeURIComponent(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
            .split('')
            .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
            .join(''),
        ),
      ) as { exp?: number };
      if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
        this.removeItem(TOKEN_KEY);
        this.removeItem(USER_KEY);
        this.removeItem(STORE_STATUS_KEY);
        return null;
      }
    } catch {
      return token;
    }
    return token;
  }

  private clearAuthAndTenantState(): void {
    if (!this.isBrowser) return;
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_KEY);
    this.removeItem(STORE_STATUS_KEY);
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith('cms_')) localStorage.removeItem(key);
    }
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('cms_')) sessionStorage.removeItem(key);
    }
  }
}
