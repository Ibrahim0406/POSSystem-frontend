import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CustomerForm } from '../../shared/customer-form';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { CustomerService } from '../../core/customer.service';
import { Customer, PaymentType, Product } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { apiErrorMessage } from '../../core/api-error-message';

interface CartItem {
  product: Product;
  quantity: number;
}

@Component({
  selector: 'app-cashier-dashboard',
  imports: [CurrencyPipe, CustomerForm],
  templateUrl: './cashier-dashboard.html',
  styleUrl: './cashier-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashierDashboard {
  private readonly auth = inject(AuthService);
  private readonly branches = inject(BranchService);
  private readonly customersApi = inject(CustomerService);
  private readonly ordersApi = inject(OrderService);
  private readonly productsApi = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly cart = signal<CartItem[]>([]);
  readonly search = signal('');
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly discountPercent = signal(0);
  readonly note = signal('');
  readonly paymentType = signal<PaymentType>('CASH');
  readonly loadingProducts = signal(true);
  readonly loadingCustomers = signal(true);
  readonly submitting = signal(false);
  readonly showCustomerForm = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly filteredProducts = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    if (!query) return this.products();
    return this.products().filter((product) =>
      [product.name, product.sku, product.brand ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  });
  readonly itemCount = computed(() =>
    this.cart().reduce((total, item) => total + item.quantity, 0),
  );
  readonly subtotal = computed(() =>
    this.cart().reduce(
      (total, item) => total + (item.product.sellingPrice ?? 0) * item.quantity,
      0,
    ),
  );
  readonly discountAmount = computed(() => (this.subtotal() * this.discountPercent()) / 100);
  readonly total = computed(() => this.subtotal() - this.discountAmount());

  constructor() {
    this.loadCustomers();
    this.loadProducts();
  }

  loadProducts() {
    const user = this.auth.user();
    const branchId = user?.branchId;
    const scope = this.auth.scopeKey();
    this.products.set([]);
    this.cart.set([]);
    if (branchId == null) {
      this.error.set('Your account is not assigned to a branch. Please sign in again.');
      this.loadingProducts.set(false);
      return;
    }

    this.branches.getById(branchId).subscribe({
      next: (branch) => {
        if (scope !== this.auth.scopeKey()) return;
        if (user?.storeId != null && branch.storeId !== user.storeId) {
          this.error.set('The branch does not belong to your assigned store.');
          this.loadingProducts.set(false);
          return;
        }
        this.productsApi.getByStore(branch.storeId).subscribe({
          next: (products) => {
            if (scope !== this.auth.scopeKey()) return;
            this.products.set(products);
            this.loadingProducts.set(false);
          },
          error: (error: unknown) => {
            if (scope !== this.auth.scopeKey()) return;
            this.products.set([]);
            this.error.set(apiErrorMessage(error, 'Products could not be loaded. Please try again.'));
            this.loadingProducts.set(false);
          },
        });
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.products.set([]);
        this.error.set(
          apiErrorMessage(error, 'Branch details could not be loaded. Please try again.'),
        );
        this.loadingProducts.set(false);
      },
    });
  }

  loadCustomers() {
    const scope = this.auth.scopeKey();
    this.customers.set([]);
    this.selectedCustomer.set(null);
    this.customersApi.getAll().subscribe({
      next: (customers) => {
        if (scope !== this.auth.scopeKey()) return;
        this.customers.set(customers);
        this.loadingCustomers.set(false);
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.customers.set([]);
        this.error.set(apiErrorMessage(error, 'Customers could not be loaded. Please try again.'));
        this.loadingCustomers.set(false);
      },
    });
  }

  addProduct(product: Product) {
    if (product.sellingPrice == null || !Number.isFinite(product.sellingPrice)) {
      this.error.set(`${product.name} has no valid selling price and cannot be added.`);
      return;
    }

    this.cart.update((items) => {
      const current = items.find((item) => item.product.id === product.id);
      if (current) {
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { product, quantity: 1 }];
    });
    this.error.set('');
  }

  changeQuantity(productId: number, amount: number) {
    this.cart.update((items) =>
      items
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + amount) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  removeProduct(productId: number) {
    this.cart.update((items) => items.filter((item) => item.product.id !== productId));
  }

  clearCart() {
    if (!this.cart().length || !window.confirm('Are you sure you want to clear the cart?')) return;
    this.cart.set([]);
  }

  setDiscount(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.discountPercent.set(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
  }

  selectCustomer(customerId: string) {
    this.selectedCustomer.set(
      this.customers().find((customer) => String(customer.id) === customerId) ?? null,
    );
  }

  onCustomerSaved(customer: Customer) {
    this.showCustomerForm.set(false);
    this.customers.update((items) => [
      customer,
      ...items.filter((item) => item.id !== customer.id),
    ]);
    this.selectedCustomer.set(customer);
  }

  startNewOrder() {
    this.cart.set([]);
    this.selectedCustomer.set(null);
    this.discountPercent.set(0);
    this.note.set('');
    this.error.set('');
    this.success.set('');
  }

  proceedPayment() {
    if (!this.cart().length || this.discountPercent() > 0 || this.submitting()) return;
    if (!this.auth.canRefund()) {
      this.error.set('Order creation is only available to cashiers assigned to a branch.');
      return;
    }

    this.error.set('');
    this.success.set('');
    this.submitting.set(true);
    const scope = this.auth.scopeKey();
    this.ordersApi
      .createOrder({
        customer: this.selectedCustomer()?.id ? { id: this.selectedCustomer()!.id! } : null,
        paymentType: this.paymentType(),
        items: this.cart().map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
          price: (product.sellingPrice ?? 0) * quantity,
        })),
      })
      .subscribe({
        next: (order) => {
          if (scope !== this.auth.scopeKey()) return;
          this.submitting.set(false);
          this.success.set(`Order #${order.id} created successfully.`);
          this.cart.set([]);
          this.discountPercent.set(0);
          this.note.set('');
        },
        error: (error: unknown) => {
          if (scope !== this.auth.scopeKey()) return;
          this.submitting.set(false);
          this.error.set(
            apiErrorMessage(
              error,
              'The order could not be created. Please check your connection and retry.',
            ),
          );
        },
      });
  }

  productInitial(product: Product) {
    return product.name.trim().charAt(0).toUpperCase() || '?';
  }
}
