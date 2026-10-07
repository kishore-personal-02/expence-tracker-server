import type { Chart, ChartType, TooltipModel } from 'chart.js';
import { formatCurrencyWhole } from '../../../core/utils/formatters';
import type { ChartTheme } from './chart-theme';

// chart.js' `external` tooltip callback is invoked as
// `external.call(tooltip, { chart, tooltip })`.
export interface TooltipEvent {
  chart: Chart;
  tooltip: TooltipModel<ChartType>;
}

export interface TooltipPoint {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipPoint {
  label: string;
  value: number;
}

const TOOLTIP_OFFSET = 12;

function createTooltipEl(wrap: HTMLElement | null, className: string): HTMLElement | null {
  if (!wrap) return null;
  let el = wrap.querySelector<HTMLElement>(`.${className}`);
  if (!el) {
    el = document.createElement('div');
    el.className = className;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    wrap.appendChild(el);
  }
  return el;
}

function place(el: HTMLElement, caretX: number, caretY: number): void {
  el.style.left = `${caretX + TOOLTIP_OFFSET}px`;
  el.style.top = `${caretY + TOOLTIP_OFFSET}px`;
}

// Pie tooltip — reproduces the Recharts DEFAULT tooltip that the source
// renders for the category pie and the payment doughnut (its <Tooltip
// formatter>), including the item's `color: sliceColor` inline which the
// source CSS picks up.
export function defaultTooltipExternal(
  getPoint: (index: number) => TooltipPoint,
): (event: TooltipEvent) => void {
  return (event: TooltipEvent) => {
    const { chart, tooltip } = event;
    const el = createTooltipEl(chart.canvas.parentElement, 'chart-tooltip-default');
    if (!el) return;

    if (tooltip.opacity === 0) {
      el.style.opacity = '0';
      return;
    }

    const point = getPoint(tooltip.dataPoints[0]?.dataIndex ?? 0);

    el.textContent = '';
    const label = document.createElement('p');
    label.className = 'chart-tooltip-label';
    label.textContent = point.name;

    const list = document.createElement('ul');
    list.className = 'chart-tooltip-list';

    const item = document.createElement('li');
    item.className = 'chart-tooltip-item';
    item.style.color = point.color;
    item.textContent = `${point.name} : ${formatCurrencyWhole(point.value)}`;

    list.appendChild(item);
    el.appendChild(label);
    el.appendChild(list);

    if (tooltip.caretX && tooltip.caretY) {
      place(el, tooltip.caretX, tooltip.caretY);
    }
    el.style.opacity = '1';
  };
}

// Bar + area tooltip — reproduces the source's makeTooltip content
// component exactly (inline styles, label bold in tooltipText, value in
// #ef4444 weight 600 formatted with maximumFractionDigits: 0).
export function customTooltipExternal(
  theme: ChartTheme,
  getPoint: (index: number) => CustomTooltipPoint,
): (event: TooltipEvent) => void {
  return (event: TooltipEvent) => {
    const { chart, tooltip } = event;
    const el = createTooltipEl(chart.canvas.parentElement, 'chart-tooltip-custom');
    if (!el) return;

    if (tooltip.opacity === 0) {
      el.style.opacity = '0';
      return;
    }

    const point = getPoint(tooltip.dataPoints[0]?.dataIndex ?? 0);

    el.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      `background:${theme.tooltipBg}`,
      `border:1px solid ${theme.tooltipBorder}`,
      'border-radius:12px',
      'padding:10px 14px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
      'font-size:13px',
    ].join(';');

    el.textContent = '';
    const label = document.createElement('p');
    label.style.cssText = `margin:0;font-weight:700;color:${theme.tooltipText}`;
    label.textContent = point.label;

    const value = document.createElement('p');
    value.style.cssText = 'margin:4px 0 0;color:#ef4444;font-weight:600';
    value.textContent = formatCurrencyWhole(point.value);

    el.appendChild(label);
    el.appendChild(value);

    if (tooltip.caretX && tooltip.caretY) {
      place(el, tooltip.caretX, tooltip.caretY);
    }
    el.style.opacity = '1';
  };
}