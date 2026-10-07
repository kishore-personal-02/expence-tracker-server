import { TestBed } from '@angular/core/testing';
import { ThemeStore, THEME_STORAGE_KEY } from './theme.store';

describe('ThemeStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('defaults to system preference and resolves to the system theme', () => {
    const store = TestBed.inject(ThemeStore);
    expect(store.preference()).toBe('system');
    expect(store.resolved()).toBe('light');
  });

  it('setPreference persists and resolves the chosen theme', () => {
    const store = TestBed.inject(ThemeStore);
    store.setPreference('dark');
    expect(store.preference()).toBe('dark');
    expect(store.resolved()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('ignores unknown stored values and falls back to system', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    const store = TestBed.inject(ThemeStore);
    expect(store.preference()).toBe('system');
    expect(store.resolved()).toBe('light');
  });
});