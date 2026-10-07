import { HttpErrorResponse } from '@angular/common/http';
import { extractApiError } from './http-error';

describe('extractApiError', () => {
  it('extracts the message from an API error response', () => {
    const err = new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      error: { message: 'Invalid credentials' },
    });
    expect(extractApiError(err, 'Failed to load')).toBe('Invalid credentials');
  });

  it('falls back to the default when no message is present', () => {
    const err = new HttpErrorResponse({ status: 500, statusText: 'Server Error', error: {} });
    expect(extractApiError(err, 'Something broke')).toBe('Something broke');
  });

  it('falls back for unknown error shapes', () => {
    expect(extractApiError('unexpected', 'Default message')).toBe('Default message');
    expect(extractApiError(null, 'Default message')).toBe('Default message');
  });
});