import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-store-status',
  template: `
    <main class="status-page">
      @if (auth.storeStatus() === 'PENDING') {
        <h1>Prodavnica čeka odobrenje</h1>
        <p>
          Vaša prodavnica je zaprimljena i čeka odobrenje administratora platforme. POS funkcije će
          biti dostupne nakon odobrenja.
        </p>
      } @else {
        <h1>Prodavnica je blokirana</h1>
        <p>
          Pristup POS funkcijama za ovu prodavnicu je blokiran. Obratite se administratoru
          platforme za dodatne informacije.
        </p>
      }
      <button type="button" (click)="auth.logout()">Odjavi se</button>
    </main>
  `,
  styles: `
    .status-page {
      min-height: 100vh;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 12px;
      padding: 24px;
      text-align: center;
    }

    p {
      max-width: 560px;
      line-height: 1.6;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreStatusPage {
  readonly auth = inject(AuthService);
}
