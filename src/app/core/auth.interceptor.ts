import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  // Backend ocekuje "Bearer <jwt>" (JWTValidator radi substring(7))
  const authReq =
    token && !req.url.startsWith('/auth')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err) => {
      if ((err.status === 401 || err.status === 403) && !req.url.startsWith('/auth')) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
