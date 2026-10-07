import { Injectable, effect, inject, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { PreferencesApi } from '../api/preferences-api.service';
import type { Preferences } from '../models/preferences.model';
import { emptyPrefs } from '../models/preferences.model';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  private prefsApi = inject(PreferencesApi);
  private auth = inject(AuthStore);

  readonly prefs = signal<Preferences>(emptyPrefs);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.prefs.set(emptyPrefs);
        return;
      }
      this.prefsApi.get().subscribe({
        next: (data) => this.prefs.set(data),
        error: () => {
          // preferences are optional
        },
      });
    });
  }

  async addCategory(name: string): Promise<Preferences> {
    const data = await lastValueFrom(this.prefsApi.addCategory(name));
    this.prefs.set(data);
    return data;
  }

  async removeCategory(name: string): Promise<Preferences> {
    const data = await lastValueFrom(this.prefsApi.removeCategory(name));
    this.prefs.set(data);
    return data;
  }

  async addUpiApp(name: string): Promise<Preferences> {
    const data = await lastValueFrom(this.prefsApi.addUpiApp(name));
    this.prefs.set(data);
    return data;
  }

  async removeUpiApp(name: string): Promise<Preferences> {
    const data = await lastValueFrom(this.prefsApi.removeUpiApp(name));
    this.prefs.set(data);
    return data;
  }
}