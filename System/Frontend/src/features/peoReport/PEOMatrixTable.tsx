import React from 'react';
import type { PEOReportMatrixItem, PEOIndirectWeightConfig } from './types';

interface PEOMatrixTableProps {
  matrix: PEOReportMatrixItem[];
  indirectWeightConfig?: PEOIndirectWeightConfig;
  onTriggerCQI?: (row: PEOReportMatrixItem) => void;
  canManageCQI?: boolean;
}

const statusStyles: Record<PEOReportMatrixItem['status'], string> = {
  Achieved: 'bg-emerald-100 text-emerald-700',
  'CQI Triggered': 'bg-rose-100 text-rose-700',
};

const formatPercentage = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(2)}%`);

const formatWeight = (w: number) => `${w.toFixed(0)}%`;

const PEOMatrixTable: React.FC<PEOMatrixTableProps> = ({
  matrix,
  indirectWeightConfig,
  onTriggerCQI,
  canManageCQI = true,
}) => {
  const effectiveWeights = React.useMemo(
    () => ({
      alumniWeight: indirectWeightConfig?.alumniWeight ?? 50,
      employerWeight: indirectWeightConfig?.employerWeight ?? 50,
    }),
    [indirectWeightConfig],
  );
  const isFixed = !indirectWeightConfig || (indirectWeightConfig.alumniWeight === 50 && indirectWeightConfig.employerWeight === 50);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3 text-xs font-bold text-indigo-700">
        <span>PEO Indirect (20%) Sub-Weights:</span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          🎓 Alumni: {formatWeight(effectiveWeights.alumniWeight)}
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          💼 Employer: {formatWeight(effectiveWeights.employerWeight)}
        </span>
        {isFixed && (
          <span className="rounded-full bg-slate-900 text-slate-50 px-3 py-1 shadow-sm tracking-wide">
            FIXED 50:50
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1300px] table-fixed border-collapse text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-36 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                PEO & Target
              </th>
              <th className="w-1/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                PEO Description
              </th>
              <th className="w-1/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Direct (80%)
                <span className="block font-normal normal-case text-[10px] text-gray-400">Weighted GA→PEO</span>
              </th>
              <th className="w-[32%] px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Indirect (20%) — Alumni + Employer
                <span className="block font-normal normal-case text-[10px] text-gray-400">Averaged across all linked questions per PEO</span>
              </th>
              <th className="w-28 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Combined
              </th>
              <th className="w-24 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Status
              </th>
              <th className="w-28 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                CQI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {matrix.map((row, index) => {
              const displayStatus = row.status === 'Achieved' ? 'Achieved' : 'Not Achieved';
              const b = row.indirectBreakdown;
              return (
                <tr key={row.peoId} className="align-top hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200">
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">PEO {index + 1}</div>
                      <div className="text-xs text-gray-500">(Target: {row.targetPercentage.toFixed(2)}%)</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200 whitespace-normal break-words">
                    {row.description}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200 whitespace-normal break-words">
                    <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-200">
                      <div className="text-[10px] uppercase font-black text-slate-500 mb-1">Direct Score</div>
                      <div className="font-black text-lg text-slate-800">{formatPercentage(row.directPercentage)}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200 whitespace-normal break-words">
                    <div className="rounded-xl bg-indigo-50 px-3 py-2 border border-indigo-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-black text-indigo-600">Combined Indirect</span>
                        <span className="text-lg font-black text-indigo-900">
                          {formatPercentage(row.indirectPercentage)}
                        </span>
                      </div>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm border border-indigo-100/60">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700">
                            <span>🎓 Alumni</span>
                            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black">
                              {formatWeight(b?.alumni.weight ?? 0)}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-gray-800">
                            {formatPercentage(b?.alumni.percentage ?? null)}
                            <span className="ml-1 text-[9px] font-semibold text-gray-400">
                              n={b?.alumni.responseCount ?? 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm border border-indigo-100/60">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                            <span>💼 Employer</span>
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black">
                              {formatWeight(b?.employer.weight ?? 0)}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-gray-800">
                            {formatPercentage(b?.employer.percentage ?? null)}
                            <span className="ml-1 text-[9px] font-semibold text-gray-400">
                              n={b?.employer.responseCount ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm font-black text-gray-900 border border-gray-200 whitespace-nowrap">
                    <div className="text-xl">{formatPercentage(row.combinedAttainmentPercentage)}</div>
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-200 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusStyles[row.status]}`}
                    >
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm border border-gray-200 whitespace-nowrap">
                    {row.status === 'CQI Triggered' && onTriggerCQI && canManageCQI ? (
                      <button
                        onClick={() => onTriggerCQI(row)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          row.cqiStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {row.cqiStatus === 'APPROVED' ? 'View CQI' : '⚠ Trigger CQI'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PEOMatrixTable;
