import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { finalize } from 'rxjs';
import {
  AccountStatus,
  AdminAuditLog,
  AdminDashboardData,
  AdminStore,
  AdminUser,
  AdminUserRole,
  Branch,
  BranchCreateRequest,
  StoreStatus,
  StoreCreateRequest,
  SupportReport,
  SupportReportStatus,
  SystemSetting,
} from '../../core/admin.models';
import { AdminService } from '../../core/admin.service';
import { AuthService } from '../../core/auth.service';

type AdminSection = 'dashboard' | 'stores' | 'users' | 'support' | 'audit' | 'settings';

const USER_ROLES: AdminUserRole[] = [
  'ROLE_ADMIN',
  'ROLE_STORE_ADMIN',
  'ROLE_STORE_MANAGER',
  'ROLE_BRANCH_MANAGER',
  'ROLE_BRANCH_CASHIER',
];
const STORE_STATUSES: StoreStatus[] = ['PENDING', 'ACTIVE', 'BLOCKED'];
const ACCOUNT_STATUSES: AccountStatus[] = ['ACTIVE', 'DISABLED'];
const SUPPORT_STATUSES: SupportReportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
const WORKING_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function isAdminUserRole(value: string): value is AdminUserRole {
  return USER_ROLES.some((role) => role === value);
}

@Component({
  selector: 'app-admin-console',
  imports: [DatePipe, HlmButton],
  templateUrl: './admin-console.html',
  styleUrl: './admin-console.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConsole {
  private api = inject(AdminService);
  private auth = inject(AuthService);
  private document = inject(DOCUMENT);

  readonly sections: { id: AdminSection; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'stores', label: 'Stores' },
    { id: 'users', label: 'Users & roles' },
    { id: 'support', label: 'Support reports' },
    { id: 'audit', label: 'Audit log' },
    { id: 'settings', label: 'System settings' },
  ];
  readonly userRoles = USER_ROLES;
  readonly storeStatuses = STORE_STATUSES;
  readonly accountStatuses = ACCOUNT_STATUSES;
  readonly supportStatuses = SUPPORT_STATUSES;

  readonly section = signal<AdminSection>('dashboard');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly actionBusy = signal('');

  readonly dashboard = signal<AdminDashboardData | null>(null);
  readonly stores = signal<AdminStore[]>([]);
  readonly selectedStore = signal<AdminStore | null>(null);
  readonly storeDetailLoading = signal(false);
  readonly storeDetailError = signal('');
  readonly storeQuery = signal('');
  readonly storeStatus = signal<StoreStatus | ''>('');
  readonly showStoreForm = signal(false);
  readonly storeDraft = signal<StoreCreateRequest>({
    brand: '',
    description: '',
    storeType: '',
    contact: { address: '', phone: '', email: '' },
  });
  readonly workingDays = WORKING_DAYS;
  readonly showBranchForm = signal(false);
  readonly branchStoreId = signal<number | null>(null);
  readonly branchDraft = signal<Omit<BranchCreateRequest, 'storeId'>>({
    name: '',
    address: '',
    phoneNumber: '',
    email: '',
    workingDays: [],
    openTime: '',
    closeTime: '',
  });
  readonly branches = signal<Branch[]>([]);
  readonly branchesLoading = signal(false);
  readonly branchesError = signal('');

  readonly users = signal<AdminUser[]>([]);
  readonly userQuery = signal('');
  readonly userRole = signal<AdminUserRole | ''>('');
  readonly userStatus = signal<AccountStatus | ''>('');
  readonly userRoleDrafts = signal<Record<number, AdminUserRole>>({});

  readonly supportReports = signal<SupportReport[]>([]);
  readonly supportStatus = signal<SupportReportStatus | ''>('');
  readonly auditLogs = signal<AdminAuditLog[]>([]);
  readonly settings = signal<SystemSetting[]>([]);
  readonly settingDrafts = signal<Record<string, string>>({});

  constructor() {
    this.loadDashboard();
  }

  selectSection(section: AdminSection) {
    this.section.set(section);
    this.error.set('');
    this.actionError.set('');
    this.notice.set('');

    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'stores':
        this.loadStores();
        break;
      case 'users':
        this.loadUsers();
        break;
      case 'support':
        this.loadSupportReports();
        break;
      case 'audit':
        this.loadAuditLogs();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  sectionLabel() {
    return this.sections.find((item) => item.id === this.section())?.label ?? 'Dashboard';
  }

  loadDashboard() {
    this.startLoading();
    this.api
      .getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.dashboard.set(data),
        error: () => this.error.set('Unable to load admin dashboard data. Try again.'),
      });
  }

  loadStores() {
    this.startLoading();
    this.api
      .getStores(this.storeQuery(), this.storeStatus())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (stores) => {
          this.stores.set(stores);
          const eligibleStoreId = this.branchStores(stores)[0]?.id ?? null;
          if (!this.branchStores(stores).some((store) => store.id === this.branchStoreId())) {
            this.branchStoreId.set(eligibleStoreId);
            if (eligibleStoreId !== null) this.loadBranches(eligibleStoreId);
            else this.branches.set([]);
          }
        },
        error: () => this.error.set('Unable to load stores. Check the backend and try again.'),
      });
  }

  branchStores(stores = this.stores()) {
    const adminId = this.auth.user()?.id;
    return adminId == null ? [] : stores.filter((store) => store.storeAdminId === adminId);
  }

  branchStoreLabel() {
    return this.branchStores().find((store) => store.id === this.branchStoreId())?.name ?? '';
  }

  updateStoreDraft(field: 'brand' | 'description' | 'storeType', value: string) {
    this.storeDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  updateStoreContact(field: keyof StoreCreateRequest['contact'], value: string) {
    this.storeDraft.update((draft) => ({
      ...draft,
      contact: { ...draft.contact, [field]: value },
    }));
  }

  createStore(event: Event) {
    event.preventDefault();
    this.runAction('create-store');
    this.api.createStore(this.storeDraft()).subscribe({
      next: () => {
        this.showStoreForm.set(false);
        this.storeDraft.set({
          brand: '',
          description: '',
          storeType: '',
          contact: { address: '', phone: '', email: '' },
        });
        this.api.getStores(this.storeQuery(), this.storeStatus()).subscribe({
          next: (stores) => {
            this.stores.set(stores);
            const eligibleStoreId = this.branchStores(stores)[0]?.id ?? null;
            this.branchStoreId.set(eligibleStoreId);
            if (eligibleStoreId !== null) this.loadBranches(eligibleStoreId);
            this.actionSuccess('Store created successfully.');
          },
          error: () =>
            this.actionFailure('Store created, but the store list could not be refreshed.'),
        });
      },
      error: () =>
        this.actionFailure('Unable to create the store. Check the details and try again.'),
    });
  }

  setBranchStore(value: string) {
    const storeId = Number(value);
    if (!this.branchStores().some((store) => store.id === storeId)) return;
    this.branchStoreId.set(storeId);
    this.loadBranches(storeId);
  }

  loadBranches(storeId: number) {
    this.branchesLoading.set(true);
    this.branchesError.set('');
    this.api
      .getBranches(storeId)
      .pipe(finalize(() => this.branchesLoading.set(false)))
      .subscribe({
        next: (branches) => this.branches.set(branches),
        error: () => {
          this.branches.set([]);
          this.branchesError.set('Unable to load branches for this store.');
        },
      });
  }

  updateBranchDraft(
    field: 'name' | 'address' | 'phoneNumber' | 'email' | 'openTime' | 'closeTime',
    value: string,
  ) {
    this.branchDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  toggleWorkingDay(day: string, checked: boolean) {
    this.branchDraft.update((draft) => ({
      ...draft,
      workingDays: checked
        ? [...new Set([...draft.workingDays, day])]
        : draft.workingDays.filter((currentDay) => currentDay !== day),
    }));
  }

  createBranch(event: Event) {
    event.preventDefault();
    const storeId = this.branchStoreId();
    if (storeId === null || !this.branchStores().some((store) => store.id === storeId)) {
      this.actionFailure('Select a store assigned to the current admin before creating a branch.');
      return;
    }

    const request: BranchCreateRequest = { ...this.branchDraft(), storeId };
    this.runAction('create-branch');
    this.api.createBranch(request).subscribe({
      next: () => {
        this.branchDraft.set({
          name: '',
          address: '',
          phoneNumber: '',
          email: '',
          workingDays: [],
          openTime: '',
          closeTime: '',
        });
        this.api.getBranches(storeId).subscribe({
          next: (branches) => {
            this.branches.set(branches);
            this.actionSuccess('Branch created successfully.');
          },
          error: () =>
            this.actionFailure('Branch created, but the branch list could not be refreshed.'),
        });
      },
      error: () =>
        this.actionFailure('Unable to create the branch. Check the details and try again.'),
    });
  }

  setStoreStatus(value: string) {
    this.storeStatus.set(STORE_STATUSES.find((status) => status === value) ?? '');
  }

  toggleStoreForm() {
    this.showStoreForm.update((visible) => !visible);
  }

  toggleBranchForm() {
    this.showBranchForm.update((visible) => !visible);
  }

  openStore(store: AdminStore) {
    this.selectedStore.set(store);
    this.storeDetailLoading.set(true);
    this.storeDetailError.set('');
    this.api
      .getStore(store.id)
      .pipe(finalize(() => this.storeDetailLoading.set(false)))
      .subscribe({
        next: (details) => this.selectedStore.set(details),
        error: () => this.storeDetailError.set('Unable to load store details.'),
      });
  }

  updateStoreStatus(store: AdminStore, status: StoreStatus) {
    if (status === 'BLOCKED' && !this.confirm(`Reject or block "${store.name}"?`)) return;
    this.runAction(`store:${store.id}`);
    this.api.updateStoreStatus(store.id, status).subscribe({
      next: (updated) => {
        this.stores.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (this.selectedStore()?.id === updated.id) this.selectedStore.set(updated);
        this.actionSuccess('Store status updated.');
      },
      error: () => this.actionFailure('Unable to update the store status.'),
    });
  }

  loadUsers() {
    this.startLoading();
    this.api
      .getUsers({ query: this.userQuery(), role: this.userRole(), status: this.userStatus() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.userRoleDrafts.set(Object.fromEntries(users.map((user) => [user.id, user.role])));
        },
        error: () => this.error.set('Unable to load users. Check the backend and try again.'),
      });
  }

  setUserRoleFilter(value: string) {
    this.userRole.set(isAdminUserRole(value) ? value : '');
  }

  setUserStatusFilter(value: string) {
    this.userStatus.set(ACCOUNT_STATUSES.find((status) => status === value) ?? '');
  }

  setUserRoleDraft(userId: number, role: string) {
    if (isAdminUserRole(role)) {
      this.userRoleDrafts.update((drafts) => ({ ...drafts, [userId]: role }));
    }
  }

  updateUserRole(user: AdminUser) {
    const role = this.userRoleDrafts()[user.id] ?? user.role;
    if (role === user.role) return;
    this.runAction(`role:${user.id}`);
    this.api.updateUserRole(user.id, role).subscribe({
      next: (updated) => {
        this.users.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.userRoleDrafts.update((drafts) => ({ ...drafts, [updated.id]: updated.role }));
        this.actionSuccess(`Role updated for ${updated.email}.`);
      },
      error: () => this.actionFailure(`Unable to update the role for ${user.email}.`),
    });
  }

  updateUserStatus(user: AdminUser) {
    const status: AccountStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (status === 'DISABLED' && !this.confirm(`Deactivate ${user.email}?`)) return;
    this.runAction(`user:${user.id}`);
    this.api.updateUserStatus(user.id, status).subscribe({
      next: (updated) => {
        this.users.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.actionSuccess(`Account status updated for ${updated.email}.`);
      },
      error: () => this.actionFailure(`Unable to update the account for ${user.email}.`),
    });
  }

  loadSupportReports() {
    this.startLoading();
    this.api
      .getSupportReports(this.supportStatus())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (reports) => this.supportReports.set(reports),
        error: () => this.error.set('Unable to load support reports. Try again.'),
      });
  }

  setSupportStatus(value: string) {
    this.supportStatus.set(SUPPORT_STATUSES.find((status) => status === value) ?? '');
  }

  setSupportReportStatus(report: SupportReport, value: string) {
    const status = SUPPORT_STATUSES.find((candidate) => candidate === value);
    if (status) this.updateSupportStatus(report, status);
  }

  updateSupportStatus(report: SupportReport, status: SupportReportStatus) {
    this.runAction(`support:${report.id}`);
    this.api.updateSupportReportStatus(report.id, status).subscribe({
      next: (updated) => {
        this.supportReports.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.actionSuccess(`Support report #${updated.id} updated.`);
      },
      error: () => this.actionFailure(`Unable to update support report #${report.id}.`),
    });
  }

  loadAuditLogs() {
    this.startLoading();
    this.api
      .getAuditLogs()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (logs) => this.auditLogs.set(logs),
        error: () => this.error.set('Unable to load audit logs. Try again.'),
      });
  }

  loadSettings() {
    this.startLoading();
    this.api
      .getSettings()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (settings) => {
          this.settings.set(settings);
          this.settingDrafts.set(
            Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
          );
        },
        error: () => this.error.set('Unable to load system settings. Try again.'),
      });
  }

  setSettingDraft(key: string, value: string) {
    this.settingDrafts.update((drafts) => ({ ...drafts, [key]: value }));
  }

  settingValue(setting: SystemSetting) {
    return this.settingDrafts()[setting.key] ?? setting.value;
  }

  settingChanged(setting: SystemSetting) {
    return this.settingValue(setting) !== setting.value;
  }

  updateSetting(setting: SystemSetting) {
    const value = this.settingDrafts()[setting.key] ?? setting.value;
    if (value === setting.value) return;
    this.runAction(`setting:${setting.key}`);
    this.api.updateSetting(setting.key, value).subscribe({
      next: (updated) => {
        this.settings.update((items) =>
          items.map((item) => (item.key === updated.key ? updated : item)),
        );
        this.setSettingDraft(updated.key, updated.value);
        this.actionSuccess(`Setting "${updated.key}" updated.`);
      },
      error: () => this.actionFailure(`Unable to update setting "${setting.key}".`),
    });
  }

  entries(values: Record<string, number> | null | undefined) {
    return Object.entries(values ?? {}).map(([label, count]) => ({ label, count }));
  }

  label(value: string) {
    return value
      .replace(/^ROLE_/, '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  currentRoleLabel() {
    const role = this.auth.user()?.role;
    return role ? this.label(role) : '—';
  }

  statusClass(status: string) {
    switch (status) {
      case 'ACTIVE':
      case 'RESOLVED':
        return 'status-active';
      case 'PENDING':
      case 'OPEN':
      case 'IN_PROGRESS':
        return 'status-pending';
      case 'BLOCKED':
      case 'DISABLED':
      case 'REJECTED':
        return 'status-blocked';
      default:
        return '';
    }
  }

  isSelf(user: AdminUser) {
    return user.id === this.auth.user()?.id;
  }

  private startLoading() {
    this.loading.set(true);
    this.error.set('');
    this.actionError.set('');
    this.notice.set('');
  }

  private runAction(key: string) {
    this.actionBusy.set(key);
    this.actionError.set('');
    this.notice.set('');
  }

  private actionSuccess(message: string) {
    this.actionBusy.set('');
    this.actionError.set('');
    this.notice.set(message);
  }

  private actionFailure(message: string) {
    this.actionBusy.set('');
    this.actionError.set(message);
  }

  private confirm(message: string) {
    return this.document.defaultView?.confirm(message) ?? false;
  }
}
