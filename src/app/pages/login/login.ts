import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { HlmButton } from '@spartan-ng/helm/button/src';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, HlmButton],
  template: `
    <div class="wrap">
      <form class="card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Customer Management</h1>
        <p class="muted">Prijavite se POS računom</p>
        <label>Email <input type="email" formControlName="email" /></label>
        <label>Lozinka <input type="password" formControlName="password" /></label>
        @if (error()) {
          <div class="alert">{{ error() }}</div>
        }
        <button hlmBtn [disabled]="form.invalid || loading()">
          {{ loading() ? 'Prijava…' : 'Prijavi se' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .card {
      background: #fff;
      padding: 32px;
      border-radius: 16px;
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
    }
    h1 {
      margin: 0;
      font-size: 22px;
    }
    p {
      margin: 0 0 6px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
  `,
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/customers']),
      error: (err) => {
        this.loading.set(false);
        const backendDown =
          err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
        this.error.set(
          backendDown
            ? 'Backend nije dostupan na localhost:8080. Provjerite da li je pokrenut.'
            : `Prijava nije uspjela (HTTP ${err.status}). Provjerite email/lozinku i backend log.`,
        );
      },
    });
  }
}
