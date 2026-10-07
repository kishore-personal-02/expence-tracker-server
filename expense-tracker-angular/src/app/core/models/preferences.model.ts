export const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Education',
  'Other',
] as const;

export const DEFAULT_UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'Amazon Pay', 'BHIM', 'Other'] as const;

export interface Preferences {
  categories: string[];
  upiApps: string[];
  customCategories: string[];
  customUpiApps: string[];
}

export const emptyPrefs: Preferences = {
  categories: [...DEFAULT_CATEGORIES],
  upiApps: [...DEFAULT_UPI_APPS],
  customCategories: [],
  customUpiApps: [],
};