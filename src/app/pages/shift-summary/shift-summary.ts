import { CurrencyPipe, DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, interval, map, of, startWith } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';
import { PaymentType, ShiftRefund, ShiftReport } from '../../core/models';
import { ShiftReportService } from '../../core/shift-report.service';
import { toDate } from '../../core/loyalty';

@Component({
  selector: 'app-shift-summary',
  imports: [CurrencyPipe, DatePipe, HlmButton],
  templateUrl: './shift-summary.html',
  styleUrl: './shift-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftSummary {
  private auth = inject(AuthService);
  private api = inject(ShiftReportService);
  private document = inject(DOCUMENT);
  private readonly clock = signal(new Date());

  readonly report = signal<ShiftReport | null>(null);
  readonly loading = signal(true);
  readonly ending = signal(false);
  readonly starting = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly date = toDate;
  readonly cashier = computed(
    () => this.report()?.cashier?.fullName ?? this.auth.user()?.fullName ?? '—',
  );
  readonly shiftStatus = computed(() => {
    if (this.isBranchManager()) {
      if (this.loading()) return 'Loading…';
      const count = this.branchReports().length;
      return `${count} active cashier shift${count === 1 ? '' : 's'}`;
    }

    const report = this.report();
    if (!report) return this.loading() ? 'Loading…' : 'No report';
    return report.shiftEnd ? 'Shift completed' : 'Shift in progress';
  });
  readonly totalOrders = computed(() => this.report()?.totalOrders ?? 0);
  readonly totalSales = computed(() => this.report()?.totalSales ?? 0);
  readonly totalRefunds = computed(() => this.report()?.totalRefunds ?? 0);
  readonly netSales = computed(
    () => this.report()?.netSales ?? this.totalSales() - this.totalRefunds(),
  );
  readonly payments = computed(() =>
    (this.report()?.paymentSummaries ?? []).map((payment) => ({
      label: this.paymentLabel(payment.type),
      amount: payment.totalAmount,
      share: payment.percentage,
    })),
  );
  readonly topItems = computed(() => this.report()?.topSellingProducts ?? []);
  readonly recentOrders = computed(() =>
    [...(this.report()?.recentOrders ?? [])]
      .sort((a, b) => this.timestamp(b.createdAt) - this.timestamp(a.createdAt))
      .slice(0, 5),
  );
  readonly refunds = computed(() => this.report()?.refunds ?? []);

  readonly duration = computed(() => {
    const report = this.report();
    return report ? this.shiftDuration(report) : '—';
  });

  readonly isBranchManager = computed(
    () => this.auth.user()?.role.trim().toUpperCase() === 'ROLE_BRANCH_MANAGER',
  );

  readonly branchReports = signal<ShiftReport[]>([]);

  shiftDuration(report: ShiftReport) {
    const start = this.timestamp(report.shiftStart);
    const end = report.shiftEnd ? this.timestamp(report.shiftEnd) : this.clock().getTime();
    if (!start || !end) return '—';
    const minutes = Math.max(0, Math.floor((end - start) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  constructor() {
    interval(60_000)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.clock.set(new Date()));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    if (this.isBranchManager()) {
      this.api
        .getCurrentBranchActive()
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (reports) => {
            this.branchReports.set(
              [...reports].sort(
                (a, b) => this.timestamp(b.shiftStart) - this.timestamp(a.shiftStart),
              ),
            );
          },
          error: () => {
            this.branchReports.set([]);
            this.error.set(
              'Unable to load active cashier shifts for this branch. Check that the backend endpoint is available and try again.',
            );
          },
        });
      return;
    }

    const cashierId = this.auth.user()?.id;
    let historyRequestFailed = false;
    const latestReport = cashierId
      ? this.api.getByCashier(cashierId).pipe(
          map(
            (reports) =>
              [...reports].sort(
                (a, b) => this.timestamp(b.shiftStart) - this.timestamp(a.shiftStart),
              )[0] ?? null,
          ),
          catchError(() => {
            historyRequestFailed = true;
            return of(null);
          }),
        )
      : of(null);

    this.api
      .getCurrent()
      .pipe(
        catchError(() => latestReport),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((report) => {
        this.report.set(report);
        if (!report) {
          this.error.set(
            historyRequestFailed
              ? 'Unable to load the shift report. Check that the backend is running and you are signed in.'
              : 'No shift report was found for this cashier. Start a shift and try again.',
          );
        }
      });
  }

  printSummary() {
    this.document.defaultView?.print();
  }

  endShift() {
    const report = this.report();
    const confirmed = this.document.defaultView?.confirm('End this shift?');
    if (!report || report.shiftEnd || !confirmed || this.ending()) return;

    this.actionError.set('');
    this.ending.set(true);
    this.api
      .endCurrent()
      .pipe(finalize(() => this.ending.set(false)))
      .subscribe({
        next: (endedReport) => this.report.set(endedReport),
        error: () =>
          this.actionError.set(
            'The shift could not be ended. Check the backend and the shift branch, then try again.',
          ),
      });
  }

  startShift() {
    if (!this.report()?.shiftEnd || this.starting()) return;

    this.actionError.set('');
    this.starting.set(true);
    this.api
      .start()
      .pipe(finalize(() => this.starting.set(false)))
      .subscribe({
        next: () => this.load(),
        error: () =>
          this.actionError.set('The shift could not be started. Check the backend and try again.'),
      });
  }

  paymentLabel(type: PaymentType) {
    switch (type) {
      case 'CASH':
        return 'Cash';
      case 'CARD':
        return 'Card';
      case 'UPI':
        return 'UPI';
    }
  }

  paymentTypeLabel(type: PaymentType | null | undefined) {
    return type ? this.paymentLabel(type) : '—';
  }

  refundOrderId(refund: ShiftRefund) {
    return refund.order?.id ?? refund.orderId ?? '—';
  }

  private timestamp(value: string | number[] | null | undefined) {
    const date = toDate(value);
    return date?.getTime() ?? 0;
  }
}
