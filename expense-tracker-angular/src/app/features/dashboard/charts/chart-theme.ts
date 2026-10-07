import type { ResolvedTheme } from '../../../core/models/ui.model';

// Source: Charts.jsx LIGHT_COLORS / DARK_COLORS.
const LIGHT_COLORS = [
  '#dc2626',
  '#d97706',
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#64748b',
];

const DARK_COLORS = [
  '#f36a5e',
  '#f59e0b',
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#2dd4bf',
  '#94a3b8',
];

export interface ChartTheme {
  isDark: boolean;
  colors: string[];
  gridColor: string;
  tickColor: string;
  legendColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  areaGradientTop: string;
  activeStroke: string;
  fadedOpacity: number;
  labelColor: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function buildChartTheme(resolved: ResolvedTheme): ChartTheme {
  const isDark = resolved === 'dark';
  return {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    // The source renders grid lines in the CSS var --border (its
    // `!important` override beats the component's gridColor attrs), so
    // resolve that token to a paint colour at runtime.
    gridColor: cssVar('--border', isDark ? '#303038' : '#fecaca'),
    tickColor: isDark ? '#6b6b76' : '#888888',
    legendColor: isDark ? '#a1a1aa' : '#555555',
    tooltipBg: isDark ? '#1e1e24' : '#ffffff',
    tooltipBorder: isDark ? '#303038' : '#fecaca',
    tooltipText: isDark ? '#f0f0f0' : '#1a1a1a',
    areaGradientTop: isDark ? '#ef4444' : '#dc2626',
    activeStroke: isDark ? '#f0f0f0' : '#1a1a1a',
    fadedOpacity: 0.35,
    labelColor: '#808080',
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Source per-key palette from Charts.jsx (cash/upi/bank Cell fills).
export function paymentSliceColor(key: string, isDark: boolean): string {
  if (key === 'cash') return isDark ? '#a1a1aa' : '#374151';
  if (key === 'upi') return isDark ? '#4ade80' : '#16a34a';
  return isDark ? '#f59e0b' : '#d97706';
}