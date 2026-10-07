import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorArrowCounterClockwise,
  phosphorBank,
  phosphorDownloadSimple,
  phosphorFilePdf,
  phosphorFileText,
  phosphorFolderOpen,
} from '@ng-icons/phosphor-icons/regular';
import { lastValueFrom } from 'rxjs';
import { ImportApi } from '../../core/api/import-api.service';
import type { ImportEntry, ImportPayload, ImportTotals } from '../../core/models/import.model';
import type { ParsedTransaction } from '../../core/models/import.model';
import type { ExpenseType } from '../../core/models/expense.model';
import { PreferencesStore } from '../../core/stores/preferences.store';
import { extractApiError } from '../../core/utils/http-error';
import { formatCurrency } from '../../core/utils/formatters';

function toDateInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function entryKey(txn: ParsedTransaction): string {
  return `${txn.date}-${txn.amount}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEntry(txn: ParsedTransaction): ImportEntry {
  return {
    key: entryKey(txn),
    date: toDateInput(txn.date),
    description: txn.description,
    amount: txn.amount,
    type: txn.type === 'credit' ? 'income' : 'expense',
    category: txn.type === 'credit' ? 'Income' : 'Other',
    selected: true,
  };
}

const INCOME_CATEGORY = 'Income';
const OTHER_CATEGORY = 'Other';

@Component({
  selector: 'app-import',
  imports: [NgIcon],
  templateUrl: './import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideIcons({
      phosphorArrowCounterClockwise,
      phosphorBank,
      phosphorDownloadSimple,
      phosphorFilePdf,
      phosphorFileText,
      phosphorFolderOpen,
    }),
  ],
})
export class ImportComponent {
  private readonly importApi = inject(ImportApi);
  private readonly preferences = inject(PreferencesStore);

  readonly formatCurrency = formatCurrency;

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly fileName = signal('');
  readonly bankName = signal('');
  readonly warning = signal('');
  readonly parsing = signal(false);
  readonly importing = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly entries = signal<ImportEntry[]>([]);

  readonly categories = computed(() => this.preferences.prefs().categories);

  readonly selectedEntries = computed(() => this.entries().filter((entry) => entry.selected));

  readonly totals = computed<ImportTotals>(() =>
    this.selectedEntries().reduce<ImportTotals>(
      (acc, entry) => {
        acc[entry.type] += entry.amount;
        acc.count += 1;
        return acc;
      },
      { expense: 0, income: 0, count: 0 },
    ),
  );

  // Matches the source: once any income row exists the category dropdown
  // leads with "Income" followed by the (customised) category list.
  readonly categoryOptions = computed(() => {
    const hasIncome = this.entries().some((entry) => entry.type === 'income');
    return hasIncome ? [INCOME_CATEGORY, ...this.categories()] : this.categories();
  });

  async handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    this.error.set('');
    this.success.set('');
    this.warning.set('');
    this.parsing.set(true);
    try {
      const data = await lastValueFrom(this.importApi.parse(file));
      this.fileName.set(data.fileName || file.name);
      this.bankName.set(data.bankName || '');
      this.warning.set(data.warning || '');
      this.entries.set(data.transactions.map(toEntry));
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to parse the PDF. Please try another file.'));
      this.entries.set([]);
    } finally {
      this.parsing.set(false);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.handleFile(input.files?.[0]);
  }

  onChooseClick(): void {
    this.fileInput()?.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.handleFile(file);
  }

  toggleEntry(key: string): void {
    this.entries.update((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, selected: !entry.selected } : entry)),
    );
  }

  selectAll(): void {
    const all = this.selectedEntries().length === this.entries().length;
    this.entries.update((prev) => prev.map((entry) => ({ ...entry, selected: !all })));
  }

  updateEntry(key: string, field: keyof ImportEntry, value: string): void {
    this.entries.update((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, [field]: value } : entry)),
    );
  }

  onTextField(key: string, field: 'date' | 'description', event: Event): void {
    this.updateEntry(key, field, (event.target as HTMLInputElement).value);
  }

  onCategoryChange(key: string, event: Event): void {
    this.updateEntry(key, 'category', (event.target as HTMLSelectElement).value);
  }

  onTypeChange(key: string, event: Event): void {
    const type = (event.target as HTMLSelectElement).value as ExpenseType;
    const entry = this.entries().find((item) => item.key === key);
    if (!entry) return;
    this.updateEntry(key, 'type', type);
    if (type === 'income' && entry.category !== INCOME_CATEGORY) {
      this.updateEntry(key, 'category', INCOME_CATEGORY);
    } else if (type === 'expense' && entry.category === INCOME_CATEGORY) {
      this.updateEntry(key, 'category', OTHER_CATEGORY);
    }
  }

  removeEntry(key: string): void {
    this.entries.update((prev) => prev.filter((entry) => entry.key !== key));
  }

  reset(): void {
    this.entries.set([]);
    this.fileName.set('');
    this.bankName.set('');
    this.warning.set('');
    this.success.set('');
    this.error.set('');
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  async handleImport(): Promise<void> {
    const selected = this.selectedEntries();
    if (!selected.length) return;
    this.importing.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const payload: ImportPayload = {
        entries: selected.map((entry) => ({
          date: entry.date,
          description: entry.description,
          amount: entry.amount,
          type: entry.type,
          category: entry.category,
          // Source quirk kept verbatim: rows carry no bankName, so the
          // parsed bank name is dropped and the backend receives null.
          bankName: null,
        })),
      };
      const data = await lastValueFrom(this.importApi.import(payload));
      this.success.set(
        `Imported ${data.imported} entr${data.imported === 1 ? 'y' : 'ies'} successfully.`,
      );
      this.reset();
    } catch (err) {
      this.error.set(extractApiError(err, 'Failed to import entries'));
    } finally {
      this.importing.set(false);
    }
  }
}