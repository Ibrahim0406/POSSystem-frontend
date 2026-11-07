import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router } from 'express';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['login']);
};
