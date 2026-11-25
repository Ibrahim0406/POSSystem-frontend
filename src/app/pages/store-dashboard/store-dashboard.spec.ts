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

  it('limits a Branch Manager workspace to assigned branch data and cashier actions', async () => {
    const assignedBranch = {
      id: 7,
      name: 'Assigned branch',
      address: 'Street',
      phoneNumber: '061',
      email: 'branch@example.com',
      workingDays: ['MONDAY'],
      openTime: '08:00:00',
      closeTime: '20:00:00',
      storeId: 2,
    };
    const user = {
      id: 9,
      fullName: 'Branch Manager',
      email: 'manager@example.com',
      role: 'ROLE_BRANCH_MANAGER',
      storeId: 2,
      branchId: 7,
    };
    const api = {
      getBranch: vi.fn(() => of(assignedBranch)),
      getStoreForEmployee: vi.fn(),
      getBranches: vi.fn(),
      getProducts: vi.fn(() =>
        of([
          { id: 1, name: 'Assigned product', sku: 'A', storeId: 2 },
          { id: 2, name: 'Not assigned product', sku: 'B', storeId: 2 },
        ]),
      ),
      getBranchEmployees: vi.fn(() =>
        of([
          {
            id: 11,
            fullName: 'Branch Cashier',
            email: 'cashier@example.com',
            role: 'ROLE_BRANCH_CASHIER',
            branchId: 7,
          },
        ]),
      ),
      getInventory: vi.fn(() => of([{ id: 1, branchId: 7, productId: 1, quantity: 3 }])),
      getOrders: vi.fn(() => of([])),
      getRefunds: vi.fn(() => of([])),
      getShiftReports: vi.fn(() => of([])),
      createBranchEmployee: vi.fn(() => of({})),
    };
    const auth = {
      user: () => user,
      role: computed(() => 'BRANCH_MANAGER'),
      scopeKey: () => '9:ROLE_BRANCH_MANAGER:2:7:ACTIVE',
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
    const dashboard = fixture.componentInstance;

    expect(api.getBranch).toHaveBeenCalledWith(7);
    expect(api.getBranchEmployees).toHaveBeenCalledWith(7, 'ROLE_BRANCH_CASHIER');
    expect(api.getProducts).toHaveBeenCalledWith(2);
    expect(api.getInventory).toHaveBeenCalledWith(7);
    expect(api.getStoreForEmployee).not.toHaveBeenCalled();
    expect(api.getBranches).not.toHaveBeenCalled();
    expect(dashboard.branches().map((branch) => branch.id)).toEqual([7]);
    expect(dashboard.employees().map((employee) => employee.id)).toEqual([11]);
    expect(dashboard.products().map((product) => product.id)).toEqual([1]);
    expect(dashboard.canManageBranches()).toBe(false);
    expect(dashboard.canManageInventory()).toBe(true);

    dashboard.employeeDraft.set({
      fullName: 'New user',
      email: 'new@example.com',
      phone: '',
      password: 'password',
      role: 'ROLE_BRANCH_CASHIER',
      branchId: '8',
    });
    dashboard.updateEmployeeField('role', 'ROLE_BRANCH_MANAGER');
    dashboard.saveEmployee({ preventDefault: vi.fn() } as unknown as Event);

    expect(api.createBranchEmployee).not.toHaveBeenCalled();
    expect(dashboard.actionError()).toContain('ROLE_BRANCH_CASHIER');

    dashboard.employeeDraft.set({
      fullName: 'New cashier',
      email: 'new-cashier@example.com',
      phone: '',
      password: 'password',
      role: 'ROLE_BRANCH_CASHIER',
      branchId: '8',
    });
    dashboard.saveEmployee({ preventDefault: vi.fn() } as unknown as Event);

    expect(api.createBranchEmployee).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        branchId: 7,
        role: 'ROLE_BRANCH_CASHIER',
      }),
    );
    await fixture.whenStable();

    dashboard.selectBranch('8');
    expect(dashboard.branches()).toEqual([]);
    expect(dashboard.inventory()).toEqual([]);
    expect(dashboard.actionError()).toContain('assigned branch');
  });

  it('clears Branch Manager data when the assigned branch endpoint returns 404', async () => {
    const user = {
      id: 9,
      fullName: 'Branch Manager',
      email: 'manager@example.com',
      role: 'ROLE_BRANCH_MANAGER',
      storeId: 2,
      branchId: 7,
    };
    const api = {
      getBranch: () =>
        of({
          id: 7,
          name: 'Assigned branch',
          address: 'Street',
          phoneNumber: '061',
          email: 'branch@example.com',
          workingDays: ['MONDAY'],
          openTime: '08:00:00',
          closeTime: '20:00:00',
          storeId: 2,
        }),
      getProducts: () => of([{ id: 1, name: 'Product', sku: 'A', storeId: 2 }]),
      getBranchEmployees: () =>
        of([
          {
            id: 11,
            fullName: 'Branch Cashier',
            email: 'cashier@example.com',
            role: 'ROLE_BRANCH_CASHIER',
            branchId: 7,
          },
        ]),
      getInventory: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      getOrders: () => of([]),
      getRefunds: () => of([]),
      getShiftReports: () => of([]),
    };

    TestBed.configureTestingModule({
      imports: [StoreDashboard],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => user,
            role: computed(() => 'BRANCH_MANAGER'),
            scopeKey: () => '9:ROLE_BRANCH_MANAGER:2:7:ACTIVE',
          },
        },
        { provide: StoreOperationsService, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(StoreDashboard);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.branches()).toEqual([]);
    expect(fixture.componentInstance.employees()).toEqual([]);
    expect(fixture.componentInstance.orders()).toEqual([]);
    expect(fixture.componentInstance.actionError()).toContain('Resource unavailable');
  });
});
