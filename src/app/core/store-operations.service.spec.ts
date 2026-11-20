import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { StoreOperationsService } from './store-operations.service';

describe('StoreOperationsService', () => {
  let api: StoreOperationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(StoreOperationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a branch with only the BranchDTO form fields', () => {
    const branch = {
      name: 'Centar',
      address: 'Adresa 1',
      phoneNumber: '061123456',
      email: 'centar@example.com',
      workingDays: ['MONDAY', 'TUESDAY'],
      openTime: '08:00:00',
      closeTime: '20:00:00',
    };

    api.createBranch(branch).subscribe();

    const request = http.expectOne('/api/branches/create');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(branch);
    expect('storeId' in request.request.body).toBe(false);
    request.flush({ id: 2, ...branch, storeId: 7 });
  });

  it('loads categories and updates inventory using the backend query parameter', () => {
    api.getCategories(7).subscribe();
    const categories = http.expectOne('/api/categories/store/7');
    expect(categories.request.method).toBe('GET');
    categories.flush([]);

    api.updateInventory(12, { quantity: 5 }).subscribe();
    const inventory = http.expectOne('/api/inventory/update?id=12');
    expect(inventory.request.method).toBe('PUT');
    expect(inventory.request.body).toEqual({ quantity: 5 });
    inventory.flush({ id: 12, branchId: 3, productId: 4, quantity: 5 });
  });
});
