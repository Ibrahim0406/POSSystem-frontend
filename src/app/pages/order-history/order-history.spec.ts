import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { OrderHistory } from './order-history';

describe('OrderHistory', () => {
  it('navigates to refunds with the selected order when initiating a return', async () => {
    const ownOrder: Order = {
      id: 11,
      branchId: 7,
      cashierId: 5,
      createdAt: '2026-11-25T10:00:00Z',
      totalAmount: 20,
      items: [],
    };
    const navigate = vi.fn();

    TestBed.configureTestingModule({
      imports: [OrderHistory],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7 }),
            role: () => 'BRANCH_CASHIER',
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:7',
            canViewBranchOrders: () => true,
            canRefund: () => true,
          },
        },
        { provide: OrderService, useValue: { getByBranch: () => of([ownOrder]) } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    const fixture = TestBed.createComponent(OrderHistory);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.openDetails(ownOrder);
    fixture.componentInstance.initiateReturn();

    expect(navigate).toHaveBeenCalledWith(['/refund'], { queryParams: { orderId: 11 } });
  });

  it('shows only this cashier’s orders from their assigned branch', async () => {
    const ownOrder: Order = {
      id: 11,
      branchId: 7,
      cashierId: 5,
      createdAt: '2026-11-25T10:00:00Z',
      totalAmount: 20,
      items: [],
    };
    const otherCashierOrder: Order = {
      ...ownOrder,
      id: 12,
      cashierId: 6,
    };
    const otherBranchOrder: Order = {
      ...ownOrder,
      id: 13,
      branchId: 8,
    };

    TestBed.configureTestingModule({
      imports: [OrderHistory],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 5, branchId: 7 }),
            role: () => 'BRANCH_CASHIER',
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:7',
            canViewBranchOrders: () => true,
            canRefund: () => true,
          },
        },
        {
          provide: OrderService,
          useValue: {
            getByBranch: () => of([ownOrder, otherCashierOrder, otherBranchOrder]),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(OrderHistory);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.orders()).toEqual([ownOrder]);
  });
});
