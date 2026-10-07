import { Injectable, computed, effect, signal } from '@angular/core';
import type { ThemePreference, ResolvedTheme } from '../models/ui.model';

export const THEME_STORAGE_KEY = 'expense-tracker-theme';

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly theme: ThemePreference = readInitialTheme();
  readonly preference = signal<ThemePreference>(this.theme);
  readonly systemPrefersDark = signal(getSystemDark());

  readonly resolved = computed<ResolvedTheme>(() => {
    if (this.preference() === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return this.preference() as ResolvedTheme;
  });

  constructor() {
    this.listenToSystem();
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolved());
    });
  }

  private listenToSystem(): void {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => this.systemPrefersDark.set(mq.matches);
    mq.addEventListener('change', onChange);
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  }
}

function readInitialTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !('matchMedia' in window)) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}