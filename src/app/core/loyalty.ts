/**
 * Backend (Customer entity) trenutno NEMA polje za loyalty points,
 * pa se bodovi racunaju na frontendu iz ukupne potrosnje.
 * Promijeni vrijednost ispod po potrebi (1 bod na svakih 10 potrosenih).
 */
export const SPEND_PER_POINT = 10;

export function calcLoyaltyPoints(totalSpent: number): number {
  return Math.floor(totalSpent / SPEND_PER_POINT);
}

/** Jackson moze vratiti LocalDateTime kao ISO string ili kao niz [y,m,d,h,min,s]. */
export function toDate(v: string | number[] | null | undefined): Date | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const [y, m, d, h = 0, mi = 0, s = 0] = v;
    return new Date(y, m - 1, d, h, mi, s);
  }
  return new Date(v);
}
