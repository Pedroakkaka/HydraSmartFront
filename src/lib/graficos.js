import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale,
  LineController, LineElement, PointElement, Tooltip
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

const MONO = { family: 'JetBrains Mono', size: 10 };

/** Opções visuais compartilhadas pelos gráficos do painel (tema escuro). */
export const opcoesBase = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: true, position: 'top', labels: { boxWidth: 12, color: '#94a3b8', font: MONO } },
    tooltip: {
      backgroundColor: 'rgba(11, 19, 38, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      titleColor: '#00f0ff',
      bodyColor: '#f8fafc',
      bodyFont: { ...MONO, size: 11 }
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#64748b', font: { ...MONO, size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
  }
};

export const eixoPercentual = {
  min: 0,
  max: 100,
  grid: { color: 'rgba(255, 255, 255, 0.05)' },
  ticks: { color: '#94a3b8', font: MONO, stepSize: 20, callback: (v) => `${v}%` }
};

export const serieBueiro1 = { borderColor: '#00f0ff', backgroundColor: 'rgba(0, 240, 255, 0.08)', pointBackgroundColor: '#00f0ff' };
export const serieBueiro2 = { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', pointBackgroundColor: '#f59e0b' };

export const linhaLimiar = (rotulo, valor, cor, n) => ({
  label: rotulo,
  data: Array(n).fill(valor),
  borderColor: cor,
  borderDash: [5, 5],
  borderWidth: 1.2,
  fill: false,
  pointRadius: 0
});
