import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { StoreOperationsService } from '../../core/store-operations.service';
import { StoreDashboard } from './store-dashboard';

describe('StoreDashboard', () => {
  it('clears tenant data and reports access denied when an operation returns 403', async () => {
    const user = signal({
      id: 1,
      fullName: 'Owner',
      email: 'owner@example.com',
      role: 'ROLE_STORE_ADMIN',
      storeId: 7,
    });
    const scopeKey = computed(() => `${user().id}:${user().storeId}`);
    const auth = {
      user: () => user(),
      role: computed(() => 'STORE_ADMIN'),
      scopeKey,
    };
    const api = {
      getStoreForAdmin: () => of({ id: 7, brand: 'Store', status: 'ACTIVE' }),
      getStoreForEmployee: () => of({ id: 7, brand: 'Store', status: 'ACTIVE' }),
      getBranches: () =>
        of([
          {
            id: 3,
            name: 'Main',
            address: 'Street',
            phoneNumber: '061',
            email: 'main@example.com',
            workingDays: ['MONDAY'],
            openTime: '08:00:00',
            closeTime: '20:00:00',
            storeId: 7,
          },
        ]),
      getBranch: vi.fn(),
      getProducts: () => of([{ id: 4, name: 'Product', sku: 'SKU', storeId: 7 }]),
      getCategories: () => of([]),
      getStoreEmployees: () => of([]),
      getBranchEmployees: () => of([]),
      getInventory: () => of([]),
      getOrders: () => of([]),
      getRefunds: () => of([]),
      getShiftReports: () => of([]),
      deleteProduct: () => throwError(() => new HttpErrorResponse({ status: 403 })),
    };

    TestBed.configureTestingModule({
      imports: [StoreDashboard],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: StoreOperationsService, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(StoreDashboard);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.store()?.id).toBe(7);
    expect(fixture.componentInstance.products()).toHaveLength(1);

    fixture.componentInstance.requestDelete({ type: 'product', id: 4 });
    fixture.componentInstance.confirmDelete();

    expect(fixture.componentInstance.store()).toBeNull();
    expect(fixture.componentInstance.products()).toEqual([]);
    expect(fixture.componentInstance.actionError()).toContain('Access denied');
    expect(fixture.componentInstance.notice()).toBe('');
  });
});
