import {
  capitalise,
  formatCurrency,
  formatCurrencyWhole,
  formatDate,
  formatJoinDate,
  PAYMENT_LABELS,
} from './formatters';

describe('formatters', () => {
  it('formats INR with Indian digit grouping and 2 decimals', () => {
    expect(formatCurrency(1234.5)).toBe('₹1,234.50');
  });

  it('formats whole currency without decimals', () => {
    expect(formatCurrencyWhole(5000)).toBe('₹5,000');
  });

  it('formats a short date', () => {
    expect(formatDate(new Date(2026, 9, 6).toISOString())).toContain('Oct');
  });

  it('returns an em dash for a missing join date', () => {
    expect(formatJoinDate(null)).toBe('—');
    expect(formatJoinDate(undefined)).toBe('—');
  });

  it('capitalises words and maps payment labels', () => {
    expect(capitalise('food')).toBe('Food');
    expect(PAYMENT_LABELS['cash']).toBe('Cash');
    expect(PAYMENT_LABELS['upi']).toBe('UPI');
    expect(PAYMENT_LABELS['bank']).toBe('Bank');
  });
});