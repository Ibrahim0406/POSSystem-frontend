import { CurrencyPipe, DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, interval, map, of, startWith, throwError } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';
import { PaymentType, ShiftRefund, ShiftReport } from '../../core/models';
import { ShiftReportService } from '../../core/shift-report.service';
import { toDate } from '../../core/loyalty';
import { apiErrorMessage } from '../../core/api-error-message';

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
  readonly canStartShift = signal(false);
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
    if (!report) return this.loading() ? 'Loading…' : 'No active shift';
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

  readonly isBranchManager = computed(() => this.auth.role() === 'BRANCH_MANAGER');

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
    this.report.set(null);
    this.canStartShift.set(false);
    this.branchReports.set([]);
    const scope = this.auth.scopeKey();

    if (this.isBranchManager()) {
      this.api
        .getCurrentBranchActive()
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (reports) => {
            if (scope !== this.auth.scopeKey()) return;
            this.branchReports.set(
              [...reports].sort(
                (a, b) => this.timestamp(b.shiftStart) - this.timestamp(a.shiftStart),
              ),
            );
          },
          error: (error: unknown) => {
            if (scope !== this.auth.scopeKey()) return;
            this.branchReports.set([]);
            this.error.set(
              apiErrorMessage(
                error,
                'Unable to load active cashier shifts for this branch. Check that the backend endpoint is available and try again.',
              ),
            );
          },
        });
      return;
    }

    const cashierId = this.auth.user()?.id;
    let historyRequestFailed = false;
    let historyAuthorizationFailed = false;
    let historyRequestError = '';
    let currentRequestFailed = false;
    let currentRequestNotFound = false;
    const latestReport = cashierId
      ? this.api.getByCashier(cashierId).pipe(
          map(
            (reports) =>
              [...reports].sort(
                (a, b) => this.timestamp(b.shiftStart) - this.timestamp(a.shiftStart),
              )[0] ?? null,
          ),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 404) {
              return of(null);
            }
            if (
              error instanceof HttpErrorResponse &&
              (error.status === 401 || error.status === 403)
            ) {
              historyAuthorizationFailed = true;
            }
            historyRequestFailed = true;
            historyRequestError = apiErrorMessage(
              error,
              'Unable to load the shift report. Check that the backend is running and you are signed in.',
            );
            return of(null);
          }),
        )
      : of(null);

    this.api
      .getCurrent()
      .pipe(
        catchError((error: unknown) => {
          if (
            error instanceof HttpErrorResponse &&
            (error.status === 401 || error.status === 403)
          ) {
            return throwError(() => error);
          }
          if (error instanceof HttpErrorResponse && error.status === 404) {
            currentRequestNotFound = true;
          } else currentRequestFailed = true;
          return latestReport;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (report) => {
          if (scope !== this.auth.scopeKey()) return;
          const currentReport =
            currentRequestNotFound && report && !report.shiftEnd ? null : report;
          this.report.set(currentReport);
          this.canStartShift.set(
            !historyAuthorizationFailed && (!currentReport || currentReport.shiftEnd != null),
          );
          if (!currentReport) {
            this.error.set(
              historyAuthorizationFailed
                ? historyRequestError
                : currentRequestFailed
                  ? 'Could not confirm an active shift. You can try starting one; the server will validate the request.'
                  : currentRequestNotFound
                    ? 'No active shift was found. Start a shift to begin.'
                    : historyRequestFailed
                      ? historyRequestError
                      : 'No shift report was found for this cashier. Start a shift and try again.',
            );
          }
        },
        error: (error: unknown) => {
          if (scope !== this.auth.scopeKey()) return;
          this.report.set(null);
          this.canStartShift.set(false);
          this.error.set(
            apiErrorMessage(error, 'Unable to load the shift report. Please try again.'),
          );
        },
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
        next: (endedReport) => {
          this.report.set(endedReport);
          this.canStartShift.set(true);
        },
        error: (error: unknown) =>
          this.actionError.set(
            apiErrorMessage(
              error,
              'The shift could not be ended. Check the backend and the shift branch, then try again.',
            ),
          ),
      });
  }

  startShift() {
    if (!this.canStartShift() || this.starting() || this.loading()) return;

    this.actionError.set('');
    this.starting.set(true);
    this.canStartShift.set(false);
    this.api
      .start()
      .pipe(finalize(() => this.starting.set(false)))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => {
          this.canStartShift.set(
            !(error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)),
          );
          this.actionError.set(
            apiErrorMessage(
              error,
              'The shift could not be started. Check the backend and try again.',
            ),
          );
        },
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
