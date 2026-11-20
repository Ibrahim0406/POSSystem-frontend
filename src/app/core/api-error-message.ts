import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback: string): string {
  const status =
    error instanceof HttpErrorResponse
      ? error.status
      : typeof error === 'object' && error !== null && 'status' in error
        ? error.status
        : undefined;

  if (status === 403) {
    return 'Access denied. The requested data was cleared. Contact your administrator if you believe this is incorrect.';
  }
  if (status === 401) {
    return 'Your session is no longer valid. Sign in again to continue.';
  }
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return 'The backend is unavailable. Please check your connection and try again.';
  }
  return fallback;
}
