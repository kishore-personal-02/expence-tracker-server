import type { PaymentMethod } from './expense.model';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ResolvedTheme = 'light' | 'dark';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

export type ChartFilterType = 'category' | 'payment';

export interface ChartFilter {
  type: ChartFilterType;
  value: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'bank'];