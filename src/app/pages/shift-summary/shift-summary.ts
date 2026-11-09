import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, interval, map, of, startWith } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { PaymentType, ShiftRefund, ShiftReport } from '../../core/models';
import { ShiftReportService } from '../../core/shift-report.service';
import { toDate } from '../../core/loyalty';

@Component({
  selector: 'app-shift-summary',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './shift-summary.html',
  styleUrl: './shift-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftSummary {
  private auth = inject(AuthService);
  private api = inject(ShiftReportService);
  private readonly clock = signal(new Date());

  readonly report = signal<ShiftReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly date = toDate;
  readonly cashier = computed(
    () => this.report()?.cashier?.fullName ?? this.auth.user()?.fullName ?? '—',
  );
  readonly shiftStatus = computed(() => {
    const report = this.report();
    if (!report) return this.loading() ? 'Učitavanje…' : 'Nema izvještaja';
    return report.shiftEnd ? 'Smjena završena' : 'Smjena u toku';
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
    const start = report ? this.timestamp(report.shiftStart) : 0;
    const end = report?.shiftEnd ? this.timestamp(report.shiftEnd) : this.clock().getTime();
    if (!start || !end) return '—';
    const minutes = Math.max(0, Math.floor((end - start) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });

  constructor() {
    interval(60_000)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.clock.set(new Date()));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
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
              ? 'Ne mogu učitati izvještaj s backend servera. Provjeri da li backend radi i da li si prijavljen/a.'
              : 'Nema izvještaja smjene za ovog blagajnika. Pokreni smjenu pa pokušaj ponovo.',
          );
        }
      });
  }

  paymentLabel(type: PaymentType) {
    switch (type) {
      case 'CASH':
        return 'Gotovina';
      case 'CARD':
        return 'Kartica';
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
