import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { Customer, Order } from '../../core/models';
import { CustomerService } from '../../core/customer.service';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { StoreOperationsService } from '../../core/store-operations.service';
import { CashierDashboard } from './cashier-dashboard';

describe('CashierDashboard', () => {
  type User = { id: number; branchId: number; storeId: number } | null;
  let updateUser: (user: User) => void;
  let createOrder: ReturnType<typeof vi.fn>;
  let getCustomers: ReturnType<typeof vi.fn>;
  let getByBranch: ReturnType<typeof vi.fn>;
  let getByStore: ReturnType<typeof vi.fn>;
  let getInventory: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createOrder = vi.fn(() => of({ id: 42 } as Order));
    getCustomers = vi.fn(() => of([{ id: 29, fullName: 'Alex Morgan' } as Customer]));
    getByBranch = vi.fn(() => of([]));
    getByStore = vi.fn(() => of([]));
    getInventory = vi.fn(() => of([]));
    const user = signal<User>({ id: 5, branchId: 7, storeId: 2 });
    updateUser = (nextUser) => user.set(nextUser);
    const role = computed(() => (user() ? 'BRANCH_CASHIER' : null));

    await TestBed.configureTestingModule({
      imports: [CashierDashboard],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => user(),
            role,
            isLoggedIn: computed(() => user() !== null),
            scopeKey: computed(() => {
              const current = user();
              return current
                ? `${current.id}:BRANCH_CASHIER:${current.storeId}:${current.branchId}:ACTIVE`
                : 'anonymous';
            }),
            canRefund: computed(() => role() === 'BRANCH_CASHIER'),
            canCreateCustomers: computed(() => role() === 'BRANCH_CASHIER'),
            canAccessCustomers: computed(() => role() === 'BRANCH_CASHIER'),
          },
        },
        { provide: CustomerService, useValue: { getAll: getCustomers } },
        { provide: BranchService, useValue: { getById: () => of({ id: 7, storeId: 2 }) } },
        { provide: ProductService, useValue: { getByStore } },
        { provide: StoreOperationsService, useValue: { getInventory } },
        { provide: OrderService, useValue: { createOrder, getByBranch } },
      ],
    }).compileComponents();
  });

  it('only offers products that have inventory in the assigned branch', () => {
    getByStore.mockReturnValue(
      of([
        { id: 1, name: 'Coffee', sku: 'CF-1', sellingPrice: 8, storeId: 2 },
        { id: 2, name: 'Tea', sku: 'TE-1', sellingPrice: 4, storeId: 2 },
      ]),
    );
    getInventory.mockReturnValue(of([{ id: 3, branchId: 7, productId: 1, quantity: 6 }]));

    const component = TestBed.createComponent(CashierDashboard).componentInstance;

    expect(component.products().map((product) => [product.id, product.availableQuantity])).toEqual([
      [1, 6],
    ]);
  });

  it('lets an assigned cashier open customer creation from POS', () => {
    const fixture = TestBed.createComponent(CashierDashboard);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(fixture.nativeElement.textContent).toContain('Add customer');
    component.openCustomerForm();
    expect(component.showCustomerForm()).toBe(true);
  });

  it('loads customers for the cashier and submits the selected customer with the order', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    component.addProduct({
      id: 1,
      name: 'Coffee',
      sku: 'CF-1',
      sellingPrice: 8,
      availableQuantity: 3,
    });
    component.selectedCustomerId.set(29);

    component.proceedPayment();

    expect(getCustomers).toHaveBeenCalled();
    expect(component.customers()).toEqual([{ id: 29, fullName: 'Alex Morgan' }]);
    expect(createOrder).toHaveBeenCalledWith({
      customer: { id: 29 },
      paymentType: 'CASH',
      items: [{ productId: 1, quantity: 1, price: 8 }],
    });
  });

  it('limits cart quantity to branch stock and calculates read-only totals', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    const product = {
      id: 1,
      name: 'Coffee',
      sku: 'CF-1',
      sellingPrice: 8,
      availableQuantity: 2,
    };

    component.addProduct(product);
    component.addProduct(product);
    component.addProduct(product);

    expect(component.itemCount()).toBe(2);
    expect(component.subtotal()).toBe(16);
    expect(component.total()).toBe(16);
  });

  it('does not create an order with a product missing from branch stock', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    component.addProduct({
      id: 1,
      name: 'Coffee',
      sku: 'CF-1',
      sellingPrice: 8,
      availableQuantity: 0,
    });

    component.proceedPayment();

    expect(createOrder).not.toHaveBeenCalled();
  });

  it('refreshes branch inventory and own order history after order creation', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    component.addProduct({
      id: 1,
      name: 'Coffee',
      sku: 'CF-1',
      sellingPrice: 8,
      availableQuantity: 3,
    });

    component.proceedPayment();

    expect(createOrder).toHaveBeenCalledWith({
      customer: null,
      paymentType: 'CASH',
      items: [{ productId: 1, quantity: 1, price: 8 }],
    });
    expect(getInventory).toHaveBeenCalledTimes(2);
    expect(getByBranch).toHaveBeenCalledTimes(2);
  });

  it('clears cashier state when the authenticated scope logs out', async () => {
    const fixture = TestBed.createComponent(CashierDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.products.set([
      { id: 1, name: 'Coffee', sku: 'CF-1', sellingPrice: 8, availableQuantity: 4 },
    ]);
    component.cart.set([
      {
        product: {
          id: 1,
          name: 'Coffee',
          sku: 'CF-1',
          sellingPrice: 8,
          availableQuantity: 4,
        },
        quantity: 1,
      },
    ]);
    component.search.set('coffee');
    component.success.set('Order created');

    updateUser(null);
    await fixture.whenStable();

    expect(component.products()).toEqual([]);
    expect(component.cart()).toEqual([]);
    expect(component.recentOrders()).toEqual([]);
    expect(component.search()).toBe('');
    expect(component.success()).toBe('');
  });
});
