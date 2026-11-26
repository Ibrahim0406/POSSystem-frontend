import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { SignupRequest } from './models';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('sends the owner and store signup payload and saves the returned pending status', () => {
    const request: SignupRequest = {
      ownerFullName: 'Vlasnik Prodavnice',
      ownerEmail: 'vlasnik@example.com',
      ownerPassword: 'sigurnaLozinka123',
      ownerPhone: '061123456',
      storeBrand: 'Moja Prodavnica',
      storeDescription: 'Maloprodajna prodavnica',
      storeType: 'Retail',
      contact: {
        address: 'Adresa 1',
        phone: '061123456',
        email: 'prodavnica@example.com',
      },
    };

    auth.signup(request).subscribe();

    const signupRequest = http.expectOne('/auth/signup');
    expect(signupRequest.request.method).toBe('POST');
    expect(signupRequest.request.body).toEqual(request);
    expect('role' in signupRequest.request.body).toBe(false);
    signupRequest.flush({
      jwt: 'token',
      user: {
        id: 1,
        fullName: request.ownerFullName,
        email: request.ownerEmail,
        role: 'STORE_ADMIN',
      },
      storeStatus: 'PENDING',
    });

    expect(auth.storeStatus()).toBe('PENDING');
    expect(localStorage.getItem('cms_store_status')).toBe('PENDING');
    expect(auth.homeRoute()).toBe('/store-status');
  });

  it('routes a blocked tenant account to the store status page', () => {
    auth.login('blocked@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'blocked-token',
      storeStatus: 'BLOCKED',
      user: {
        id: 8,
        fullName: 'Blocked Manager',
        email: 'blocked@example.com',
        role: 'ROLE_STORE_MANAGER',
        storeId: 9,
      },
    });

    expect(auth.homeRoute()).toBe('/store-status');
  });

  it('routes an active store administrator to the store workspace without relying on client storeId', () => {
    auth.login('owner@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'owner-token',
      storeStatus: 'ACTIVE',
      user: {
        id: 4,
        fullName: 'Store Owner',
        email: 'owner@example.com',
        role: 'ROLE_STORE_ADMIN',
      },
    });

    expect(auth.homeRoute()).toBe('/store-dashboard');
    expect(auth.canAccessCustomers()).toBe(true);
  });

  it('keeps a platform administrator on the admin route when storeStatus is absent', () => {
    auth.login('admin@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'admin-token',
      user: {
        id: 1,
        fullName: 'Platform Admin',
        email: 'admin@example.com',
        role: 'ROLE_ADMIN',
      },
    });

    expect(auth.storeStatus()).toBeNull();
    expect(auth.homeRoute()).toBe('/admin');
  });

  it('uses the branch role and assignment instead of storeStatus to choose POS access', () => {
    auth.login('cashier@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'cashier-token',
      user: {
        id: 2,
        fullName: 'Branch Cashier',
        email: 'cashier@example.com',
        role: 'ROLE_BRANCH_CASHIER',
        branchId: 7,
      },
    });

    expect(auth.storeStatus()).toBeNull();
    expect(auth.canViewBranchOrders()).toBe(true);
    expect(auth.canRefund()).toBe(true);
    expect(auth.canAccessCustomers()).toBe(false);
    expect(auth.homeRoute()).toBe('/cashier');
  });

  it('routes an unassigned tenant account to an access message, not POS', () => {
    auth.login('unassigned@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'unassigned-token',
      user: {
        id: 3,
        fullName: 'Unassigned User',
        email: 'unassigned@example.com',
        role: 'ROLE_STORE_MANAGER',
      },
    });

    expect(auth.storeStatus()).toBeNull();
    expect(auth.homeRoute()).toBe('/account-access');
  });

  it('routes store managers to the store workspace with store scope', () => {
    auth.login('manager@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'manager-token',
      storeStatus: 'ACTIVE',
      user: {
        id: 5,
        fullName: 'Store Manager',
        email: 'manager@example.com',
        role: 'ROLE_STORE_MANAGER',
        storeId: 9,
      },
    });

    expect(auth.homeRoute()).toBe('/store-dashboard');
  });

  it('routes branch managers to the branch workspace with branch scope', () => {
    auth.login('branch-manager@example.com', 'password').subscribe();
    http.expectOne('/auth/signin').flush({
      jwt: 'branch-manager-token',
      storeStatus: 'ACTIVE',
      user: {
        id: 6,
        fullName: 'Branch Manager',
        email: 'branch-manager@example.com',
        role: 'ROLE_BRANCH_MANAGER',
        branchId: 7,
        storeId: 9,
      },
    });

    expect(auth.homeRoute()).toBe('/store-dashboard');
  });

  it('logout clears auth keys and tenant-scoped localStorage state', () => {
    localStorage.setItem('cms_jwt', 'token');
    localStorage.setItem('cms_user', '{}');
    localStorage.setItem('cms_store_status', 'ACTIVE');
    localStorage.setItem('cms_cart', 'tenant-data');
    auth.logout();

    expect(localStorage.getItem('cms_jwt')).toBeNull();
    expect(localStorage.getItem('cms_user')).toBeNull();
    expect(localStorage.getItem('cms_store_status')).toBeNull();
    expect(localStorage.getItem('cms_cart')).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });
});
