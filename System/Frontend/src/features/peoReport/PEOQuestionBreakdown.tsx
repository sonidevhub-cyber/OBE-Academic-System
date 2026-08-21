import React from 'react';
import type { PEOReportMatrixItem, PEOReportQuestionBreakdown, PEOQuestionBreakdownItem } from './types';

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

const sourceStyles: Record<string, string> = {
  'Alumni Survey': 'bg-indigo-600 text-white',
  'Employer Survey': 'bg-emerald-600 text-white',
};

const formatScore = (value: number | null) => (value === null ? 'N/A' : value.toFixed(2));

const SourceBadge: React.FC<{ q: PEOQuestionBreakdownItem }> = ({ q }) => {
  const source = q.source || 'Alumni Survey';
  const classes = sourceStyles[source] || 'bg-slate-600 text-white';
  const legacyTag = q.legacy ? (
    <span className="ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-800 border border-yellow-200">
      legacy
    </span>
  ) : null;
  return (
    <>
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${classes}`}>
        {source === 'Alumni Survey' ? '🎓 Alumni' : '💼 Employer'}
      </span>
      {legacyTag}
    </>
  );
};

const PEOQuestionBreakdown: React.FC<PEOQuestionBreakdownProps> = ({ breakdowns, matrix }) => {
  const visibleRows = matrix.filter(
    (row) =>
      (row.indirectQuestionRows && row.indirectQuestionRows.length > 0) ||
      breakdowns.some((breakdown) => breakdown.peoId === row.peoId && breakdown.questions.length > 0),
  );
  const items = visibleRows.map((row) => {
    const legacyItem = breakdowns.find((b) => b.peoId === row.peoId);
    const questions: PEOQuestionBreakdownItem[] =
      row.indirectQuestionRows && row.indirectQuestionRows.length > 0
        ? row.indirectQuestionRows
        : legacyItem?.questions || [];
    return {
      peoId: row.peoId,
      description: row.description,
      targetPercentage: row.targetPercentage,
      achievedPercentage: row.combinedAttainmentPercentage,
      questions,
    };
  }).filter((item) => item.questions.length > 0);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No question-wise survey breakdown is available for this PEO report yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => {
        const withSource = item.questions.filter((q) => !!q.source);
        const grouped: Record<string, PEOQuestionBreakdownItem[]> = {};
        if (withSource.length === item.questions.length) {
          item.questions.forEach((q) => {
            const key = q.source || 'Alumni Survey';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(q);
          });
        }
        return (
          <section key={item.peoId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {item.description || 'PEO'}{' '}
                <span className="text-slate-500 text-sm font-semibold">
                  (Target: {item.targetPercentage.toFixed(2)}% | Achieved:{' '}
                  {item.achievedPercentage === null || item.achievedPercentage === undefined
                    ? 'N/A'
                    : `${item.achievedPercentage.toFixed(2)}%`}
                  )
                </span>
              </h3>
            </div>

            {Object.keys(grouped).length > 0 ? (
              <div className="space-y-5">
                {Object.entries(grouped).map(([source, qs]) => (
                  <div key={source}>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                      {sourceStyles[source] && (
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black text-white ${sourceStyles[source]}`}>
                          {source === 'Alumni Survey' ? '🎓' : '💼'}
                        </span>
                      )}
                      {source} ({qs.length} question{qs.length > 1 ? 's' : ''})
                    </div>
                    <div className="space-y-3">
                      {qs.map((question, idx) => (
                        <div
                          key={`${question.questionText}-${idx}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-2">
                              <SourceBadge q={question} />
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {item.questions.map((question, idx) => (
                  <div
                    key={`${question.questionText}-${idx}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        {question.source && <SourceBadge q={question} />}
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
            )}
          </section>
        );
      })}
    </div>
  );
};

export default PEOQuestionBreakdown;
