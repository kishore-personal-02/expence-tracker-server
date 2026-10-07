import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import type { DateRange } from '../../../../core/models/ui.model';
import { getRange, type RangeKey } from '../../../../core/utils/date-range';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

@Component({
  selector: 'app-time-filter',
  imports: [],
  templateUrl: './time-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeFilterComponent {
  readonly rangeChange = output<DateRange>();

  readonly rangeOptions = RANGE_OPTIONS;
  readonly activeRange = signal<RangeKey>('month');
  readonly customStart = signal('');
  readonly customEnd = signal('');

  handleTabChange(key: RangeKey): void {
    this.activeRange.set(key);
    if (key !== 'custom') {
      this.rangeChange.emit(getRange(key));
    } else {
      this.rangeChange.emit({ startDate: null, endDate: null });
    }
  }

  handleCustomDateChange(): void {
    if (this.customStart() && this.customEnd()) {
      this.rangeChange.emit({
        startDate: new Date(this.customStart()).toISOString(),
        endDate: new Date(this.customEnd() + 'T23:59:59').toISOString(),
      });
    }
  }
}