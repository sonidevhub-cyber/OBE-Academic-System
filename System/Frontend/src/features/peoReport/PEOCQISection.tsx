import React from 'react';
import type { PEOCQISection } from './types';

interface PEOCQISectionProps {
  sections: PEOCQISection[];
}

const PEOCQISectionComponent: React.FC<PEOCQISectionProps> = ({ sections }) => {
  if (!sections.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No CQI records are available yet for this report cycle.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.peoId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">CQI - {section.peoId}</h3>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                section.cqiStatus === 'Closed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {section.cqiStatus}
            </span>
          </div>

          {section.cqiPending ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              CQI action plan not yet submitted by HOD.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Identified Weakness
              </p>
              <p className="text-slate-700">
                {section.rootCause || 'Pending HOD submission'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Corrective Action Plan
              </p>
              <p className="text-slate-700">
                {section.remedialPlan || 'Pending HOD submission'}
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Approved By:</span>{' '}
            {section.hodApprovedBy && section.hodApprovedDate
              ? `${section.hodApprovedBy} on ${section.hodApprovedDate}`
              : section.hodApprovedBy || 'Pending HOD Approval'}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PEOCQISectionComponent;
