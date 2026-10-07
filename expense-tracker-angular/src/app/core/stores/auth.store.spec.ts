import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthStore } from './auth.store';
import { AuthUser } from '../models/auth.model';

const user: AuthUser = { _id: '1', name: 'Tester', email: 't@example.com', token: 'token-1' };

describe('AuthStore', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('stores the user and token on successful login', async () => {
    const store = TestBed.inject(AuthStore);
    const result = store.login('t@example.com', 'secret');
    httpMock
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/auth/login'))
      .flush(user);
    await expect(result).resolves.toEqual({ ok: true });
    expect(store.user()).toEqual(user);
    expect(localStorage.getItem('token')).toBe('token-1');
  });

  it('surfaces the server message on failed login', async () => {
    const store = TestBed.inject(AuthStore);
    const result = store.login('t@example.com', 'wrong');
    httpMock
      .expectOne((req) => req.method === 'POST' && req.url.endsWith('/auth/login'))
      .flush(
        { message: 'Invalid credentials' },
        { status: 401, statusText: 'Unauthorized' }
      );
    const out = await result;
    expect(out.ok).toBe(false);
    expect(out.message).toBe('Invalid credentials');
    expect(store.user()).toBeNull();
  });

  it('logs out by clearing the user and storage', () => {
    localStorage.setItem('token', 'token-1');
    localStorage.setItem('user', JSON.stringify(user));
    const store = TestBed.inject(AuthStore);
    expect(store.user()).toEqual(user);
    store.logout();
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('merges profile updates into the cached user', () => {
    localStorage.setItem('user', JSON.stringify(user));
    const store = TestBed.inject(AuthStore);
    expect(store.user()?.name).toBe('Tester');
    store.updateUser({ name: 'Renamed' });
    expect(store.user()?.name).toBe('Renamed');
    expect((JSON.parse(localStorage.getItem('user')!) as AuthUser).name).toBe('Renamed');
  });
});