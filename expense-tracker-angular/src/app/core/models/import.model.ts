import type { Expense, ExpenseType } from './expense.model';

export type TransactionSide = 'debit' | 'credit';

export interface ParsedTransaction {
  date: string;
  rawDate: string | null;
  narration: string;
  description: string;
  amount: number;
  type: TransactionSide;
  balance: number | null;
}

export interface ParseResponse {
  fileName: string;
  size: number;
  transactions: ParsedTransaction[];
  textLength: number;
  detectedColumns: string[];
  bankName: string;
  warning: string;
}

export interface ImportEntry {
  key: string;
  date: string;
  description: string;
  amount: number;
  type: ExpenseType;
  category: string;
  selected: boolean;
}

export interface ImportPayloadEntry {
  date: string;
  description: string;
  amount: number;
  type: ExpenseType;
  category: string;
  bankName: string | null;
}

export interface ImportPayload {
  entries: ImportPayloadEntry[];
}

export interface ImportResponse {
  imported: number;
  expenses: Expense[];
}

export interface ImportTotals {
  expense: number;
  income: number;
  count: number;
}