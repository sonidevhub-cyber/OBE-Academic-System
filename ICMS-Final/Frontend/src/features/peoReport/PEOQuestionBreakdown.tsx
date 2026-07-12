import React from 'react';
import type { PEOReportMatrixItem, PEOReportQuestionBreakdown } from './types';

interface PEOQuestionBreakdownProps {
  breakdowns: PEOReportQuestionBreakdown[];
  matrix: PEOReportMatrixItem[];
}

const labelStyles: Record<string, string> = {
  'Critical Low': 'bg-rose-100 text-rose-700',
  Satisfactory: 'bg-amber-100 text-amber-800',
  Good: 'bg-emerald-100 text-emerald-700',
  'Not Assessed': 'bg-slate-100 text-slate-600',
};

const formatScore = (value: number | null) => (value === null ? 'N/A' : value.toFixed(2));

const PEOQuestionBreakdown: React.FC<PEOQuestionBreakdownProps> = ({ breakdowns, matrix }) => {
  const getMatrixRow = (peoId: string) => matrix.find((row) => row.peoId === peoId);
  const visibleBreakdowns = breakdowns.filter((item) => {
    const row = getMatrixRow(item.peoId);
    return row?.status === 'CQI Triggered';
  });

  if (visibleBreakdowns.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No question-wise breakdown is available because no PEO is currently CQI-triggered.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleBreakdowns.map((item) => {
        const row = getMatrixRow(item.peoId);
        const targetPercentage = row?.targetPercentage ?? 0;
        const achievedPercentage = row?.combinedAttainmentPercentage;
        return (
          <section key={item.peoId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {item.peoId}: {row?.description || 'PEO'}{' '}
                <span className="text-slate-500">
                  (Target: {targetPercentage.toFixed(2)}% | Achieved:{' '}
                  {achievedPercentage === null || achievedPercentage === undefined
                    ? 'N/A'
                    : `${achievedPercentage.toFixed(2)}%`}
                  )
                </span>
              </h3>
            </div>

            <div className="space-y-3">
              {item.questions.map((question) => (
                <div
                  key={question.questionText}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{question.questionText}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        Avg Score: {formatScore(question.avgScore)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {question.percentage === null ? 'N/A' : `${question.percentage.toFixed(2)}%`}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${labelStyles[question.label] || labelStyles['Not Assessed']}`}>
                        {question.label}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default PEOQuestionBreakdown;
