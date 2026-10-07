import type { ArcElement, Chart, Plugin } from 'chart.js';

export interface PaymentLabelsState {
  labels: string[];
  values: number[];
  labelColor: string;
}

interface LabelledDataset {
  paymentLabels?: boolean;
}

// Reproduces the Recharts Pie `label={(name, percent) => ...}` of the
// payment method chart: each slice gets a connector line from its outer
// edge plus upright text reading "<Name> NN%" in Recharts' Text default
// fill (#808080) and font-size (14px inherit).
export function createPaymentLabelsPlugin(
  getState: () => PaymentLabelsState,
): Plugin<'doughnut'> {
  return {
    id: 'paymentLabels',
    afterDatasetsDraw(chart: Chart) {
      const meta = chart.getDatasetMeta(0);
      // Doughnut elements are ArcElements at runtime; chart.js' generic
      // Element typing hides the arc geometry, so bridge through unknown.
      const arcs = meta.data as unknown as readonly ArcElement[];
      if (!arcs.length) return;
      const dataset = chart.data.datasets[0] as LabelledDataset | undefined;
      if (!dataset?.paymentLabels) return;

      const state = getState();
      if (!state.values.length) return;
      const total = state.values.reduce((sum, value) => sum + value, 0);
      if (!total) return;

      const { ctx } = chart;
      ctx.save();
      ctx.font = '14px system-ui';
      ctx.textBaseline = 'middle';

      const sliceColors = chart.data.datasets[0].backgroundColor;

      arcs.forEach((arc, index) => {
        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
        const dirX = Math.cos(midAngle);
        const dirY = Math.sin(midAngle);

        const base = arc.outerRadius + 2;
        const lineEnd = arc.outerRadius + 14;
        const textRadius = lineEnd + 3;

        const startX = arc.x + dirX * base;
        const startY = arc.y + dirY * base;
        const endX = arc.x + dirX * lineEnd;
        const endY = arc.y + dirY * lineEnd;

        const percent = Math.round((state.values[index] / total) * 100);
        const label = state.labels[index] ? `${state.labels[index]} ${percent}%` : '';
        if (!label) return;

        const color = Array.isArray(sliceColors)
          ? String(sliceColors[index % sliceColors.length])
          : String(sliceColors || '');

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.fillStyle = state.labelColor;
        ctx.textAlign = dirX >= 0 ? 'start' : 'end';
        ctx.fillText(label, arc.x + dirX * textRadius, arc.y + dirY * textRadius);
      });

      ctx.restore();
    },
  };
}