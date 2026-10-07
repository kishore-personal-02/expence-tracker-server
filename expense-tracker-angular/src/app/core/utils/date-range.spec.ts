import { getDefaultRange, getRange, toInputDate } from './date-range';

describe('date-range', () => {
  it('bumps the default to the current month start', () => {
    const range = getDefaultRange();
    expect(range.startDate).toBeTruthy();
    expect(range.endDate).toBeTruthy();
    expect(new Date(range.startDate!).getTime()).toBeLessThanOrEqual(
      new Date(range.endDate!).getTime()
    );
  });

  it('resolves today as a same-day range', () => {
    const range = getRange('today');
    const start = new Date(range.startDate!);
    const end = new Date(range.endDate!);
    expect(start.getFullYear()).toBe(new Date().getFullYear());
    expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it('returns null dates for custom ranges', () => {
    expect(getRange('custom')).toEqual({ startDate: null, endDate: null });
  });

  it('converts ISO dates to yyyy-MM-dd input values', () => {
    expect(toInputDate('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
    expect(toInputDate(null)).toBe('');
    expect(toInputDate(undefined)).toBe('');
    expect(toInputDate('not-a-date')).toBe('');
  });
});