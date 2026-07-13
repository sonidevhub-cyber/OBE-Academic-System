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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Alumni Outcome</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Employment Status and Organization View</h2>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          Total Alumni Responses: {totalResponses.toLocaleString()}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 mb-6">
        {stats.employmentDistribution.map((item) => {
          const percent = totalResponses > 0 ? Math.round((item.count / totalResponses) * 100) : 0;

          return (
            <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{item.count}</p>
                </div>
                <div
                  className="h-8 w-8 rounded-xl"
                  style={{ backgroundColor: employmentColors[item.key] || '#64748b' }}
                />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: employmentColors[item.key] || '#64748b',
                  }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-gray-500">{percent}%</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Employment Status</p>
              <h3 className="mt-1 text-lg font-bold text-gray-900">Who is doing what right now</h3>
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

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Top Employers</p>
              <h3 className="mt-1 text-lg font-bold text-gray-900">Organizations with the most alumni</h3>
            </div>
          </div>
          {stats.topEmployers.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-xl bg-gray-50 text-sm font-semibold text-gray-500">
              No employer data available yet.
            </div>
          ) : (
            <div className="h-[320px]">
              <Bar data={barData} options={barOptions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PEOEmploymentAnalytics;
