import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

import type { PEOEmploymentStats } from './types';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

interface PEOEmploymentAnalyticsProps {
  stats: PEOEmploymentStats;
}

const employmentColors: Record<string, string> = {
  employed: '#2563eb',
  self_employed: '#7c3aed',
  higher_studies: '#0f766e',
  unemployed: '#ef4444',
  housewife: '#f59e0b',
};

const PEOEmploymentAnalytics: React.FC<PEOEmploymentAnalyticsProps> = ({ stats }) => {
  const totalResponses = stats.employmentDistribution.reduce((sum, item) => sum + item.count, 0);
  const labels = stats.employmentDistribution.map((item) => item.label);

  const doughnutData: ChartData<'doughnut'> = {
    labels,
    datasets: [
      {
        data: stats.employmentDistribution.map((item) => item.count),
        backgroundColor: stats.employmentDistribution.map((item) => employmentColors[item.key] || '#64748b'),
        borderWidth: 0,
      },
    ],
  };

  const barData: ChartData<'bar'> = {
    labels: stats.topEmployers.map((item) => item.name),
    datasets: [
      {
        label: 'Alumni',
        data: stats.topEmployers.map((item) => item.count),
        backgroundColor: '#2563eb',
        borderRadius: 10,
      },
    ],
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
        grid: {
          color: '#e2e8f0',
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Alumni Outcome</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Employment status and organization view</h2>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Total alumni responses: {totalResponses.toLocaleString()}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.employmentDistribution.map((item) => {
          const percent = totalResponses > 0 ? Math.round((item.count / totalResponses) * 100) : 0;

          return (
            <div key={item.key} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{item.count}</p>
                </div>
                <div
                  className="h-10 w-10 rounded-2xl"
                  style={{ backgroundColor: employmentColors[item.key] || '#64748b' }}
                />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: employmentColors[item.key] || '#64748b',
                  }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-slate-500">{percent}%</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Employment Status</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Who is doing what right now</h3>
            </div>
          </div>
          <div className="h-[320px]">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      usePointStyle: true,
                      pointStyle: 'circle',
                      boxWidth: 10,
                      padding: 16,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Top Employers</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Organizations with the most alumni</h3>
            </div>
          </div>
          {stats.topEmployers.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-500">
              No employer data available yet.
            </div>
          ) : (
            <div className="h-[320px]">
              <Bar data={barData} options={barOptions} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PEOEmploymentAnalytics;
