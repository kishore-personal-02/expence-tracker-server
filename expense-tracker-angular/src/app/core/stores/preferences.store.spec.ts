import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { Preferences } from '../models/preferences.model';
import { emptyPrefs } from '../models/preferences.model';
import { PreferencesStore } from './preferences.store';

function withCategory(name: string): Preferences {
  return { ...emptyPrefs, customCategories: [name] };
}

describe('PreferencesStore', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds a category through the API and updates state', async () => {
    const store = TestBed.inject(PreferencesStore);
    const result = store.addCategory('Pets');
    httpMock
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/preferences/categories'))
      .flush(withCategory('Pets'));
    await expect(result).resolves.toEqual(withCategory('Pets'));
    expect(store.prefs().customCategories).toContain('Pets');
  });

  it('removes a category through the API and updates state', async () => {
    const store = TestBed.inject(PreferencesStore);
    const result = store.removeCategory('Pets');
    httpMock
      .expectOne((req) => req.method === 'DELETE' && req.url.endsWith('/preferences/categories/Pets'))
      .flush(emptyPrefs);
    await expect(result).resolves.toEqual(emptyPrefs);
    expect(store.prefs().customCategories).toEqual([]);
  });

  it('manages custom UPI apps', async () => {
    const store = TestBed.inject(PreferencesStore);
    const added = store.addUpiApp('Cred');
    httpMock
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/preferences/upi-apps'))
      .flush({ ...emptyPrefs, customUpiApps: ['Cred'] });
    await added;
    expect(store.prefs().customUpiApps).toContain('Cred');

    const removed = store.removeUpiApp('Cred');
    httpMock
      .expectOne((req) => req.method === 'DELETE' && req.url.endsWith('/preferences/upi-apps/Cred'))
      .flush(emptyPrefs);
    await removed;
    expect(store.prefs().customUpiApps).toEqual([]);
  });
});