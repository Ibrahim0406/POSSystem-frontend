import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CustomerForm } from '../../shared/customer-form';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { CustomerService } from '../../core/customer.service';
import { Customer, PaymentType, Product } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';

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
    const branchId = this.auth.user()?.branchId;
    if (branchId == null) {
      this.error.set('Your account is not assigned to a branch. Please sign in again.');
      this.loadingProducts.set(false);
      return;
    }

    this.branches.getById(branchId).subscribe({
      next: (branch) => {
        this.productsApi.getByStore(branch.storeId).subscribe({
          next: (products) => {
            this.products.set(products);
            this.loadingProducts.set(false);
          },
          error: () => {
            this.error.set('Products could not be loaded. Please try again.');
            this.loadingProducts.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Branch details could not be loaded. Please try again.');
        this.loadingProducts.set(false);
      },
    });
  }

  loadCustomers() {
    this.customersApi.getAll().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.error.set('Customers could not be loaded. Please try again.');
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

    this.error.set('');
    this.success.set('');
    this.submitting.set(true);
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
          this.submitting.set(false);
          this.success.set(`Order #${order.id} created successfully.`);
          this.cart.set([]);
          this.discountPercent.set(0);
          this.note.set('');
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('The order could not be created. Please check your connection and retry.');
        },
      });
  }

  productInitial(product: Product) {
    return product.name.trim().charAt(0).toUpperCase() || '?';
  }
}
