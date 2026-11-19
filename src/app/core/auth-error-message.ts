export function authErrorMessage(status: number): string {
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return 'The backend is unavailable at localhost:8080. Please make sure it is running.';
  }
  if (status === 401) return 'The email or password is incorrect.';
  if (status === 403) {
    return 'Access was denied. Check your account status or contact an administrator.';
  }
  if (status === 409) {
    return 'An account or store with these details already exists.';
  }
  return `The request failed (HTTP ${status}). Please try again.`;
}
