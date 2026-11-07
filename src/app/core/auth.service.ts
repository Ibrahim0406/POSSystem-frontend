import { Injectable, computed, inject, signal } from '@angular/core';
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

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user = signal<AuthResponse['user'] | null>(
    JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'),
  );

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(email: string, password: string) {
    return this.http.post<AuthResponse>('/auth/signin', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.jwt);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.jwt);
        this._user.set(res.user);
      }),
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }
}
