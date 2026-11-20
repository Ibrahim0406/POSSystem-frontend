import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { CustomerService } from '../../core/customer.service';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { CashierDashboard } from './cashier-dashboard';

describe('CashierDashboard', () => {
  let createOrder: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createOrder = vi.fn(() => of({ id: 42 } as Order));

    await TestBed.configureTestingModule({
      imports: [CashierDashboard],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ branchId: 7 }),
            scopeKey: () => '1:BRANCH_CASHIER:2:7:ACTIVE',
            canRefund: () => true,
          },
        },
        { provide: BranchService, useValue: { getById: () => of({ id: 7, storeId: 2 }) } },
        { provide: CustomerService, useValue: { getAll: () => of([]) } },
        { provide: ProductService, useValue: { getByStore: () => of([]) } },
        { provide: OrderService, useValue: { createOrder } },
      ],
    }).compileComponents();
  });

  it('updates cart quantities and calculates discount totals', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    const product = { id: 1, name: 'Coffee', sku: 'CF-1', sellingPrice: 8 };

    component.addProduct(product);
    component.addProduct(product);
    component.changeQuantity(product.id, -1);
    component.discountPercent.set(25);

    expect(component.itemCount()).toBe(1);
    expect(component.subtotal()).toBe(8);
    expect(component.discountAmount()).toBe(2);
    expect(component.total()).toBe(6);
  });

  it('does not create an order with a discount the API cannot persist', () => {
    const component = TestBed.createComponent(CashierDashboard).componentInstance;
    component.addProduct({ id: 1, name: 'Coffee', sku: 'CF-1', sellingPrice: 8 });
    component.discountPercent.set(10);

    component.proceedPayment();

    expect(createOrder).not.toHaveBeenCalled();
  });
});
