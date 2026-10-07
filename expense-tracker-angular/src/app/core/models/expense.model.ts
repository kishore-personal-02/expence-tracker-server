export type ExpenseType = 'expense' | 'income';

export type PaymentMethod = 'cash' | 'upi' | 'bank';

export interface Expense {
  _id: string;
  user: string;
  description: string;
  amount: number;
  type: ExpenseType;
  category: string;
  paymentMethod: PaymentMethod;
  upiApp?: string;
  bankName?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseDraft {
  description: string;
  amount: number;
  type: ExpenseType;
  category: string;
  date: string;
  paymentMethod: PaymentMethod;
  upiApp?: string;
}

export interface ExpensesResponse {
  expenses: Expense[];
  totalAmount: number;
  totalIncome: number;
}

export interface SummaryResponse {
  totalAmount: number;
  totalCount: number;
  totalIncome: number;
  incomeCount: number;
  byCategory: Record<string, number>;
  byPaymentMethod: Record<PaymentMethod, number>;
  byDay: Record<string, number>;
}