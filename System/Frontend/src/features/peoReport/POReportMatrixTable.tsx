import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PEOIndirectWeightConfig, PEOQuestionBreakdownItem, PEOReportMatrixItem } from './types';

interface PEOMatrixTableProps {
  matrix: PEOReportMatrixItem[];
  indirectWeightConfig?: PEOIndirectWeightConfig;
}

const statusStyles: Record<PEOReportMatrixItem['status'], string> = {
  Achieved: 'bg-emerald-100 text-emerald-700',
  'CQI Triggered': 'bg-rose-100 text-rose-700',
};

const labelStyles: Record<string, string> = {
  'Critical Low': 'bg-rose-100 text-rose-700',
  Satisfactory: 'bg-amber-100 text-amber-800',
  Good: 'bg-emerald-100 text-emerald-700',
  'Not Assessed': 'bg-slate-100 text-slate-600',
  Unavailable: 'bg-amber-100 text-amber-800',
};

const formatPercentage = (value: number | null) => (value === null ? 'Unavailable' : `${value.toFixed(2)}%`);
const formatWeight = (value: number) => `${value.toFixed(0)}%`;

const formatSurveyPercentage = (percentage: number | null | undefined, responseCount: number | undefined) => {
  if (responseCount === 0) return 'N/A';
  if (percentage === null || percentage === undefined) return 'Unavailable';
  return `${percentage.toFixed(2)}%`;
};

const formatQuestionLabel = (question: PEOQuestionBreakdownItem) => {
  if ((question.responseCount ?? 0) === 0 && question.percentage === null) return 'Not Assessed';
  if (question.percentage === null || question.percentage === undefined) return 'Unavailable';
  return question.label;
};

const sourceLabel = (source?: string) => (source === 'Employer Survey' ? 'Employer' : 'Alumni');

const PEOMatrixTable: React.FC<PEOMatrixTableProps> = ({
  matrix,
  indirectWeightConfig,
}) => {
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});
  const effectiveWeights = React.useMemo(
    () => ({
      alumniWeight: indirectWeightConfig?.alumniWeight ?? 50,
      employerWeight: indirectWeightConfig?.employerWeight ?? 50,
    }),
    [indirectWeightConfig],
  );
  const isFixed = !indirectWeightConfig || (indirectWeightConfig.alumniWeight === 50 && indirectWeightConfig.employerWeight === 50);

  const toggleRow = (peoId: string) => {
    setExpandedRows((prev) => ({ ...prev, [peoId]: !prev[peoId] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3 text-xs font-bold text-indigo-700">
        <span>PO Indirect (20%) Sub-Weights:</span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          Alumni: {formatWeight(effectiveWeights.alumniWeight)}
        </span>
        <span className="rounded-full bg-white px-3 py-1 shadow-sm">
          Employer: {formatWeight(effectiveWeights.employerWeight)}
        </span>
        {isFixed && (
          <span className="rounded-full bg-slate-900 text-slate-50 px-3 py-1 shadow-sm tracking-wide">
            FIXED 50:50
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1300px] table-fixed border-collapse text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-40 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                PO & Target
              </th>
              <th className="w-1/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                PO Description
              </th>
              <th className="w-1/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Direct (80%)
                <span className="block font-normal normal-case text-[10px] text-gray-400">Weighted GA to PO</span>
              </th>
              <th className="w-[32%] px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                Indirect (20%) - Alumni + Employer
                <span className="block font-normal normal-case text-[10px] text-gray-400">Averaged across all linked questions per PO</span>
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
              const b = row.indirectBreakdown;
              const questionRows = row.indirectQuestionRows || [];
              const isExpanded = !!expandedRows[row.peoId];
              const displayStatus = row.status === 'Achieved' ? 'Achieved' : 'Not Achieved';

              return (
                <React.Fragment key={row.peoId}>
                  <tr className="align-top hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200">
                      <div className="space-y-2">
                        <div className="font-semibold text-gray-900">PO {index + 1}</div>
                        <div className="text-xs text-gray-500">(Target: {row.targetPercentage.toFixed(2)}%)</div>
                        <button
                          type="button"
                          onClick={() => toggleRow(row.peoId)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Question Details
                        </button>
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
                            {formatSurveyPercentage(row.indirectPercentage, b?.totalResponses)}
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm border border-indigo-100/60">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700">
                              <span>Alumni</span>
                              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black">
                                {formatWeight(b?.alumni.weight ?? 0)}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-gray-800">
                              {formatSurveyPercentage(b?.alumni.percentage, b?.alumni.responseCount)}
                              <span className="ml-1 text-[9px] font-semibold text-gray-400">
                                n={b?.alumni.responseCount ?? 0}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 shadow-sm border border-indigo-100/60">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                              <span>Employer</span>
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black">
                                {formatWeight(b?.employer.weight ?? 0)}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-gray-800">
                              {formatSurveyPercentage(b?.employer.percentage, b?.employer.responseCount)}
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusStyles[row.status]}`}>
                        {displayStatus}
                      </span>
                    </td>
                     <td className="px-3 py-2 text-sm border border-gray-200 whitespace-nowrap">
                       {row.status === 'CQI Triggered' ? (
                         <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                           row.cqiStatus === 'APPROVED' || row.cqiStatus === 'CLOSED_IMPLEMENTED' || row.cqiIsLocked
                             ? 'bg-emerald-100 text-emerald-700'
                             : 'bg-amber-100 text-amber-800'
                         }`}>
                           {row.cqiStatus === 'APPROVED' || row.cqiStatus === 'CLOSED_IMPLEMENTED' || row.cqiIsLocked
                             ? 'Closed'
                             : 'In Progress'}
                         </span>
                       ) : (
                         <span className="text-xs text-gray-400">-</span>
                       )}
                     </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="border border-gray-200 bg-slate-50 px-4 py-4">
                        {questionRows.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                            No question-level survey data is available for this PO yet.
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {questionRows.map((question, questionIndex) => {
                              const label = formatQuestionLabel(question);
                              return (
                                <div
                                  key={`${row.peoId}-${question.questionText}-${questionIndex}`}
                                  className="rounded-lg border border-slate-200 bg-white p-4"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                      <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                          question.source === 'Employer Survey'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-indigo-100 text-indigo-700'
                                        }`}>
                                          {sourceLabel(question.source)}
                                        </span>
                                        {question.legacy && (
                                          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-800">
                                            Legacy
                                          </span>
                                        )}
                                        <span className="text-xs font-semibold text-slate-500">
                                          n={question.responseCount ?? 0}
                                        </span>
                                      </div>
                                      <p className="text-sm font-medium text-slate-900">{question.questionText}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        Avg Score: {(question.responseCount ?? 0) === 0 ? 'N/A' : question.avgScore === null ? 'Unavailable' : question.avgScore.toFixed(2)}
                                      </span>
                                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        {formatSurveyPercentage(question.percentage, question.responseCount)}
                                      </span>
                                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${labelStyles[label] || labelStyles['Not Assessed']}`}>
                                        {label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PEOMatrixTable;
