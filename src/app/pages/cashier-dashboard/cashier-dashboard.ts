import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { distinctUntilChanged, forkJoin, skip } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { Customer, Order, PaymentType, Product } from '../../core/models';
import { OrderService } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { StoreOperationsService } from '../../core/store-operations.service';
import { apiErrorMessage } from '../../core/api-error-message';
import { toDate } from '../../core/loyalty';
import { CustomerForm } from '../../shared/customer-form';

interface CashierProduct extends Product {
  availableQuantity: number;
}

interface CartItem {
  product: CashierProduct;
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
  private readonly ordersApi = inject(OrderService);
  private readonly productsApi = inject(ProductService);
  private readonly storeApi = inject(StoreOperationsService);

  readonly canCreateCustomers = this.auth.canCreateCustomers;
  readonly products = signal<CashierProduct[]>([]);
  readonly recentOrders = signal<Order[]>([]);
  readonly cart = signal<CartItem[]>([]);
  readonly search = signal('');
  readonly paymentType = signal<PaymentType>('CASH');
  readonly loadingProducts = signal(true);
  readonly loadingOrders = signal(true);
  readonly submitting = signal(false);
  readonly showCustomerForm = signal(false);
  readonly orderError = signal('');
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
  readonly total = computed(() => this.subtotal());

  constructor() {
    this.loadProducts();
    this.loadOrders();
    toObservable(computed(() => this.auth.scopeKey()))
      .pipe(distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => {
        this.clearTenantState();
        if (this.auth.isLoggedIn() && this.auth.role() === 'BRANCH_CASHIER') {
          this.loadProducts();
          this.loadOrders();
        }
      });
  }

  private clearTenantState() {
    this.products.set([]);
    this.recentOrders.set([]);
    this.cart.set([]);
    this.search.set('');
    this.loadingProducts.set(false);
    this.loadingOrders.set(false);
    this.submitting.set(false);
    this.orderError.set('');
    this.error.set('');
    this.success.set('');
    this.showCustomerForm.set(false);
  }

  openCustomerForm() {
    if (this.canCreateCustomers()) this.showCustomerForm.set(true);
  }

  onCustomerSaved(_customer: Customer) {
    this.showCustomerForm.set(false);
    this.success.set('Customer created successfully.');
  }

  loadProducts() {
    const user = this.auth.user();
    const branchId = user?.branchId;
    const scope = this.auth.scopeKey();
    this.products.set([]);
    this.cart.set([]);
    this.loadingProducts.set(true);
    if (branchId == null) {
      this.error.set('Your account is not assigned to a branch. Please sign in again.');
      this.loadingProducts.set(false);
      return;
    }

    this.branches.getById(branchId).subscribe({
      next: (branch) => {
        if (scope !== this.auth.scopeKey()) return;
        if (branch.id !== branchId || (user?.storeId != null && branch.storeId !== user.storeId)) {
          this.products.set([]);
          this.cart.set([]);
          this.error.set('The branch does not belong to your assigned store.');
          this.loadingProducts.set(false);
          return;
        }
        forkJoin({
          products: this.productsApi.getByStore(branch.storeId),
          inventory: this.storeApi.getInventory(branchId),
        }).subscribe({
          next: ({ products, inventory }) => {
            if (scope !== this.auth.scopeKey()) return;
            if (inventory.some((entry) => entry.branchId !== branchId)) {
              this.products.set([]);
              this.cart.set([]);
              this.error.set('Inventory data contains items outside your assigned branch.');
              this.loadingProducts.set(false);
              return;
            }
            const quantities = new Map(
              inventory.map((entry) => [entry.productId, Math.max(0, entry.quantity)]),
            );
            const branchProducts = products
              .filter(
                (product) =>
                  quantities.has(product.id) &&
                  (product.storeId == null || product.storeId === branch.storeId),
              )
              .map((product) => ({
                ...product,
                availableQuantity: quantities.get(product.id) ?? 0,
              }));
            this.products.set(branchProducts);
            const availableProductIds = new Set(branchProducts.map((product) => product.id));
            this.cart.update((items) =>
              items
                .filter((item) => availableProductIds.has(item.product.id))
                .map((item) => {
                  const product = branchProducts.find((entry) => entry.id === item.product.id)!;
                  return {
                    product,
                    quantity: Math.min(item.quantity, product.availableQuantity),
                  };
                })
                .filter((item) => item.quantity > 0),
            );
            this.loadingProducts.set(false);
          },
          error: (error: unknown) => {
            if (scope !== this.auth.scopeKey()) return;
            this.products.set([]);
            this.cart.set([]);
            this.error.set(
              apiErrorMessage(
                error,
                'Products and branch inventory could not be loaded. Please try again.',
              ),
            );
            this.loadingProducts.set(false);
          },
        });
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.products.set([]);
        this.cart.set([]);
        this.error.set(
          apiErrorMessage(error, 'Branch details could not be loaded. Please try again.'),
        );
        this.loadingProducts.set(false);
      },
    });
  }

  loadOrders() {
    const user = this.auth.user();
    const scope = this.auth.scopeKey();
    this.loadingOrders.set(true);
    this.recentOrders.set([]);
    this.orderError.set('');
    if (user?.branchId == null || user.id == null) {
      this.orderError.set('Unable to identify your cashier and branch.');
      this.loadingOrders.set(false);
      return;
    }

    this.ordersApi.getByBranch(user.branchId).subscribe({
      next: (orders) => {
        if (scope !== this.auth.scopeKey()) return;
        this.recentOrders.set(
          orders
            .filter(
              (order) =>
                (order.branch?.id ?? order.branchId) === user.branchId &&
                (order.cashier?.id ?? order.cashierId) === user.id,
            )
            .sort(
              (a, b) =>
                (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
            )
            .slice(0, 5),
        );
        this.loadingOrders.set(false);
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.recentOrders.set([]);
        this.orderError.set(
          apiErrorMessage(error, 'Your recent orders could not be loaded. Please try again.'),
        );
        this.loadingOrders.set(false);
      },
    });
  }

  addProduct(product: CashierProduct) {
    if (
      product.sellingPrice == null ||
      !Number.isFinite(product.sellingPrice) ||
      product.availableQuantity <= 0
    ) {
      this.error.set(`${product.name} is not available in this branch.`);
      return;
    }

    this.cart.update((items) => {
      const current = items.find((item) => item.product.id === product.id);
      if (current) {
        if (current.quantity >= product.availableQuantity) return items;
        return items.map((item) =>
          item.product.id === product.id ? { ...item, product, quantity: item.quantity + 1 } : item,
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
            ? {
                ...item,
                quantity: Math.max(
                  0,
                  Math.min(item.product.availableQuantity, item.quantity + amount),
                ),
              }
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

  isAtStockLimit(product: CashierProduct) {
    return (
      (this.cart().find((item) => item.product.id === product.id)?.quantity ?? 0) >=
      product.availableQuantity
    );
  }

  startNewOrder() {
    this.cart.set([]);
    this.error.set('');
    this.success.set('');
  }

  proceedPayment() {
    if (!this.cart().length || this.submitting()) return;
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
        customer: null,
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
          this.loadProducts();
          this.loadOrders();
        },
        error: (error: unknown) => {
          if (scope !== this.auth.scopeKey()) return;
          this.submitting.set(false);
          if (error instanceof HttpErrorResponse && [400, 409].includes(error.status)) {
            this.error.set(
              error.status === 409
                ? 'Order rejected: stock or order state changed. Refresh branch stock and try again.'
                : 'Order rejected: one or more items, quantities or prices are no longer valid.',
            );
            return;
          }
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
