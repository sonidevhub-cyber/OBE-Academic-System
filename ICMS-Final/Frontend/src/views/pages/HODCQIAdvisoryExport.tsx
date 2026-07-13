import React, { useState } from 'react';
import { ClipboardCheck, FileBarChart2 } from 'lucide-react';

import HODGACQIAdvisory from './HODGACQIAdvisory';
import HODPEOCQI from './HODPEOCQI';

const HODCQIAdvisoryExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ga' | 'peo'>('ga');

  const tabs = [
    { id: 'ga' as const, label: 'GA CQI', icon: FileBarChart2 },
    { id: 'peo' as const, label: 'PEO CQI', icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">CQI Advisory Export</p>
            <h2 className="mt-2 text-2xl font-black text-gray-900">GA and PEO advisory tools in one place</h2>
          </div>
          <p className="max-w-2xl text-sm text-gray-500">
            Use the tabs below to switch between GA advisory export and the alumni-based PEO CQI workflow.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 rounded-2xl bg-gray-50 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-white text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'ga' ? <HODGACQIAdvisory /> : <HODPEOCQI />}
    </div>
  );
};

export default HODCQIAdvisoryExport;
