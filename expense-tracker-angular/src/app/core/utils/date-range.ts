import type { DateRange } from '../models/ui.model';

export type RangeKey = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface RangeOption {
  key: RangeKey;
  label: string;
}

export function getDefaultRange(): DateRange {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: monthStart.toISOString(),
    endDate: now.toISOString(),
  };
}

export function getRange(key: RangeKey): DateRange {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { startDate: todayStart.toISOString(), endDate: now.toISOString() };
    case 'week': {
      const monday = new Date(todayStart);
      monday.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7));
      return { startDate: monday.toISOString(), endDate: now.toISOString() };
    }
    case 'month':
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        endDate: now.toISOString(),
      };
    case 'year':
      return {
        startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
        endDate: now.toISOString(),
      };
    case 'custom':
    default:
      return { startDate: null, endDate: null };
  }
}

export function toInputDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}