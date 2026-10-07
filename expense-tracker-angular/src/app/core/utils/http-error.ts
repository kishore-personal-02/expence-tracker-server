import { HttpErrorResponse } from '@angular/common/http';

export function extractApiError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: unknown } | null;
    const message = body?.message;
    if (message) return String(message);
  }
  return fallback;
}