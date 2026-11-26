import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, storeStatusGuard } from './auth.guard';

describe('authGuard', () => {
  it('allows a pending account to reach its store status page', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => true, isAdmin: () => false, storeStatus: () => 'PENDING' },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/store-status' } as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('redirects pending accounts from other protected pages to store status', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => true, isAdmin: () => false, storeStatus: () => 'PENDING' },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/customers?query=a' } as RouterStateSnapshot),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/store-status',
    );
  });

  it('lets blocked users reach store status and redirects them there from protected pages', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => true, isAdmin: () => false, storeStatus: () => 'BLOCKED' },
        },
      ],
    });

    const statusResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/store-status' } as RouterStateSnapshot),
    );
    const protectedResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/cashier' } as RouterStateSnapshot),
    );
    const router = TestBed.inject(Router);

    expect(statusResult).toBe(true);
    expect(router.serializeUrl(protectedResult as ReturnType<Router['createUrlTree']>)).toBe(
      '/store-status',
    );
  });

  it('does not redirect a store-status page back to itself when the tenant is active', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            storeStatus: () => 'ACTIVE',
            homeRoute: () => '/cashier',
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      storeStatusGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/cashier');
  });
});
