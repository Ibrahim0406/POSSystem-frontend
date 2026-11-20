import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer } from '../core/models';
import { CustomerService } from '../core/customer.service';
import { HlmButton } from '@spartan-ng/helm/button/src';
import { apiErrorMessage } from '../core/api-error-message';
@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, HlmButton],
  template: `
    <div class="backdrop" (click)="closed.emit()">
      <form
        class="modal"
        [formGroup]="form"
        (ngSubmit)="submit()"
        (click)="$event.stopPropagation()"
      >
        <h2>
          {{
            language() === 'en'
              ? customer()
                ? 'Edit customer'
                : 'New customer'
              : customer()
                ? 'Uredi kupca'
                : 'Novi kupac'
          }}
        </h2>

        <label
          >{{ language() === 'en' ? 'Full name *' : 'Ime i prezime *' }}
          <input
            formControlName="fullName"
            [placeholder]="language() === 'en' ? 'e.g. Alex Morgan' : 'npr. Amar Hadžić'"
            autofocus
          />
        </label>
        @if (form.controls.fullName.touched && form.controls.fullName.invalid) {
          <small class="err">{{ language() === 'en' ? 'Name is required.' : 'Ime je obavezno.' }}</small>
        }

        <label
          >Email
          <input
            formControlName="email"
            type="email"
            [placeholder]="language() === 'en' ? 'alex@example.com' : 'amar@example.com'"
          />
        </label>
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <small class="err">
            {{ language() === 'en' ? 'Enter a valid email address.' : 'Unesite ispravan email.' }}
          </small>
        }

        <label
          >{{ language() === 'en' ? 'Phone' : 'Telefon' }}
          <input formControlName="phone" placeholder="+387 61 123 456" />
        </label>

        @if (error()) {
          <div class="alert">{{ error() }}</div>
        }

        <div class="actions">
          <button type="button" hlmBtn variant="outline" (click)="closed.emit()">
            {{ language() === 'en' ? 'Cancel' : 'Odustani' }}
          </button>
          <button type="submit" hlmBtn [disabled]="saving()">
            {{
              saving()
                ? language() === 'en'
                  ? 'Saving…'
                  : 'Spremam…'
                : language() === 'en'
                  ? 'Save'
                  : 'Spremi'
            }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: grid;
      place-items: center;
      z-index: 50;
      padding: 16px;
    }
    .modal {
      background: #fff;
      border-radius: 14px;
      padding: 24px;
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    }
    h2 {
      margin: 0 0 6px;
      font-size: 20px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .err {
      color: #dc2626;
      margin-top: -6px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 10px;
    }
  `,
})
export class CustomerForm {
  private fb = inject(FormBuilder);
  private api = inject(CustomerService);

  customer = input<Customer | null>(null);
  language = input<'bs' | 'en'>('bs');
  saved = output<Customer>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
  });

  ngOnInit() {
    const c = this.customer();
    if (c)
      this.form.patchValue({ fullName: c.fullName, email: c.email ?? '', phone: c.phone ?? '' });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: Customer = {
      fullName: v.fullName.trim(),
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
    };
    const existing = this.customer();
    this.saving.set(true);
    this.error.set('');

    const req = existing?.id
      ? this.api.update(existing.id, payload)
      : this.api.create({ ...payload, createdAt: new Date().toISOString().slice(0, 19) });

    req.subscribe({
      next: (c) => {
        this.saving.set(false);
        this.saved.emit(c);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            this.language() === 'en'
              ? 'Could not save the customer. Please try again.'
              : 'Spremanje nije uspjelo. Pokušajte ponovo.',
          ),
        );
      },
    });
  }
}
