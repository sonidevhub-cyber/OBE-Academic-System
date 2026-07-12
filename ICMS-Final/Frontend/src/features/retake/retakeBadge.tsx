import React from 'react';

import type { RetakeStatus } from './types';

type RetakeBadgeProps = {
  attemptNumber: number;
  status?: RetakeStatus;
  className?: string;
};

const statusStyles: Record<RetakeStatus, string> = {
  ongoing: 'bg-amber-100 text-amber-800 border-amber-200',
  passed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed_again: 'bg-rose-100 text-rose-800 border-rose-200',
};

const statusLabels: Record<RetakeStatus, string> = {
  ongoing: 'Ongoing',
  passed: 'Passed',
  failed_again: 'Failed Again',
};

export const RetakeBadge: React.FC<RetakeBadgeProps> = ({ attemptNumber, status = 'ongoing', className = '' }) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide',
        statusStyles[status],
        className,
      ].join(' ')}
    >
      <span>Retake · Attempt {attemptNumber}</span>
      <span className="opacity-75">• {statusLabels[status]}</span>
    </span>
  );
};

export default RetakeBadge;
