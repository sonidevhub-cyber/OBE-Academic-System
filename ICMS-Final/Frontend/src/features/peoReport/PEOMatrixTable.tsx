import React from 'react';
import type { PEOReportMatrixItem } from './types';

interface PEOMatrixTableProps {
  matrix: PEOReportMatrixItem[];
  onTriggerCQI?: (row: PEOReportMatrixItem) => void;
  canManageCQI?: boolean;
}

const statusStyles: Record<PEOReportMatrixItem['status'], string> = {
  Achieved: 'bg-emerald-100 text-emerald-700',
  'CQI Triggered': 'bg-rose-100 text-rose-700',
};

const formatPercentage = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(2)}%`);

const PEOMatrixTable: React.FC<PEOMatrixTableProps> = ({
  matrix,
  onTriggerCQI,
  canManageCQI = true,
}) => {
  return (
    <div className="overflow-x-auto rounded-[2rem] border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
              PEO & Target
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
              CQI
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {matrix.map((row, index) => {
            const displayStatus = row.status === 'Achieved' ? 'Achieved' : 'Not Achieved';
            
            return (
              <tr key={row.peoId} className="align-top hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">PEO {index + 1}</div>
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
                    {displayStatus}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm border border-gray-200">
                  {row.status === 'CQI Triggered' && onTriggerCQI && canManageCQI ? (
                    <button
                      onClick={() => onTriggerCQI(row)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        row.cqiStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-rose-600 text-white hover:bg-rose-700'
                      }`}
                    >
                      {row.cqiStatus === 'APPROVED' ? 'CQI Recorded (View)' : '⚠ Trigger CQI'}
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
  );
};

export default PEOMatrixTable;
