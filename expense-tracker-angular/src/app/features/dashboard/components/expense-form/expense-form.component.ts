import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import type { Expense, ExpenseDraft } from '../../../../core/models/expense.model';
import { PreferencesStore } from '../../../../core/stores/preferences.store';
import { getCategoryIcon } from '../../../../core/utils/expense-icons';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  return new Date(dateStr).toISOString().split('T')[0];
}

@Component({
  selector: 'app-expense-form',
  imports: [NgIcon],
  templateUrl: './expense-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseFormComponent implements OnInit {
  private prefs = inject(PreferencesStore);

  readonly initialExpense = input<Expense | null>(null);
  readonly submitting = input(false);
  readonly submitted = output<ExpenseDraft>();

  readonly type = signal<'expense' | 'income'>('expense');
  readonly description = signal('');
  readonly amount = signal('');
  readonly category = signal('');
  readonly upiApp = signal('');
  readonly paymentMethod = signal<'cash' | 'upi' | 'bank'>('cash');
  readonly date = signal('');
  readonly error = signal('');

  readonly isIncome = computed(() => this.type() === 'income');
  readonly invalid = computed(() => Boolean(this.error()));
  readonly quickAmounts = QUICK_AMOUNTS;

  readonly categories = computed(() => this.prefs.prefs().categories);
  readonly upiApps = computed(() => this.prefs.prefs().upiApps);

  ngOnInit(): void {
    const initial = this.initialExpense();
    this.type.set(initial?.type ?? 'expense');
    this.description.set(initial?.description ?? '');
    this.amount.set(initial ? String(initial.amount) : '');
    this.category.set(initial?.category ?? this.categories()[0] ?? 'Food');
    this.upiApp.set(initial?.upiApp ?? this.upiApps()[0] ?? 'GPay');
    this.paymentMethod.set(initial?.paymentMethod ?? 'cash');
    this.date.set(toInputDate(initial?.date));
  }

  getCategoryIcon(category: string): string {
    return getCategoryIcon(category);
  }

  isQuickAmountActive(amt: number): boolean {
    return Number(this.amount()) === amt;
  }

  quickPick(amt: number): void {
    this.amount.set(String(amt));
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.error.set('');

    if (!this.description().trim() || !this.amount()) {
      this.error.set('Add a short description and the amount');
      return;
    }

    if (Number(this.amount()) <= 0) {
      this.error.set('Amount must be greater than zero');
      return;
    }

    const isIncome = this.isIncome();
    const initial = this.initialExpense();
    this.submitted.emit({
      description: this.description(),
      amount: Number(this.amount()),
      type: this.type(),
      category: isIncome ? 'Income' : this.category(),
      date: this.date(),
      ...(isIncome
        ? { paymentMethod: (initial?.paymentMethod ?? 'bank') as 'bank' | 'cash' | 'upi' }
        : {
            paymentMethod: this.paymentMethod(),
            ...(this.paymentMethod() === 'upi' ? { upiApp: this.upiApp() } : {}),
          }),
    });
  }
}