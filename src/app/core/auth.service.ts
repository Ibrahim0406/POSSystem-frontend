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

  private _token = signal<string | null>(this.getInitialToken());
  private _user = signal<AuthResponse['user'] | null>(this.getInitialUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/auth/signin', { email, password }).pipe(
      tap((res) => {
        if (this.isBrowser) {
          localStorage.setItem(TOKEN_KEY, res.jwt);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        }
        this._token.set(res.jwt);
        this._user.set(res.user);
      }),
    );
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private getInitialToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }

  private getInitialUser(): AuthResponse['user'] | null {
    if (this.isBrowser) {
      const rawUser = localStorage.getItem(USER_KEY);
      return rawUser ? JSON.parse(rawUser) : null;
    }
    return null;
  }
}
