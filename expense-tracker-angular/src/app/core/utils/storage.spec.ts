import { AuthUser } from '../models/auth.model';
import { clearAuth, readToken, readUser, writeUser } from './storage';

const user: AuthUser = { _id: '1', name: 'Tester', email: 't@example.com' };

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a stored user', () => {
    writeUser(user);
    expect(readUser()).toEqual(user);
  });

  it('returns null for missing or corrupt user data', () => {
    expect(readUser()).toBeNull();
    localStorage.setItem('user', '{not json');
    expect(readUser()).toBeNull();
  });

  it('reads tokens and clears auth keys', () => {
    localStorage.setItem('token', 'abc');
    expect(readToken()).toBe('abc');
    clearAuth();
    expect(readToken()).toBeNull();
    expect(readUser()).toBeNull();
  });
});