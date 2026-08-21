import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { getPendingRetakeInvalidations } from './retakeApi';
import type { InvalidationLogEntry } from './types';

type StaleReportBannerProps = {
  studentId?: string;
  batchId?: string;
  className?: string;
};

const matchesContext = (entry: InvalidationLogEntry, studentId?: string, batchId?: string) => {
  if (studentId) {
    return String(entry.studentId) === String(studentId);
  }

  if (batchId) {
    return String(entry.retake?.batch_id || '') === String(batchId);
  }

  return true;
};

const StaleReportBanner: React.FC<StaleReportBannerProps> = ({ studentId, batchId, className = '' }) => {
  const [rows, setRows] = useState<InvalidationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      try {
        setLoading(true);
        const pending = await getPendingRetakeInvalidations({ studentId, batchId });
        if (!cancelled) {
          setRows(pending.filter((row) => matchesContext(row, studentId, batchId)));
        }
      } catch (error) {
        console.error('Failed to load pending retake invalidations', error);
        if (!cancelled) {
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRows();

    return () => {
      cancelled = true;
    };
  }, [studentId, batchId]);

  const hasPending = useMemo(() => rows.some((row) => row.resolvedAt === null), [rows]);

  if (loading || !hasPending) {
    return null;
  }

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm',
        className,
      ].join(' ')}
    >
      <div className="rounded-full bg-amber-500 p-2 text-white">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-black">Updated retake data available</div>
        <p className="mt-1 text-xs font-medium text-amber-900/80">
          This report will refresh automatically when reopened.
        </p>
      </div>
    </div>
  );
};

export default StaleReportBanner;
