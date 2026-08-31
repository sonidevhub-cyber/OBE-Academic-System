import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, UserMinus } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getRetakeAssessmentContext, getMyAssignedRetakes, updateRetakeStatus } from './retakeApi';
import { RetakeStatusBadge } from './statusBadge';
import type { CourseRetake, RetakeStatus } from './types';

const RetakeStudentsTab: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;

  const [loading, setLoading] = useState(true);
  const [retakes, setRetakes] = useState<CourseRetake[]>([]);
  const [openingRetakeId, setOpeningRetakeId] = useState<string | null>(null);
  const [confirmDropRetakeId, setConfirmDropRetakeId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadRetakes = async () => {
      try {
        const data = await getMyAssignedRetakes();
        const activeRetakes = data.filter((retake) => {
          if (retake.status === 'failed_again' || retake.status === 'passed' || retake.status === 'dropped') {
            return false;
          }
          return true;
        });
        setRetakes(activeRetakes);
      } catch (error) {
        console.error('Failed to load retakes', error);
        toast.error('Failed to load retake records');
      } finally {
        setLoading(false);
      }
    };

    loadRetakes();
  }, []);

  const handleStatusChange = async (retakeId: string, nextStatus: RetakeStatus) => {
    setRetakes((prev) =>
      prev.map((retake) => (retake.id === retakeId ? { ...retake, status: nextStatus } : retake))
    );

    try {
      const updated = await updateRetakeStatus(retakeId, nextStatus);
      setRetakes((prev) => prev.map((retake) => (retake.id === retakeId ? updated : retake)));
      toast.success('Retake status updated');
    } catch (error) {
      console.error('Failed to update retake status', error);
      toast.error('Failed to update retake status');
      const refreshed = await getMyAssignedRetakes();
      setRetakes(refreshed);
    }
  };

  const handleDropRetake = async (retake: CourseRetake) => {
    setActionLoading(true);
    try {
      const updated = await updateRetakeStatus(retake.id, 'dropped');
      setRetakes((prev) => prev.map((r) => (r.id === retake.id ? updated : r)));
      setConfirmDropRetakeId(null);
      toast.success(`Retake marked as dropped for ${retake.student?.name}`);
    } catch (error) {
      console.error('Failed to drop retake', error);
      toast.error('Failed to drop retake');
      const refreshed = await getMyAssignedRetakes();
      setRetakes(refreshed);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAssessment = async (retakeId: string) => {
    try {
      setOpeningRetakeId(retakeId);
      const assessmentContext = await getRetakeAssessmentContext(retakeId);

      navigate(`/teacher?retake_id=${encodeURIComponent(retakeId)}&tab=retakes`, {
        state: {
          assessmentContext,
        },
      });
    } catch (error) {
      console.error('Failed to load retake assessment context before navigation', error);
      navigate(`/teacher?retake_id=${encodeURIComponent(retakeId)}&tab=retakes`);
      toast.error('Failed to open retake assessment');
    } finally {
      setOpeningRetakeId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading auth state...
      </div>
    );
  }

  if (role !== 'SAC') {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Retake records are only visible to SAC users.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
        Loading retake students...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6">
        <h3 className="text-2xl font-black text-gray-900">Retake Records</h3>
        <p className="mt-1 text-sm font-medium text-gray-500">
          Review retake assignments and update outcomes.
        </p>
      </div>

      {retakes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm font-medium text-gray-500">
          No retake records found currently
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pr-4">Student Name</th>
                <th className="py-3 pr-4">Course</th>
                <th className="py-3 pr-4">Attempt</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Assessment</th>
                <th className="py-3 pr-4">Drop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {retakes.map((retake) => {
                const isAttempt3Failed = retake.attempt_number === 3 && retake.status === 'failed_again';
                const canDrop = retake.status !== 'dropped' && retake.status !== 'passed';
                return (
                <tr key={retake.id} className={`align-middle ${isAttempt3Failed ? 'bg-rose-50/50' : ''}`}>
                  <td className="py-4 pr-4">
                    <div className="font-bold text-gray-900">{retake.student?.name}</div>
                    <div className="text-xs font-medium text-gray-400">
                      {retake.current_batch?.name}
                    </div>
                  </td>
                  <td className="py-4 pr-4 font-semibold text-gray-700">{retake.failed_course?.name}</td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                        retake.attempt_number === 3 ? 'bg-rose-100 text-rose-700' :
                        retake.attempt_number === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {retake.attempt_number}
                      </span>
                      {isAttempt3Failed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          Max Attempts
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <RetakeStatusBadge status={retake.status} />
                      {retake.status !== 'dropped' && (
                        <select
                          value={retake.status}
                          onChange={(event) => handleStatusChange(retake.id, event.target.value as RetakeStatus)}
                          className="w-full max-w-[180px] rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:ring-0"
                        >
                          <option value="ongoing">Ongoing</option>
                          <option value="passed">Passed</option>
                          <option value="failed_again">Failed Again</option>
                          <option value="dropped">Dropped</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    {retake.status !== 'dropped' && retake.status !== 'passed' ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAssessment(retake.id)}
                        disabled={openingRetakeId === retake.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {openingRetakeId === retake.id ? 'Opening...' : 'Open Assessment'}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    {canDrop && (
                      confirmDropRetakeId === retake.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-700 whitespace-nowrap">Confirm?</span>
                          <button
                            type="button"
                            onClick={() => handleDropRetake(retake)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                          >
                            {actionLoading ? '...' : 'Yes Drop'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDropRetakeId(null)}
                            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDropRetakeId(retake.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                            isAttempt3Failed
                              ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <UserMinus className="w-4 h-4" />
                          <span>{isAttempt3Failed ? 'Drop (Required)' : 'Drop'}</span>
                        </button>
                      )
                    )}
                    {!canDrop && <span className="text-xs font-medium text-gray-400">—</span>}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RetakeStudentsTab;
