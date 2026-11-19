import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-account-access',
  imports: [HlmButton],
  template: `
    <main class="access-page">
      <h1>Account access unavailable</h1>
      <p>
        This account is not assigned to a store or branch with an available POS workspace. Contact
        your platform administrator to review the account assignment.
      </p>
      <button hlmBtn type="button" variant="outline" (click)="auth.logout()">Sign out</button>
    </main>
  `,
  styles: `
    .access-page {
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
export class AccountAccess {
  readonly auth = inject(AuthService);
}
