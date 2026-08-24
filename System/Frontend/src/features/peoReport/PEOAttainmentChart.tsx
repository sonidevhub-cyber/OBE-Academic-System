import React, { forwardRef } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { PEOReportSummaryItem } from './types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface PEOAttainmentChartProps {
  chartData: PEOReportSummaryItem[];
}

const PEOAttainmentChart = forwardRef<ChartJS<'bar'> | undefined, PEOAttainmentChartProps>(
  ({ chartData }, ref) => {
    const peoLabels = chartData.map((_, index) => `PO ${index + 1}`);

    const data: ChartData<'bar'> = {
      labels: peoLabels,
      datasets: [
        {
          label: 'Target %',
          data: chartData.map((entry) => entry.target),
          backgroundColor: '#94a3b8',
          borderColor: '#64748b',
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: 'Achieved %',
          data: chartData.map((entry) => entry.achieved),
          backgroundColor: '#2563eb',
          borderColor: '#1d4ed8',
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    };

    const options: ChartOptions<'bar'> = {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
          },
        },
        title: {
          display: true,
          text: 'PO Attainment vs Target',
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
          },
        },
      },
    };

    return (
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[860px]">
          <Bar ref={ref} data={data} options={options} width={860} height={320} />
        </div>
      </div>
    );
  }
);

PEOAttainmentChart.displayName = 'PEOAttainmentChart';

export default PEOAttainmentChart;
