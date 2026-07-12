import React from 'react';
import type { PEOReportMatrixItem } from './types';

interface PEOMatrixTableProps {
  matrix: PEOReportMatrixItem[];
  onAddCQI?: (peoId: string) => void;
  canManageCQI?: boolean;
}

const statusStyles: Record<PEOReportMatrixItem['status'], string> = {
  Achieved: 'bg-emerald-100 text-emerald-700',
  'CQI Triggered': 'bg-amber-100 text-amber-800',
};

const formatPercentage = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(2)}%`);

const PEOMatrixTable: React.FC<PEOMatrixTableProps> = ({ matrix, onAddCQI, canManageCQI }) => {
  return (
    // Existing CLO table pattern is being mirrored here for visual consistency.
    // Verify against the actual CLO table component if that source layout changes later.
    <div className="overflow-x-auto rounded-[2rem] border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              PEO Code & Target
            </th>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              PEO Description
            </th>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              Survey Questions Mapped
            </th>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              Attainment Score (%)
            </th>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              Status
            </th>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {matrix.map((row) => {
            const showAddCqiButton = canManageCQI && row.status === 'CQI Triggered' && typeof onAddCQI === 'function';

            return (
              <tr key={row.peoId} className="align-top hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">{row.peoId}</div>
                    <div className="text-xs text-gray-500">(Target: {row.targetPercentage.toFixed(2)}%)</div>
                  </div>
                </td>
                <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200">{row.description}</td>
                <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200">
                  {row.mappedQuestions.length > 0 ? row.mappedQuestions.join(', ') : 'No mapped questions'}
                </td>
                <td className="px-3 py-2 text-sm font-bold text-gray-900 border border-gray-200">
                  {formatPercentage(row.combinedAttainmentPercentage)}
                </td>
                <td className="px-3 py-2 text-sm border border-gray-200">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusStyles[row.status]}`}
                  >
                    {row.status === 'Achieved' ? '✅ Achieved' : '⚠️ CQI Triggered'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-gray-500 border border-gray-200">
                  {showAddCqiButton ? (
                    <button
                      type="button"
                      onClick={() => onAddCQI(row.peoId)}
                      className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Add CQI
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PEOMatrixTable;
