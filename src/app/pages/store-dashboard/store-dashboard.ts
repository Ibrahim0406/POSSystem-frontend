import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error-message';
import { toDate } from '../../core/loyalty';
import { StoreOperationsService } from '../../core/store-operations.service';
import { CustomerService } from '../../core/customer.service';
import { Customer } from '../../core/models';
import {
  BranchRequest,
  InventoryRecord,
  StoreBranch,
  StoreCategory,
  StoreEmployee,
  StoreEmployeeRequest,
  StoreOrder,
  StoreProduct,
  StoreRecord,
  StoreRefund,
  StoreShiftReport,
  StoreUserRole,
} from '../../core/store.models';

type DashboardSection =
  | 'overview'
  | 'branches'
  | 'catalog'
  | 'inventory'
  | 'customers'
  | 'employees'
  | 'orders'
  | 'refunds'
  | 'reports';
type DeleteTarget = {
  type: 'branch' | 'product' | 'category' | 'inventory' | 'employee';
  id: number;
};
type ProductDraft = {
  sku: string;
  name: string;
  mrp: string;
  description: string;
  sellingPrice: string;
  brand: string;
  imageUrl: string;
  categoryId: string;
};
type EmployeeDraft = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: StoreUserRole;
  branchId: string;
};

const WORKING_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const EMPTY_BRANCH: BranchRequest = {
  name: '',
  address: '',
  phoneNumber: '',
  email: '',
  workingDays: [],
  openTime: '',
  closeTime: '',
};
const EMPTY_PRODUCT: ProductDraft = {
  sku: '',
  name: '',
  mrp: '',
  description: '',
  sellingPrice: '',
  brand: '',
  imageUrl: '',
  categoryId: '',
};

function blankEmployee(role: StoreUserRole): EmployeeDraft {
  return { fullName: '', email: '', phone: '', password: '', role, branchId: '' };
}

@Component({
  selector: 'app-store-dashboard',
  imports: [DatePipe, CurrencyPipe, HlmButtonImports],
  templateUrl: './store-dashboard.html',
  styleUrl: './store-dashboard.css',
})
export class StoreDashboard {
  private readonly api = inject(StoreOperationsService);
  private readonly customersApi = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly refreshKey = signal(0);
  private branchRequestId = 0;

  readonly store = signal<StoreRecord | null>(null);
  readonly branches = signal<StoreBranch[]>([]);
  readonly selectedBranchId = signal<number | null>(null);
  readonly products = signal<StoreProduct[]>([]);
  readonly categories = signal<StoreCategory[]>([]);
  readonly inventory = signal<InventoryRecord[]>([]);
  readonly employees = signal<StoreEmployee[]>([]);
  readonly orders = signal<StoreOrder[]>([]);
  readonly refunds = signal<StoreRefund[]>([]);
  readonly reports = signal<StoreShiftReport[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly section = signal<DashboardSection>('overview');
  readonly loading = signal(true);
  readonly branchLoading = signal(false);
  readonly actionBusy = signal(false);
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly showBranchForm = signal(false);
  readonly branchEditingId = signal<number | null>(null);
  readonly branchDraft = signal<BranchRequest>({ ...EMPTY_BRANCH, workingDays: [] });
  readonly showCategoryForm = signal(false);
  readonly categoryEditing = signal<StoreCategory | null>(null);
  readonly categoryName = signal('');
  readonly showProductForm = signal(false);
  readonly productEditingId = signal<number | null>(null);
  readonly productDraft = signal<ProductDraft>({ ...EMPTY_PRODUCT });
  readonly showInventoryForm = signal(false);
  readonly inventoryProductId = signal('');
  readonly inventoryQuantity = signal('0');
  readonly inventoryDrafts = signal<Record<number, string | undefined>>({});
  readonly showEmployeeForm = signal(false);
  readonly employeeEditing = signal<StoreEmployee | null>(null);
  readonly employeeDraft = signal<EmployeeDraft>(blankEmployee('ROLE_BRANCH_CASHIER'));
  readonly deleteTarget = signal<DeleteTarget | null>(null);

  readonly role = this.auth.role;
  readonly isStoreAdmin = computed(() => this.role() === 'STORE_ADMIN');
  readonly isStoreManager = computed(() => this.role() === 'STORE_MANAGER');
  readonly isBranchManager = computed(() => this.role() === 'BRANCH_MANAGER');
  readonly canManageCatalog = computed(() => this.isStoreAdmin() || this.isStoreManager());
  readonly canCreateBranch = computed(() => this.canManageCatalog());
  readonly canManageBranches = computed(() => this.canManageCatalog() || this.isBranchManager());
  readonly canManageInventory = computed(() => this.canManageBranches());
  readonly canManageEmployees = computed(() => this.canManageBranches());
  readonly canViewCustomers = computed(() => this.isStoreManager() || this.isStoreAdmin());
  readonly workingDays = WORKING_DAYS;

  constructor() {
    toObservable(computed(() => `${this.auth.scopeKey()}::${this.refreshKey()}`))
      .pipe(
        distinctUntilChanged(),
        switchMap(() => this.loadWorkspace()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  selectSection(section: DashboardSection): void {
    this.section.set(section);
    this.actionError.set('');
    this.notice.set('');
    if (section === 'customers' && this.canViewCustomers()) this.loadCustomers();
  }

  selectBranch(value: string): void {
    if (value === 'all') {
      this.selectedBranchId.set(null);
      this.loadAllBranchData();
      return;
    }
    const branchId = Number(value);
    if (!Number.isInteger(branchId) || !this.branches().some((branch) => branch.id === branchId)) {
      return;
    }
    this.selectedBranchId.set(branchId);
    this.loadBranchData(branchId);
  }

  openCreateBranch(): void {
    if (!this.canCreateBranch()) return;
    this.branchEditingId.set(null);
    this.branchDraft.set({ ...EMPTY_BRANCH, workingDays: [] });
    this.showBranchForm.set(true);
  }

  editBranch(branch: StoreBranch): void {
    this.branchEditingId.set(branch.id);
    this.branchDraft.set({
      name: branch.name ?? '',
      address: branch.address ?? '',
      phoneNumber: branch.phoneNumber ?? '',
      email: branch.email ?? '',
      workingDays: [...(branch.workingDays ?? [])],
      openTime: this.timeInput(branch.openTime),
      closeTime: this.timeInput(branch.closeTime),
    });
    this.showBranchForm.set(true);
  }

  updateBranchField(field: keyof BranchRequest, value: string): void {
    this.branchDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  toggleWorkingDay(day: string, checked: boolean): void {
    this.branchDraft.update((draft) => ({
      ...draft,
      workingDays: checked
        ? [...new Set([...draft.workingDays, day])]
        : draft.workingDays.filter((item) => item !== day),
    }));
  }

  saveBranch(event: Event): void {
    event.preventDefault();
    const storeId = this.store()?.id;
    const draft = this.branchDraft();
    if (!storeId || !draft.workingDays.length) {
      this.actionError.set('Select at least one working day.');
      return;
    }
    const payload: BranchRequest = {
      ...draft,
      name: draft.name.trim(),
      address: draft.address.trim(),
      phoneNumber: draft.phoneNumber.trim(),
      email: draft.email.trim(),
      openTime: this.timeRequest(draft.openTime),
      closeTime: this.timeRequest(draft.closeTime),
    };
    const id = this.branchEditingId();
    const request = id ? this.api.updateBranch(id, payload) : this.api.createBranch(payload);
    this.mutate(request, id ? 'Branch updated.' : 'Branch created.', () => {
      this.showBranchForm.set(false);
      this.refreshWorkspace();
    });
  }

  openCreateCategory(): void {
    if (!this.canManageCatalog()) return;
    this.categoryEditing.set(null);
    this.categoryName.set('');
    this.showCategoryForm.set(true);
  }

  editCategory(category: StoreCategory): void {
    if (!category.id) return;
    this.categoryEditing.set(category);
    this.categoryName.set(category.name);
    this.showCategoryForm.set(true);
  }

  saveCategory(event: Event): void {
    event.preventDefault();
    const storeId = this.store()?.id;
    const name = this.categoryName().trim();
    if (!storeId || !name) return;
    const category = this.categoryEditing();
    const request = category?.id
      ? this.api.updateCategory(category.id, { name })
      : this.api.createCategory({ name, storeId });
    this.mutate(request, category ? 'Category updated.' : 'Category created.', () => {
      this.showCategoryForm.set(false);
      this.refreshWorkspace();
    });
  }

  openCreateProduct(): void {
    if (!this.canManageCatalog()) return;
    this.productEditingId.set(null);
    this.productDraft.set({ ...EMPTY_PRODUCT });
    this.showProductForm.set(true);
  }

  editProduct(product: StoreProduct): void {
    this.productEditingId.set(product.id);
    this.productDraft.set({
      sku: product.sku ?? '',
      name: product.name ?? '',
      mrp: product.mrp == null ? '' : String(product.mrp),
      description: product.description ?? '',
      sellingPrice: product.sellingPrice == null ? '' : String(product.sellingPrice),
      brand: product.brand ?? '',
      imageUrl: product.imageUrl ?? '',
      categoryId: product.categoryId == null ? '' : String(product.categoryId),
    });
    this.showProductForm.set(true);
  }

  updateProductField(field: keyof ProductDraft, value: string): void {
    this.productDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  saveProduct(event: Event): void {
    event.preventDefault();
    const storeId = this.store()?.id;
    const draft = this.productDraft();
    const sellingPrice = Number(draft.sellingPrice);
    const mrp = Number(draft.mrp);
    const categoryId = Number(draft.categoryId);
    if (
      !storeId ||
      !draft.sku.trim() ||
      !draft.name.trim() ||
      !draft.mrp.trim() ||
      !draft.sellingPrice.trim() ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(mrp) ||
      sellingPrice < 0 ||
      mrp < 0 ||
      (this.productEditingId() === null &&
        (!draft.categoryId || !Number.isInteger(categoryId) || categoryId <= 0))
    ) {
      this.actionError.set(
        'Enter the required product details and a valid category ID for a new product.',
      );
      return;
    }
    const payload: Omit<StoreProduct, 'id' | 'category'> = {
      sku: draft.sku.trim(),
      name: draft.name.trim(),
      mrp,
      description: draft.description.trim(),
      sellingPrice,
      brand: draft.brand.trim(),
      imageUrl: draft.imageUrl.trim(),
      storeId,
      ...(draft.categoryId ? { categoryId } : {}),
    };
    const id = this.productEditingId();
    const request = id ? this.api.updateProduct(id, payload) : this.api.createProduct(payload);
    this.mutate(request, id ? 'Product updated.' : 'Product created.', () => {
      this.showProductForm.set(false);
      this.refreshWorkspace();
    });
  }

  openCreateInventory(): void {
    if (!this.selectedBranchId() || !this.canManageInventory()) return;
    this.inventoryProductId.set('');
    this.inventoryQuantity.set('0');
    this.showInventoryForm.set(true);
  }

  saveInventory(event: Event): void {
    event.preventDefault();
    const branchId = this.selectedBranchId();
    const productId = Number(this.inventoryProductId());
    const quantity = Number(this.inventoryQuantity());
    if (
      !branchId ||
      !Number.isInteger(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !this.products().some((product) => product.id === productId)
    ) {
      this.actionError.set('Choose a product from this store and enter a valid quantity.');
      return;
    }
    this.mutate(
      this.api.createInventory({ branchId, productId, quantity }),
      'Inventory entry created.',
      () => {
        this.showInventoryForm.set(false);
        this.loadBranchData(branchId);
      },
    );
  }

  setInventoryDraft(id: number, value: string): void {
    this.inventoryDrafts.update((drafts) => ({ ...drafts, [id]: value }));
  }

  saveInventoryQuantity(entry: InventoryRecord): void {
    const quantity = Number(this.inventoryDrafts()[entry.id] ?? entry.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      this.actionError.set('Quantity must be a non-negative whole number.');
      return;
    }
    const branchId = this.selectedBranchId();
    this.mutate(this.api.updateInventory(entry.id, { quantity }), 'Stock quantity updated.', () => {
      if (branchId) this.loadBranchData(branchId);
    });
  }

  employeeRolesForCreation(): StoreUserRole[] {
    if (this.isBranchManager()) return ['ROLE_BRANCH_CASHIER'];
    if (this.isStoreManager()) return ['ROLE_BRANCH_MANAGER', 'ROLE_BRANCH_CASHIER'];
    return ['ROLE_STORE_MANAGER', 'ROLE_BRANCH_MANAGER', 'ROLE_BRANCH_CASHIER'];
  }

  employeeRolesForEdit(): StoreUserRole[] {
    return this.employeeRolesForCreation().filter(
      (role) => role !== 'ROLE_STORE_MANAGER' || this.isStoreAdmin(),
    );
  }

  canEditEmployee(employee: StoreEmployee): boolean {
    if (employee.role === 'ROLE_STORE_ADMIN') return false;
    if (employee.role === 'ROLE_STORE_MANAGER') return false;
    if (this.isBranchManager()) return employee.role === 'ROLE_BRANCH_CASHIER';
    if (this.isStoreManager()) return true;
    return true;
  }

  openCreateEmployee(): void {
    if (!this.canManageEmployees()) return;
    this.employeeEditing.set(null);
    this.employeeDraft.set(blankEmployee(this.employeeRolesForCreation()[0]));
    this.showEmployeeForm.set(true);
  }

  editEmployee(employee: StoreEmployee): void {
    if (!this.canEditEmployee(employee)) return;
    this.employeeEditing.set(employee);
    this.employeeDraft.set({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? '',
      password: '',
      role: employee.role,
      branchId: employee.branchId == null ? '' : String(employee.branchId),
    });
  }

  toggleEmployeeStatus(employee: StoreEmployee): void {
    if (!this.canEditEmployee(employee)) return;
    const status = (employee.status || 'ACTIVE') === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (status === 'DISABLED' && !window.confirm(`Deactivate ${employee.fullName}?`)) return;

    const payload: StoreEmployeeRequest = {
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? '',
      role: employee.role,
      status,
      ...(employee.branchId != null ? { branchId: employee.branchId } : {}),
    };
    this.mutate(
      this.api.updateEmployee(employee.id, payload),
      status === 'DISABLED' ? 'Employee deactivated.' : 'Employee activated.',
      () => this.refreshWorkspace(),
    );
    this.showEmployeeForm.set(true);
  }

  updateEmployeeField(field: keyof EmployeeDraft, value: string): void {
    this.employeeDraft.update((draft) => ({
      ...draft,
      [field]: field === 'role' ? (value as StoreUserRole) : value,
    }));
  }

  saveEmployee(event: Event): void {
    event.preventDefault();
    const draft = this.employeeDraft();
    const storeId = this.store()?.id;
    const branchId = Number(draft.branchId || this.selectedBranchId());
    const editing = this.employeeEditing();
    const isStoreManagerRole = draft.role === 'ROLE_STORE_MANAGER';
    if (this.isStoreManager() && !['ROLE_BRANCH_MANAGER', 'ROLE_BRANCH_CASHIER'].includes(draft.role)) {
      this.actionError.set('Store Managers can only manage Branch Managers and Branch Cashiers.');
      return;
    }
    if (
      !storeId ||
      !draft.fullName.trim() ||
      !draft.email.trim() ||
      (!editing && !draft.password.trim()) ||
      (!isStoreManagerRole && (!Number.isInteger(branchId) || branchId <= 0))
    ) {
      this.actionError.set('Complete the required employee details and select a branch.');
      return;
    }
    const payload: StoreEmployeeRequest = {
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      role: draft.role,
      ...(draft.password.trim() ? { password: draft.password } : {}),
      ...(!isStoreManagerRole ? { branchId } : {}),
    };
    let request: Observable<StoreEmployee>;
    if (editing) {
      request = this.api.updateEmployee(editing.id, payload);
    } else if (isStoreManagerRole) {
      request = this.api.createStoreEmployee(storeId, payload);
    } else {
      request = this.api.createBranchEmployee(branchId, payload);
    }
    this.mutate(request, editing ? 'Employee updated.' : 'Employee created.', () => {
      this.showEmployeeForm.set(false);
      this.refreshWorkspace();
    });
  }

  requestDelete(target: DeleteTarget): void {
    if (
      target.type === 'category' &&
      !this.categories().find((item) => item.id === target.id)?.id
    ) {
      return;
    }
    this.deleteTarget.set(target);
    this.actionError.set('');
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    const requests: Record<DeleteTarget['type'], (id: number) => Observable<unknown>> = {
      branch: (id) => this.api.deleteBranch(id),
      product: (id) => this.api.deleteProduct(id),
      category: (id) => this.api.deleteCategory(id),
      inventory: (id) => this.api.deleteInventory(id),
      employee: (id) => this.api.deleteEmployee(id),
    };
    this.mutate(requests[target.type](target.id), 'Item deleted.', () => {
      this.deleteTarget.set(null);
      this.refreshWorkspace();
    });
  }

  date(value: string | number[] | null | undefined): Date | null {
    return toDate(value);
  }

  productName(id: number): string {
    return this.products().find((product) => product.id === id)?.name ?? `Product #${id}`;
  }

  productSku(id: number): string {
    return this.products().find((product) => product.id === id)?.sku ?? '—';
  }

  branchName(id: number | null | undefined): string {
    if (id == null) return 'Store';
    return this.branches().find((branch) => branch.id === id)?.name ?? `Branch #${id}`;
  }

  timeInput(value: string | number[] | null | undefined): string {
    if (Array.isArray(value)) {
      const [hours, minutes = 0] = value;
      return `${String(hours ?? 0).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return value?.slice(0, 5) ?? '';
  }

  private loadWorkspace(): Observable<unknown> {
    this.clearTenantData();
    this.loading.set(true);
    this.actionError.set('');
    this.notice.set('');

    const role = this.auth.role();
    if (!role || !['STORE_ADMIN', 'STORE_MANAGER', 'BRANCH_MANAGER'].includes(role)) {
      this.loading.set(false);
      return EMPTY;
    }
    if (
      (role === 'STORE_MANAGER' && this.auth.user()?.storeId == null) ||
      (role === 'BRANCH_MANAGER' && this.auth.user()?.branchId == null)
    ) {
      this.loading.set(false);
      this.actionError.set('Your account is not assigned to a store or branch.');
      return EMPTY;
    }
    const scope = this.auth.scopeKey();
    const storeRequest =
      role === 'STORE_ADMIN' ? this.api.getStoreForAdmin() : this.api.getStoreForEmployee();

    return storeRequest.pipe(
      tap((store) => this.store.set(store)),
      switchMap((store) => {
        const branchesRequest =
          role === 'BRANCH_MANAGER'
            ? this.auth.user()?.branchId
              ? this.api.getBranch(this.auth.user()!.branchId!).pipe(map((branch) => [branch]))
              : of([] as StoreBranch[])
            : this.api.getBranches(store.id);
        return branchesRequest.pipe(
          switchMap((branches) => {
            if (scope !== this.auth.scopeKey()) return EMPTY;
            this.branches.set(branches);
            const assignedBranchId = this.auth.user()?.branchId;
            const selected =
              branches.find((branch) => branch.id === assignedBranchId) ?? branches[0] ?? null;
            this.selectedBranchId.set(selected?.id ?? null);

            const productsRequest = this.api.getProducts(store.id);
            const categoriesRequest = this.canManageCatalog()
              ? this.api.getCategories(store.id)
              : of([] as StoreCategory[]);
            const employeesRequest = this.isBranchManager()
              ? selected
                ? this.api.getBranchEmployees(selected.id)
                : of([] as StoreEmployee[])
              : this.api.getStoreEmployees(store.id);

            return forkJoin({
              products: productsRequest,
              categories: categoriesRequest,
              employees: employeesRequest,
            }).pipe(
              tap((result) => {
                if (scope !== this.auth.scopeKey()) return;
                this.products.set(result.products);
                this.categories.set(result.categories);
                this.employees.set(result.employees);
                if (selected) this.loadBranchData(selected.id);
              }),
            );
          }),
        );
      }),
      catchError((error: unknown) => {
        this.handleError(error, 'Unable to load this store workspace.');
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  private loadAllBranchData(): void {
    const scope = this.auth.scopeKey();
    const branches = this.branches();
    if (!branches.length) {
      this.inventory.set([]);
      this.orders.set([]);
      this.refunds.set([]);
      this.reports.set([]);
      return;
    }
    this.branchLoading.set(true);
    forkJoin(
      branches.map((branch) =>
        forkJoin({
          inventory: this.api.getInventory(branch.id),
          orders: this.api.getOrders(branch.id),
          refunds: this.api.getRefunds(branch.id),
          reports: this.api.getShiftReports(branch.id),
        }),
      ),
    )
      .pipe(finalize(() => this.branchLoading.set(false)))
      .subscribe({
        next: (results) => {
          if (scope !== this.auth.scopeKey() || this.selectedBranchId() !== null) return;
          this.inventory.set(results.flatMap((result) => result.inventory));
          this.orders.set(results.flatMap((result) => result.orders));
          this.refunds.set(results.flatMap((result) => result.refunds));
          this.reports.set(results.flatMap((result) => result.reports));
        },
        error: (error: unknown) => {
          if (scope !== this.auth.scopeKey()) return;
          this.inventory.set([]);
          this.orders.set([]);
          this.refunds.set([]);
          this.reports.set([]);
          this.handleError(error, 'Unable to load data for the store branches.');
        },
      });
  }

  private loadBranchData(branchId: number): void {
    const requestId = ++this.branchRequestId;
    const scope = this.auth.scopeKey();
    this.branchLoading.set(true);
    this.inventory.set([]);
    this.orders.set([]);
    this.refunds.set([]);
    this.reports.set([]);
    this.customers.set([]);
    this.inventoryDrafts.set({});
    forkJoin({
      inventory: this.api.getInventory(branchId),
      orders: this.api.getOrders(branchId),
      refunds: this.api.getRefunds(branchId),
      reports: this.api.getShiftReports(branchId),
    })
      .pipe(
        finalize(() => {
          if (requestId === this.branchRequestId) this.branchLoading.set(false);
        }),
      )
      .subscribe({
        next: (data) => {
          if (
            requestId !== this.branchRequestId ||
            scope !== this.auth.scopeKey() ||
            branchId !== this.selectedBranchId()
          )
            return;
          this.inventory.set(data.inventory);
          this.orders.set(data.orders);
          this.refunds.set(data.refunds);
          this.reports.set(data.reports);
        },
        error: (error: unknown) => {
          if (
            requestId !== this.branchRequestId ||
            scope !== this.auth.scopeKey() ||
            branchId !== this.selectedBranchId()
          )
            return;
          this.inventory.set([]);
          this.orders.set([]);
          this.refunds.set([]);
          this.reports.set([]);
          this.handleError(error, 'Unable to load this branch data.');
        },
      });
  }

  private loadCustomers(): void {
    const scope = this.auth.scopeKey();
    this.customers.set([]);
    this.customersApi.getAll().subscribe({
      next: (customers) => {
        if (scope === this.auth.scopeKey()) this.customers.set(customers);
      },
      error: (error: unknown) => {
        if (scope !== this.auth.scopeKey()) return;
        this.customers.set([]);
        this.handleError(error, 'Store customers could not be loaded.');
      },
    });
  }

  private mutate<T>(request: Observable<T>, success: string, afterSuccess: () => void): void {
    this.actionBusy.set(true);
    this.actionError.set('');
    this.notice.set('');
    request.pipe(finalize(() => this.actionBusy.set(false))).subscribe({
      next: () => {
        this.notice.set(success);
        afterSuccess();
      },
      error: (error: unknown) => this.handleError(error, 'The operation could not be completed.'),
    });
  }

  private handleError(error: unknown, fallback: string): void {
    const message = apiErrorMessage(error, fallback);
    this.actionError.set(message);
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.clearTenantData();
    }
  }

  private clearTenantData(): void {
    this.branchRequestId++;
    this.loading.set(false);
    this.branchLoading.set(false);
    this.section.set('overview');
    this.showBranchForm.set(false);
    this.branchEditingId.set(null);
    this.branchDraft.set({ ...EMPTY_BRANCH, workingDays: [] });
    this.showCategoryForm.set(false);
    this.categoryEditing.set(null);
    this.categoryName.set('');
    this.showProductForm.set(false);
    this.productEditingId.set(null);
    this.productDraft.set({ ...EMPTY_PRODUCT });
    this.showInventoryForm.set(false);
    this.inventoryProductId.set('');
    this.inventoryQuantity.set('0');
    this.showEmployeeForm.set(false);
    this.employeeEditing.set(null);
    this.employeeDraft.set(blankEmployee('ROLE_BRANCH_CASHIER'));
    this.deleteTarget.set(null);
    this.inventoryDrafts.set({});
    this.store.set(null);
    this.branches.set([]);
    this.selectedBranchId.set(null);
    this.products.set([]);
    this.categories.set([]);
    this.inventory.set([]);
    this.employees.set([]);
    this.orders.set([]);
    this.refunds.set([]);
    this.reports.set([]);
  }

  private refreshWorkspace(): void {
    this.refreshKey.update((value) => value + 1);
  }

  private timeRequest(value: string): string {
    return value ? `${value}:00` : value;
  }
}
