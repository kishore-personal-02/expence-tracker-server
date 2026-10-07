import type { SummaryResponse } from '../../../core/models/expense.model';
import { PAYMENT_LABELS, formatTrendDate } from '../../../core/utils/formatters';

export interface CategoryDatum {
  name: string;
  value: number;
}

export interface PaymentDatum {
  name: string;
  value: number;
  key: string;
}

export interface TrendDatum {
  date: string;
  amount: number;
}

export function buildCategoryData(summary: SummaryResponse | null): CategoryDatum[] {
  const source = summary?.byCategory || {};
  return Object.entries(source)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildPaymentData(summary: SummaryResponse | null): PaymentDatum[] {
  const source = summary?.byPaymentMethod || {};
  return (Object.entries(source) as [string, number][])
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: PAYMENT_LABELS[name] || name,
      value,
      key: name,
    }));
}

export function buildTrendData(summary: SummaryResponse | null): TrendDatum[] {
  const source = summary?.byDay || {};
  return Object.entries(source)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: formatTrendDate(date), amount: value }));
}

export function sumValues(items: { value: number }[]): number {
  return items.reduce((total, item) => total + item.value, 0);
}