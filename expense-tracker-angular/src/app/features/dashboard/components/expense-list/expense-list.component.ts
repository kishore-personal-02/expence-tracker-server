import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { Expense } from '../../../../core/models/expense.model';
import { getCategoryIcon } from '../../../../core/utils/expense-icons';
import { formatCurrency, formatDate } from '../../../../core/utils/formatters';

@Component({
  selector: 'app-expense-list',
  imports: [NgIcon],
  templateUrl: './expense-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseListComponent {
  readonly expenses = input<Expense[]>([]);
  readonly loading = input(false);
  readonly hasFilters = input(false);

  readonly edit = output<Expense>();
  readonly delete = output<string>();
  readonly add = output<void>();

  readonly confirmId = signal<string | null>(null);

  handleTrashClick(id: string): void {
    if (this.confirmId() !== id) {
      this.confirmId.set(id);
      setTimeout(() => {
        this.confirmId.update((cur) => (cur === id ? null : cur));
      }, 2500);
      return;
    }
    this.confirmId.set(null);
    this.delete.emit(id);
  }

  getCategoryIcon(category: string): string {
    return getCategoryIcon(category);
  }

  formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }

  formatDate(date: string): string {
    return formatDate(date);
  }

  paymentLabel(expense: Expense): string {
    if (expense.paymentMethod === 'upi') return expense.upiApp || 'UPI';
    if (expense.paymentMethod === 'bank') return expense.bankName || 'Bank';
    return 'Cash';
  }

  animDelay(idx: number): string {
    return `${Math.min(idx * 0.05, 0.5)}s`;
  }
}