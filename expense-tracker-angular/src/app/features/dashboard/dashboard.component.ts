import { ChangeDetectionStrategy, Component, effect, inject, computed, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorBank,
  phosphorBookOpen,
  phosphorBowlFood,
  phosphorBriefcase,
  phosphorCar,
  phosphorChartLineUp,
  phosphorCoffee,
  phosphorCoins,
  phosphorDeviceMobile,
  phosphorFloppyDisk,
  phosphorFilmStrip,
  phosphorFirstAid,
  phosphorGameController,
  phosphorGift,
  phosphorHouseLine,
  phosphorLightbulb,
  phosphorListBullets,
  phosphorMagnifyingGlass,
  phosphorMoney,
  phosphorPackage,
  phosphorPawPrint,
  phosphorPencilSimple,
  phosphorPlus,
  phosphorReceipt,
  phosphorShoppingBag,
  phosphorShoppingCart,
  phosphorTrash,
  phosphorTrendDown,
  phosphorUmbrella,
} from '@ng-icons/phosphor-icons/regular';
import type {
  Expense,
  ExpenseDraft,
  ExpensesResponse,
  SummaryResponse,
} from '../../core/models/expense.model';
import type { ChartFilter, DateRange } from '../../core/models/ui.model';
import { ExpensesApi, type ExpenseListParams, type SummaryParams } from '../../core/api/expenses-api.service';
import { AuthStore } from '../../core/stores/auth.store';
import { PreferencesStore } from '../../core/stores/preferences.store';
import { capitalise, formatCurrency, PAYMENT_LABELS } from '../../core/utils/formatters';
import { getDefaultRange } from '../../core/utils/date-range';
import { extractApiError } from '../../core/utils/http-error';
import { ChartsComponent } from './charts/charts.component';
import { ExpenseListComponent } from './components/expense-list/expense-list.component';
import { ExpenseModalComponent } from './components/expense-modal/expense-modal.component';
import { TimeFilterComponent } from './components/time-filter/time-filter.component';

@Component({
  selector: 'app-dashboard',
  imports: [ChartsComponent, ExpenseListComponent, ExpenseModalComponent, TimeFilterComponent, NgIcon],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({
      phosphorBank,
      phosphorBookOpen,
      phosphorBowlFood,
      phosphorBriefcase,
      phosphorCar,
      phosphorChartLineUp,
      phosphorCoffee,
      phosphorCoins,
      phosphorDeviceMobile,
      phosphorFloppyDisk,
      phosphorFilmStrip,
      phosphorFirstAid,
      phosphorGameController,
      phosphorGift,
      phosphorHouseLine,
      phosphorLightbulb,
      phosphorListBullets,
      phosphorMagnifyingGlass,
      phosphorMoney,
      phosphorPackage,
      phosphorPawPrint,
      phosphorPencilSimple,
      phosphorPlus,
      phosphorReceipt,
      phosphorShoppingBag,
      phosphorShoppingCart,
      phosphorTrash,
      phosphorTrendDown,
      phosphorUmbrella,
    }),
  ],
})
export class DashboardComponent {
  private expensesApi = inject(ExpensesApi);
  private auth = inject(AuthStore);
  private preferences = inject(PreferencesStore);

  readonly user = this.auth.user;

  readonly categories = computed(() => this.preferences.prefs().categories);

  readonly expenses = signal<Expense[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly editingExpense = signal<Expense | null>(null);
  readonly modalOpen = signal(false);
  readonly filter = signal('');
  readonly month = signal('');
  readonly error = signal('');
  readonly summary = signal<SummaryResponse | null>(null);
  readonly chartFilter = signal<ChartFilter | null>(null);
  readonly dateRange = signal<DateRange>(getDefaultRange());

  constructor() {
    effect(() => {
      void this.fetchExpenses();
      void this.fetchSummary();
    });
  }

  private buildParams(): ExpenseListParams {
    const params: ExpenseListParams = {};
    const range = this.dateRange();
    if (this.filter()) params.category = this.filter();
    if (this.month()) params.month = this.month();
    if (range.startDate) params.startDate = range.startDate;
    if (range.endDate) params.endDate = range.endDate;
    return params;
  }

  private buildSummaryParams(): SummaryParams {
    const params: SummaryParams = {};
    const range = this.dateRange();
    if (range.startDate) params.startDate = range.startDate;
    if (range.endDate) params.endDate = range.endDate;
    return params;
  }

  private async fetchExpenses(): Promise<void> {
    this.loading.set(true);
    try {
      const data: ExpensesResponse = await lastValueFrom(
        this.expensesApi.list(this.buildParams())
      );
      this.expenses.set(data.expenses);
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to load expenses'));
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchSummary(): Promise<void> {
    try {
      const data: SummaryResponse = await lastValueFrom(
        this.expensesApi.summary(this.buildSummaryParams())
      );
      this.summary.set(data);
    } catch {
      // summary is optional
    }
  }

  readonly displayedExpenses = computed(() => {
    const cf = this.chartFilter();
    if (!cf) return this.expenses();
    return this.expenses().filter((e) => {
      if (cf.type === 'payment') return e.paymentMethod === cf.value;
      if (cf.type === 'category') return e.category === cf.value;
      return true;
    });
  });

  readonly expensesOnly = computed(() => this.displayedExpenses().filter((e) => e.type !== 'income'));

  readonly incomeOnly = computed(() => this.displayedExpenses().filter((e) => e.type === 'income'));

  readonly totalSpent = computed(() => this.expensesOnly().reduce((sum, e) => sum + e.amount, 0));

  readonly totalIncome = computed(() => this.incomeOnly().reduce((sum, e) => sum + e.amount, 0));

  readonly cashTotal = computed(() =>
    this.expensesOnly().filter((e) => e.paymentMethod === 'cash').reduce((sum, e) => sum + e.amount, 0)
  );

  readonly upiTotal = computed(() =>
    this.expensesOnly().filter((e) => e.paymentMethod === 'upi').reduce((sum, e) => sum + e.amount, 0)
  );

  readonly bankTotal = computed(() =>
    this.expensesOnly().filter((e) => e.paymentMethod === 'bank').reduce((sum, e) => sum + e.amount, 0)
  );

  readonly cashCount = computed(() => this.expensesOnly().filter((e) => e.paymentMethod === 'cash').length);
  readonly upiCount = computed(() => this.expensesOnly().filter((e) => e.paymentMethod === 'upi').length);
  readonly bankCount = computed(() => this.expensesOnly().filter((e) => e.paymentMethod === 'bank').length);

  readonly expenseCountText = computed(() => {
    const n = this.expensesOnly().length;
    return `${n} expense${n !== 1 ? 's' : ''}${this.chartFilter() ? ' · filtered' : ''}`;
  });

  readonly incomeCountText = computed(() => {
    const n = this.incomeOnly().length;
    return `${n} entr${n !== 1 ? 'ies' : 'y'}`;
  });

  readonly filterLabel = computed(() => {
    const cf = this.chartFilter();
    if (!cf) return null;
    if (cf.type === 'payment') return PAYMENT_LABELS[cf.value] ?? 'Bank';
    return cf.value;
  });

  readonly greeting = computed(() => {
    const name = this.user()?.name;
    return name ? `Welcome back, ${capitalise(name.split(' ')[0])}` : 'Your spending at a glance';
  });

  async handleAdd(draft: ExpenseDraft): Promise<void> {
    this.submitting.set(true);
    this.error.set('');
    try {
      const expense: Expense = await lastValueFrom(this.expensesApi.create(draft));
      this.expenses.update((prev) => [expense, ...prev]);
      this.closeModal();
      await this.fetchSummary();
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to add expense'));
    } finally {
      this.submitting.set(false);
    }
  }

  async handleEdit(draft: ExpenseDraft): Promise<void> {
    const editing = this.editingExpense();
    if (!editing) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const expense: Expense = await lastValueFrom(this.expensesApi.update(editing._id, draft));
      this.expenses.update((prev) => prev.map((e) => (e._id === expense._id ? expense : e)));
      this.closeModal();
      await this.fetchSummary();
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to update expense'));
    } finally {
      this.submitting.set(false);
    }
  }

  async handleDelete(id: string): Promise<void> {
    try {
      await lastValueFrom(this.expensesApi.delete(id));
      this.expenses.update((prev) => prev.filter((e) => e._id !== id));
      await this.fetchSummary();
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to delete expense'));
    }
  }

  openAddModal(): void {
    this.editingExpense.set(null);
    this.modalOpen.set(true);
    this.error.set('');
  }

  startEdit(expense: Expense): void {
    this.editingExpense.set(expense);
    this.modalOpen.set(true);
    this.error.set('');
  }

  closeModal(): void {
    this.editingExpense.set(null);
    this.modalOpen.set(false);
    this.error.set('');
  }

  onTimeRangeChange(range: DateRange): void {
    this.dateRange.set(range);
    this.month.set('');
  }

  handleChartFilter(type: ChartFilter['type'], value: string): void {
    this.chartFilter.update((prev) => {
      if (prev && prev.type === type && prev.value === value) return null;
      return { type, value };
    });
  }

  clearChartFilter(): void {
    this.chartFilter.set(null);
  }

  formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }

  hasActiveFilters(): boolean {
    return Boolean(this.filter() || this.month() || this.chartFilter());
  }
}