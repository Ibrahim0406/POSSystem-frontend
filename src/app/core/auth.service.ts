import { Injectable, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthResponse } from './models';

const TOKEN_KEY = 'cms_jwt';
const USER_KEY = 'cms_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _token = signal<string | null>(this.getItem(TOKEN_KEY));
  private _user = signal<AuthResponse['user'] | null>(JSON.parse(this.getItem(USER_KEY) ?? 'null'));

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly canViewBranchOrders = computed(() => {
    const role = this._user()
      ?.role.trim()
      .toUpperCase()
      .replace(/^ROLE_/, '');
    return role === 'BRANCH_MANAGER' || role === 'BRANCH_CASHIER';
  });

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/auth/signin', { email, password }).pipe(
      tap((res) => {
        this.setItem(TOKEN_KEY, res.jwt);
        this.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.jwt);
        this._user.set(res.user);
      }),
    );
  }

  logout() {
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
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
