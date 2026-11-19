import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmH1, HlmMuted } from '@spartan-ng/helm/typography';
import { AuthService } from '../../core/auth.service';
import { authErrorMessage } from '../../core/auth-error-message';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, HlmButton, HlmH1, HlmMuted],
  template: `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <a class="brand" routerLink="/" aria-label="POS System home">
          <span class="brand-mark" aria-hidden="true">P</span>
          <span>POS System</span>
        </a>

        <header class="card-heading">
          <h1 hlmH1 id="login-title">Welcome back</h1>
          <p hlmMuted>Sign in to your POS account.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label for="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            formControlName="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          />

          <label for="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
            placeholder="Enter your password"
            required
          />

          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }

          <button hlmBtn type="submit" class="submit-button" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="auth-footer">
          Don't have an account?
          <a routerLink="/signup">Register your store</a>
        </p>
      </section>
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

    .auth-card {
      width: min(100%, 440px);
      padding: 36px;
      border: 1px solid var(--border);
      border-radius: calc(var(--radius) + 8px);
      background: var(--card);
      color: var(--card-foreground);
      box-shadow: 0 24px 70px oklch(0.2 0.03 260 / 10%);
    }

    .brand {
      display: inline-flex;
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

    .card-heading {
      margin: 32px 0 24px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 1.8rem;
    }

    .card-heading p,
    .auth-footer {
      margin: 0;
    }

    form {
      display: grid;
      gap: 10px;
    }

    label {
      margin-top: 8px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    input {
      width: 100%;
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid var(--input);
      border-radius: var(--radius);
      background: var(--background);
      color: var(--foreground);
    }

    input:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .submit-button {
      width: 100%;
      margin-top: 12px;
    }

    .auth-footer {
      margin-top: 24px;
      color: var(--muted-foreground);
      text-align: center;
      font-size: 0.9rem;
    }

    .auth-footer a {
      color: var(--foreground);
      font-weight: 600;
      text-underline-offset: 4px;
    }

    .form-error {
      margin: 8px 0 0;
      color: var(--destructive);
      font-size: 0.875rem;
    }

    @media (max-width: 480px) {
      .auth-card {
        padding: 28px 22px;
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
