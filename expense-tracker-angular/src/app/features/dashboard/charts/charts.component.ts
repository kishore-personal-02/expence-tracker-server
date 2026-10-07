import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  phosphorChartPieSlice,
  phosphorCreditCard,
  phosphorTrendUp,
} from '@ng-icons/phosphor-icons/regular';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import type { ChartData, ChartDataset, ChartOptions } from 'chart.js';
import type { SummaryResponse } from '../../../core/models/expense.model';
import type { ChartFilter, ChartFilterType } from '../../../core/models/ui.model';
import { ThemeStore } from '../../../core/stores/theme.store';
import { PAYMENT_LABELS } from '../../../core/utils/formatters';
import {
  buildCategoryData,
  buildPaymentData,
  buildTrendData,
  type CategoryDatum,
  type PaymentDatum,
} from './chart-data';
import {
  areaGradient,
  buildCategoryBarOptions,
  buildCategoryPieOptions,
  buildPaymentOptions,
  buildTrendOptions,
  type ChartVisualContext,
} from './chart-options';
import { buildChartTheme, paymentSliceColor, withAlpha } from './chart-theme';
import { createPaymentLabelsPlugin } from './payment-labels';

interface LegendItem {
  name: string;
  color: string;
}

interface PaymentDoughnutDataset extends ChartDataset<'doughnut', number[]> {
  paymentLabels?: boolean;
}

@Component({
  selector: 'app-charts',
  imports: [BaseChartDirective, NgIcon],
  templateUrl: './charts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // chart.js + ng2-charts are only needed here, so the registerables and
  // defaults ship inside the lazy dashboard chunk, not the initial bundle.
  providers: [
    provideCharts(withDefaultRegisterables()),
    provideIcons({ phosphorChartPieSlice, phosphorCreditCard, phosphorTrendUp }),
  ],
})
export class ChartsComponent {
  readonly summary = input<SummaryResponse | null>(null);
  readonly activeFilter = input<ChartFilter | null>(null);
  readonly filterChange = output<{ type: ChartFilterType; value: string }>();

  private readonly themeStore = inject(ThemeStore);

  readonly categoryChartType = signal<'pie' | 'bar'>('pie');

  private readonly theme = computed(() => buildChartTheme(this.themeStore.resolved()));
  private readonly isDark = computed(() => this.themeStore.resolved() === 'dark');

  readonly categoryData = computed(() => buildCategoryData(this.summary()));
  readonly paymentData = computed(() => buildPaymentData(this.summary()));
  readonly trendData = computed(() => buildTrendData(this.summary()));

  private readonly categoryColors = computed(() =>
    this.categoryData().map((_, index) => this.theme().colors[index % this.theme().colors.length]),
  );
  private readonly paymentColors = computed(() =>
    this.paymentData().map((item) => paymentSliceColor(item.key, this.isDark())),
  );

  private readonly activeType = computed(() => this.activeFilter()?.type ?? null);
  private readonly activeValue = computed(() => this.activeFilter()?.value ?? null);

  private readonly isCategoryActive = (index: number): boolean =>
    this.activeType() === 'category' && this.activeValue() === this.categoryData()[index]?.name;

  private readonly isCategoryFaded = (index: number): boolean =>
    this.activeType() === 'category' && !this.isCategoryActive(index);

  private readonly isPaymentActive = (index: number): boolean =>
    this.activeType() === 'payment' && this.activeValue() === this.paymentData()[index]?.key;

  private readonly isPaymentFaded = (index: number): boolean =>
    this.activeType() === 'payment' && !this.isPaymentActive(index);

  readonly categoryPieData = computed<ChartData<'doughnut'>>(() => {
    const theme = this.theme();
    return {
      labels: this.categoryData().map((item) => item.name),
      datasets: [
        {
          data: this.categoryData().map((item) => item.value),
          backgroundColor: this.categoryColors().map((color, index) =>
            this.isCategoryFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
          ),
          borderColor: this.categoryColors().map((color, index) =>
            this.isCategoryActive(index) ? theme.activeStroke : 'transparent',
          ),
          borderWidth: this.categoryColors().map((_, index) =>
            this.isCategoryActive(index) ? 2 : 0,
          ),
          hoverBackgroundColor: this.categoryColors().map((color, index) =>
            this.isCategoryFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
          ),
          hoverBorderColor: this.categoryColors().map((color, index) =>
            this.isCategoryActive(index) ? theme.activeStroke : 'transparent',
          ),
          hoverBorderWidth: this.categoryColors().map((_, index) =>
            this.isCategoryActive(index) ? 2 : 0,
          ),
          spacing: 3,
        },
      ],
    };
  });

  readonly categoryBarData = computed<ChartData<'bar'>>(() => {
    const theme = this.theme();
    return {
      labels: this.categoryData().map((item) => item.name),
      datasets: [
        {
          data: this.categoryData().map((item) => item.value),
          backgroundColor: this.categoryColors().map((color, index) =>
            this.isCategoryFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
          ),
          hoverBackgroundColor: this.categoryColors().map((color, index) =>
            this.isCategoryFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
          ),
          borderRadius: { topRight: 6, bottomRight: 6 },
        },
      ],
    };
  });

  readonly paymentChartData = computed<ChartData<'doughnut'>>(() => {
    const theme = this.theme();
    const dataset: PaymentDoughnutDataset = {
      data: this.paymentData().map((item) => item.value),
      backgroundColor: this.paymentColors().map((color, index) =>
        this.isPaymentFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
      ),
      borderColor: this.paymentColors().map((color, index) =>
        this.isPaymentActive(index) ? theme.activeStroke : 'transparent',
      ),
      borderWidth: this.paymentColors().map((_, index) =>
        this.isPaymentActive(index) ? 2 : 0,
      ),
      hoverBackgroundColor: this.paymentColors().map((color, index) =>
        this.isPaymentFaded(index) ? withAlpha(color, theme.fadedOpacity) : color,
      ),
      hoverBorderColor: this.paymentColors().map((color, index) =>
        this.isPaymentActive(index) ? theme.activeStroke : 'transparent',
      ),
      hoverBorderWidth: this.paymentColors().map((_, index) =>
        this.isPaymentActive(index) ? 2 : 0,
      ),
      spacing: 5,
      paymentLabels: true,
    };
    return {
      labels: this.paymentData().map((item) => item.name),
      datasets: [dataset],
    };
  });

  readonly trendChartData = computed<ChartData<'line'>>(() => ({
    labels: this.trendData().map((item) => item.date),
    datasets: [
      {
        data: this.trendData().map((item) => item.amount),
        borderColor: '#ef4444',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        fill: 'origin',
        backgroundColor: areaGradient,
      },
    ],
  }));

  private readonly categoryContext = computed<ChartVisualContext<CategoryDatum>>(() => ({
    data: this.categoryData(),
    filter: this.activeFilter(),
    theme: this.theme(),
    colors: this.categoryColors(),
    onSelect: (value) => this.onSelect('category', value),
  }));

  private readonly paymentContext = computed<ChartVisualContext<PaymentDatum>>(() => ({
    data: this.paymentData(),
    filter: this.activeFilter(),
    theme: this.theme(),
    colors: this.paymentColors(),
    onSelect: (value) => this.onSelect('payment', value),
  }));

  readonly categoryPieChartOptions = computed<ChartOptions<'doughnut'>>(() =>
    buildCategoryPieOptions(this.categoryContext()),
  );
  readonly categoryBarChartOptions = computed<ChartOptions<'bar'>>(() =>
    buildCategoryBarOptions(this.categoryContext()),
  );
  readonly paymentChartOptions = computed<ChartOptions<'doughnut'>>(() =>
    buildPaymentOptions(this.paymentContext()),
  );
  readonly trendChartOptions = computed<ChartOptions<'line'>>(() =>
    buildTrendOptions({
      data: this.trendData(),
      filter: this.activeFilter(),
      theme: this.theme(),
      colors: [],
      onSelect: () => undefined,
    }),
  );

  readonly legendItems = computed<LegendItem[]>(() =>
    this.categoryData().map((item, index) => ({
      name: item.name,
      color: this.categoryColors()[index],
    })),
  );

  readonly paymentBadge = computed(() => {
    const value = this.activeFilter()?.value;
    return value ? PAYMENT_LABELS[value] || value : '';
  });

  private readonly paymentLabelsPlugin = createPaymentLabelsPlugin(() => ({
    labels: this.paymentData().map((item) => item.name),
    values: this.paymentData().map((item) => item.value),
    labelColor: this.theme().labelColor,
  }));

  readonly chartPlugins = [this.paymentLabelsPlugin];

  private onSelect(type: ChartFilterType, value: string): void {
    this.filterChange.emit({ type, value });
  }
}