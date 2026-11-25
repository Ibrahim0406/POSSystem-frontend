import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ShiftReport } from '../../core/models';
import { ShiftReportService } from '../../core/shift-report.service';
import { ShiftSummary } from './shift-summary';

describe('ShiftSummary', () => {
  it('allows a cashier to start when no current report exists even if the current endpoint errors', async () => {
    const api = {
      getCurrent: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
      getByCashier: vi.fn(() => of([])),
      start: vi.fn(() => of({})),
      getCurrentBranchActive: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [ShiftSummary],
      providers: [
        {
          provide: AuthService,
          useValue: {
            role: () => 'BRANCH_CASHIER',
            user: () => ({ id: 5, fullName: 'New Cashier' }),
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:2:7:ACTIVE',
          },
        },
        { provide: ShiftReportService, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(ShiftSummary);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.canStartShift()).toBe(true);
    const rootElement = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(rootElement.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Start shift'),
      ),
    ).toBe(true);
  });

  it('lets a cashier start their first shift when no reports exist', async () => {
    const activeReport: ShiftReport = {
      id: 21,
      shiftStart: '2026-11-25T13:00:00Z',
      shiftEnd: null,
      totalSales: 0,
      totalRefunds: 0,
      netSales: 0,
      totalOrders: 0,
    };
    const api = {
      getCurrent: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))),
      getByCashier: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))),
      start: vi.fn(() => of(activeReport)),
      getCurrentBranchActive: vi.fn(() => of([])),
    };

    TestBed.configureTestingModule({
      imports: [ShiftSummary],
      providers: [
        {
          provide: AuthService,
          useValue: {
            role: () => 'BRANCH_CASHIER',
            user: () => ({ id: 5, fullName: 'New Cashier' }),
            scopeKey: () => '5:ROLE_BRANCH_CASHIER:2:7:ACTIVE',
          },
        },
        { provide: ShiftReportService, useValue: api },
      ],
    });

    const fixture = TestBed.createComponent(ShiftSummary);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.canStartShift()).toBe(true);
    const rootElement = fixture.nativeElement as HTMLElement;
    const startButton = Array.from(rootElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start shift'),
    );
    expect(startButton).toBeDefined();

    startButton?.click();
    expect(api.start).toHaveBeenCalledOnce();
  });
});
