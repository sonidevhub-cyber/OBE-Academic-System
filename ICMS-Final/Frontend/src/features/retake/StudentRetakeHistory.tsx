import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import { getStudentRetakeHistory } from './retakeApi';
import { RetakeStatusBadge } from './statusBadge';
import type { CourseRetake } from './types';

const StudentRetakeHistory: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const selfStudentId =
    currentUser?.student_profile?.student_id ||
    currentUser?.student_id ||
    currentUser?.studentProfile?.student_id ||
    currentUser?.studentProfile?.id ||
    currentUser?.id;
  const canView =
    role === 'SAC' ||
    role === 'coordinator' ||
    role === 'hod' ||
    String(selfStudentId) === String(studentId);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CourseRetake[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!studentId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getStudentRetakeHistory(studentId);
        setHistory(data);
      } catch (error) {
        console.error('Failed to load retake history', error);
        toast.error('Failed to load retake history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [studentId]);

  const sortedHistory = useMemo(() => {
    return [...history].sort((left, right) => left.attempt_number - right.attempt_number);
  }, [history]);

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading auth state...
      </div>
    );
  }

  if (!canView) {
    // TODO: verify this matches the existing role-guard pattern used for embedded profile sections.
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        You do not have permission to view this retake history.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading retake history...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-black text-gray-900">Retake History</h3>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Full audit trail of all retake attempts for this student.
        </p>
      </div>

      {sortedHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm font-medium text-gray-500">
          No retake history found for this student.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pr-4">Course</th>
                <th className="py-3 pr-4">Failed Batch</th>
                <th className="py-3 pr-4">Current Batch</th>
                <th className="py-3 pr-4">Attempt</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Teacher</th>
                <th className="py-3 pr-4">GA Score</th>
                <th className="py-3 pr-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedHistory.map((retake) => (
                <tr
                  key={retake.id}
                  className={`align-middle ${retake.is_active ? '' : 'bg-gray-50 text-gray-500 opacity-70'}`}
                >
                  <td className="py-4 pr-4 font-semibold text-gray-800">{retake.failed_course?.name}</td>
                  <td className="py-4 pr-4 text-sm text-gray-600">{retake.failed_batch?.name}</td>
                  <td className="py-4 pr-4 text-sm text-gray-600">{retake.current_batch?.name}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-gray-700">
                      {retake.attempt_number}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <RetakeStatusBadge status={retake.status} />
                  </td>
                  <td className="py-4 pr-4 text-sm text-gray-600">
                    {retake.retake_teacher?.name || 'Unassigned'}
                  </td>
                  <td className="py-4 pr-4 text-sm font-semibold text-gray-700">
                    {retake.ga_score?.score ?? 'N/A'}
                  </td>
                  <td className="py-4 pr-4">
                    {retake.is_active ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-gray-700">
                        Superseded
                      </span>
                    )}
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

export default StudentRetakeHistory;
