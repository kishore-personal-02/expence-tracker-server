import type { AuthUser } from '../models/auth.model';

export const STORAGE_KEYS = {
  token: 'token',
  user: 'user',
  theme: 'expense-tracker-theme',
} as const;

export function readToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function readUser(): AuthUser | null {
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function writeUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}