import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { RefundService } from '../../core/refund.service';
import { Refund } from './refund';

describe('Refund', () => {
  it('lists only the cashier’s own branch orders and refunds', async () => {
    const ownOrder: Order = {
      id: 11,
      branchId: 7,
      cashierId: 5,
      createdAt: '2026-11-25T10:00:00Z',
      totalAmount: 20,
      items: [{ id: 1, productId: 2, quantity: 1, price: 20 }],
    };
    const otherCashierOrder: Order = { ...ownOrder, id: 12, cashierId: 6 };

    TestBed.configureTestingModule({
      imports: [Refund],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7 }),
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:7',
            canRefund: () => true,
          },
        },
        {
          provide: OrderService,
          useValue: { getByBranch: () => of([ownOrder, otherCashierOrder]) },
        },
        {
          provide: RefundService,
          useValue: {
            getByBranch: () =>
              of([
                { id: 1, orderId: 11, amount: 20 },
                { id: 2, branchId: 7, cashierId: 6, orderId: 12, amount: 20 },
              ]),
            create: vi.fn(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(Refund);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.orders()).toEqual([ownOrder]);
    expect(fixture.componentInstance.refundedOrderIds()).toEqual(new Set([11]));
    expect(fixture.nativeElement.textContent).toContain('Refunded');

    fixture.componentInstance.openOrder(ownOrder);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedRefund()?.amount).toBe(20);
    expect(fixture.nativeElement.textContent).toContain('Item details not tracked');
    expect(fixture.nativeElement.textContent).toContain(
      'The backend records refunds per order, not per item.',
    );
  });

  it('keeps a successful refund status while refreshing the refund list', async () => {
    const ownOrder: Order = {
      id: 11,
      branchId: 7,
      cashierId: 5,
      createdAt: '2026-11-25T10:00:00Z',
      totalAmount: 20,
      items: [{ id: 1, productId: 2, quantity: 1, price: 20 }],
    };

    TestBed.configureTestingModule({
      imports: [Refund],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7 }),
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:7',
            canRefund: () => true,
          },
        },
        { provide: OrderService, useValue: { getByBranch: () => of([ownOrder]) } },
        {
          provide: RefundService,
          useValue: {
            getByBranch: () => of([]),
            create: () =>
              of({ id: 3, orderId: 11, amount: 20, reason: 'Damaged' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(Refund);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.openOrder(ownOrder);
    component.toggleItem(ownOrder.items[0]);
    component.returnReason.set('Damaged');
    component.confirmRefund();

    expect(component.refundedOrderIds().has(11)).toBe(true);
    expect(component.filteredOrders()).toContain(ownOrder);
    expect(component.refunds().some((refund) => refund.orderId === 11)).toBe(true);
  });

  it('shows a conflict as a refund business rejection', async () => {
    const ownOrder: Order = {
      id: 11,
      branchId: 7,
      cashierId: 5,
      createdAt: '2026-11-25T10:00:00Z',
      totalAmount: 20,
      items: [{ id: 1, productId: 2, quantity: 1, price: 20 }],
    };
    const create = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'A refund already exists for this order.' },
          }),
      ),
    );

    TestBed.configureTestingModule({
      imports: [Refund],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7 }),
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:7',
            canRefund: () => true,
          },
        },
        { provide: OrderService, useValue: { getByBranch: () => of([ownOrder]) } },
        {
          provide: RefundService,
          useValue: {
            getByBranch: () => of([]),
            create,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(Refund);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;

    component.openOrder(ownOrder);
    component.toggleItem(ownOrder.items[0]);
    component.returnReason.set('Damaged');
    component.confirmRefund();

    expect(create).toHaveBeenCalledOnce();
    expect(component.error()).toContain('Refund rejected: A refund already exists');
  });
});
