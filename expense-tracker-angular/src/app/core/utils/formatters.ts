const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const currencyWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateShort = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateLong = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const trendTick = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
});

export function formatCurrency(amount: number): string {
  return currency.format(amount);
}

export function formatCurrencyWhole(amount: number): string {
  return currencyWhole.format(amount);
}

export function formatDate(dateStr: string): string {
  return dateShort.format(new Date(dateStr));
}

export function formatJoinDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return dateLong.format(new Date(dateStr));
}

export function formatTrendDate(dateStr: string): string {
  return trendTick.format(new Date(dateStr));
}

export function formatAxisTick(value: number): string {
  return `₹${(value / 1000).toFixed(0)}k`;
}

export function capitalise(str = ''): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
};