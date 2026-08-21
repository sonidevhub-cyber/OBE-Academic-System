import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import { getRetakeInvalidationLogs } from './retakeApi';
import RetakeBadge from './retakeBadge';
import type { InvalidationLogEntry } from './types';

type InvalidationLogTableProps = {
  studentId?: string;
};

const fmt = (value: string | null | undefined) => {
  if (!value) return 'Pending';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const PendingBadge: React.FC = () => (
  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
    Pending
  </span>
);

const InvalidationLogTable: React.FC<InvalidationLogTableProps> = ({ studentId }) => {
  const { currentUser } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const allowed = ['hod', 'SAC', 'sac'].includes(String(role));

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InvalidationLogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      if (!studentId) {
        setRows([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getRetakeInvalidationLogs(studentId);
        if (!cancelled) {
          setRows(data);
        }
      } catch (error) {
        console.error('Failed to load invalidation logs', error);
        toast.error('Failed to load invalidation logs');
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
  }, [studentId]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Invalidations are visible to HOD and SAC users only.
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Provide a student id to view their retake invalidation history.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading invalidation history...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-2xl font-black text-gray-900">Retake Invalidation Log</h3>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Student-scoped audit trail of report invalidations triggered by retake finalization.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm font-medium text-gray-500">
          No invalidation records found for this student.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pr-4">Student</th>
                <th className="py-3 pr-4">Triggered By</th>
                <th className="py-3 pr-4">Affected Student Report</th>
                <th className="py-3 pr-4">Affected Batch Report</th>
                <th className="py-3 pr-4">Triggered At</th>
                <th className="py-3 pr-4">Resolved At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 pr-4">
                    <div className="font-bold text-gray-900">{row.studentName}</div>
                    <div className="text-xs text-gray-500">{row.studentRegistrationNumber || row.studentId}</div>
                  </td>
                  <td className="py-4 pr-4 text-sm text-gray-700">
                    {row.retake ? (
                      <RetakeBadge attemptNumber={row.retake.attempt_number} status={row.retake.status} />
                    ) : (
                      'Retake'
                    )}
                  </td>
                  <td className="py-4 pr-4 text-sm font-medium text-gray-700">
                    {row.affectedStudentReport ? 'Yes' : 'No'}
                  </td>
                  <td className="py-4 pr-4 text-sm font-medium text-gray-700">
                    {row.affectedBatchReport ? 'Yes' : 'No'}
                  </td>
                  <td className="py-4 pr-4 text-sm text-gray-600">{fmt(row.triggeredAt)}</td>
                  <td className="py-4 pr-4 text-sm text-gray-600">
                    {row.resolvedAt ? fmt(row.resolvedAt) : <PendingBadge />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvalidationLogTable;
