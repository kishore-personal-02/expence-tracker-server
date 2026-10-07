import { Injectable, inject, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import type { AuthResult, AuthUser } from '../models/auth.model';
import { AuthApi } from '../api/auth-api.service';
import { clearAuth, readToken, readUser, writeUser } from '../utils/storage';
import { extractApiError } from '../utils/http-error';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private authApi = inject(AuthApi);

  readonly user = signal<AuthUser | null>(readUser());
  readonly loading = signal(false);

  constructor() {
    this.bootstrap();
  }

  private bootstrap(): void {
    const token = readToken();
    if (!token || this.user()) return;
    this.authApi.profile().subscribe({
      next: (profile) => {
        this.user.set(profile);
        writeUser(profile);
      },
      error: () => {
        // keep scrolling; the 401 interceptor clears storage
      },
    });
  }

  async login(email: string, password: string): Promise<AuthResult> {
    this.loading.set(true);
    try {
      const data = await lastValueFrom(this.authApi.login({ email, password }));
      writeUser(data);
      localStorage.setItem('token', data.token ?? '');
      this.user.set(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: extractApiError(err, 'Login failed') };
    } finally {
      this.loading.set(false);
    }
  }

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    this.loading.set(true);
    try {
      const data = await lastValueFrom(this.authApi.register({ name, email, password }));
      writeUser(data);
      localStorage.setItem('token', data.token ?? '');
      this.user.set(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: extractApiError(err, 'Registration failed') };
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    clearAuth();
    this.user.set(null);
  }

  /** Merges a profile patch (e.g. a renamed name) into the cached user. */
  updateUser(patch: Partial<AuthUser>): void {
    const current = this.user();
    if (!current) return;
    const next = { ...current, ...patch };
    writeUser(next);
    this.user.set(next);
  }
}