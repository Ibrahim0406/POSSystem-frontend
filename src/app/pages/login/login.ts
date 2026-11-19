import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { AuthService } from '../../core/auth.service';
import { authErrorMessage } from '../../core/auth-error-message';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
    HlmLabelImports,
  ],
  template: `
    <main class="auth-page">
      <hlm-card class="login-card" aria-labelledby="login-title">
        <hlm-card-header class="card-header">
          <div class="header-main">
            <a class="brand" routerLink="/" aria-label="POS System home">
              <span class="brand-mark" aria-hidden="true">P</span>
              <span>POS System</span>
            </a>
            <div class="card-heading">
              <h1 hlmCardTitle id="login-title">Login to your account</h1>
              <p hlmCardDescription>Enter your email below to login to your account.</p>
            </div>
          </div>
          <div hlmCardAction>
            <a hlmBtn variant="link" routerLink="/signup">Sign Up</a>
          </div>
        </hlm-card-header>

        <div hlmCardContent>
          <form id="login-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="fields">
              <div class="field">
                <label hlmLabel for="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  hlmInput
                  formControlName="email"
                  autocomplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div class="field">
                <label hlmLabel for="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  hlmInput
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
          </form>
        </div>

        <hlm-card-footer class="card-footer">
          <button
            hlmBtn
            type="submit"
            class="submit-button"
            form="login-form"
            [disabled]="form.invalid || loading()"
          >
            {{ loading() ? 'Signing in…' : 'Login' }}
          </button>
        </hlm-card-footer>
      </hlm-card>
    </main>
  `,
  styles: `
    .auth-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(ellipse at 12% 8%, oklch(0.94 0.04 255 / 60%), transparent 35%),
        var(--background);
    }

    .login-card {
      width: min(100%, 448px);
      box-shadow: 0 24px 70px oklch(0.2 0.03 260 / 10%);
    }

    .card-header {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
    }

    .header-main {
      display: grid;
      gap: 24px;
    }

    .card-heading h1 {
      margin: 0;
      font-size: 1.25rem;
    }

    .brand {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 10px;
      color: inherit;
      font-weight: 700;
      text-decoration: none;
    }

    .brand-mark {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      border-radius: 11px;
      background: var(--primary);
      color: var(--primary-foreground);
    }

    .card-heading p {
      margin: 6px 0 0;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .field {
      display: grid;
      gap: 8px;
    }

    .submit-button {
      width: 100%;
    }

    .card-footer {
      flex-direction: column;
      gap: 8px;
    }

    .form-error {
      margin: 16px 0 0;
      color: var(--destructive);
      font-size: 0.875rem;
    }

    @media (max-width: 480px) {
      .login-card {
        width: 100%;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err: { status: number }) => {
        this.loading.set(false);
        this.error.set(authErrorMessage(err.status));
      },
    });
  }
}
