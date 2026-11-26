import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { StoreOperationsService } from '../../core/store-operations.service';
import { CashierDashboard } from './cashier-dashboard';

describe('CashierDashboard', () => {
  let createOrder: ReturnType<typeof vi.fn>;
  let getByBranch: ReturnType<typeof vi.fn>;
  let getByStore: ReturnType<typeof vi.fn>;
  let getInventory: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createOrder = vi.fn(() => of({ id: 42 } as Order));
    getByBranch = vi.fn(() => of([]));
    getByStore = vi.fn(() => of([]));
    getInventory = vi.fn(() => of([]));

    await TestBed.configureTestingModule({
      imports: [CashierDashboard],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7, storeId: 2 }),
            scopeKey: () => '1:BRANCH_CASHIER:2:7:ACTIVE',
            canRefund: () => true,
          },
        },
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
});
