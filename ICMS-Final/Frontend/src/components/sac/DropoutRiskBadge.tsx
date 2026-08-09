import React from 'react';
import { DropoutRiskFlag } from '../../api/promotionService';

interface DropoutRiskBadgeProps {
  flags?: DropoutRiskFlag[];
}

const getFlagLabel = (flag: DropoutRiskFlag) => {
  if (flag.flag_type === 'CGPA_DECLINE' && flag.severity === 'CRITICAL') {
    return 'CGPA Risk (Critical)';
  }

  if (flag.flag_type === 'CGPA_DECLINE') {
    return 'CGPA Risk';
  }

  if (flag.flag_type === 'RETAKE_EXHAUSTED') {
    return 'Retake Exhausted';
  }

  return 'Dropout Risk';
};

const getFlagClassName = (flag: DropoutRiskFlag) => {
  if (flag.severity === 'CRITICAL') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const formatDetails = (details: Record<string, any>) => {
  if (!details || Object.keys(details).length === 0) {
    return 'Risk details unavailable.';
  }

  if (typeof details.message === 'string') {
    return details.message;
  }

  if (details.subject && details.attempts) {
    return `Subject: ${details.subject} - failed on ${details.attempts} retake attempt${Number(details.attempts) === 1 ? '' : 's'}.`;
  }

  if (Array.isArray(details.semesters)) {
    return `CGPA below threshold: ${details.semesters.map((sem: any) => {
      if (typeof sem === 'string') return sem;
      const label = sem.semester || sem.sem || sem.term || 'Semester';
      const value = sem.cgpa ?? sem.gpa ?? sem.value;
      return value !== undefined ? `${label} (${value})` : label;
    }).join(', ')}`;
  }

  return Object.entries(details)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ');
      const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${label}: ${text}`;
    })
    .join(' | ');
};

const DropoutRiskBadge: React.FC<DropoutRiskBadgeProps> = ({ flags = [] }) => {
  if (!flags.length) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {flags.map((flag, index) => (
        <span key={`${flag.flag_type}-${flag.severity}-${index}`} className="relative inline-flex group">
          <span
            tabIndex={0}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border leading-4 ${getFlagClassName(flag)}`}
            title={formatDetails(flag.triggering_details)}
          >
            <span aria-hidden="true">⚠</span>
            <span>{getFlagLabel(flag)}</span>
          </span>
          <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs font-medium normal-case leading-relaxed text-gray-700 shadow-xl group-hover:block group-focus-within:block">
            {formatDetails(flag.triggering_details)}
          </span>
        </span>
      ))}
    </span>
  );
};

export default DropoutRiskBadge;
