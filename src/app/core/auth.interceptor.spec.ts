import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let activeToken: string;
  const auth = {
    token: () => activeToken,
    isLoggedIn: () => true,
    logout: vi.fn(),
  };

  beforeEach(() => {
    activeToken = 'test-jwt';
    auth.logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds Bearer JWT to API requests', () => {
    TestBed.inject(HttpClient).get('/api/orders').subscribe();

    const request = http.expectOne('/api/orders');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    request.flush([]);
  });

  it('does not add the bearer token to auth endpoints', () => {
    TestBed.inject(HttpClient).post('/auth/signin', {}).subscribe();

    const request = http.expectOne('/auth/signin');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('logs out after a protected API request returns 401', () => {
    TestBed.inject(HttpClient)
      .get('/api/shift-reports/current')
      .subscribe({ error: () => undefined });

    http
      .expectOne('/api/shift-reports/current')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledOnce();
  });

  it('does not log out a newer session for an old request’s 401 response', () => {
    TestBed.inject(HttpClient)
      .get('/api/orders')
      .subscribe({ error: () => undefined });

    activeToken = 'new-session-jwt';
    http.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).not.toHaveBeenCalled();
  });
});
