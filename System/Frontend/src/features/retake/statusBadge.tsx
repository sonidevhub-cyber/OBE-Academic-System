import React from 'react';
import type { RetakeStatus } from './types';

type BadgeMeta = {
  label: string;
  className: string;
};

export const getRetakeStatusBadgeMeta = (status: RetakeStatus): BadgeMeta => {
  switch (status) {
    case 'passed':
      return {
        label: 'Passed',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'failed_again':
      return {
        label: 'Failed Again',
        className: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    case 'dropped':
      return {
        label: 'Dropped',
        className: 'bg-gray-200 text-gray-700 border-gray-300',
      };
    case 'ongoing':
    default:
      return {
        label: 'Ongoing',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
  }
};

export const RetakeStatusBadge: React.FC<{ status: RetakeStatus; className?: string }> = ({ status, className = '' }) => {
  const meta = getRetakeStatusBadgeMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${meta.className} ${className}`}>
      {meta.label}
    </span>
  );
};
