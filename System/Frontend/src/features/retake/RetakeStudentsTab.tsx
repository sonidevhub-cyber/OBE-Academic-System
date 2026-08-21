import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { getRetakeAssessmentContext, getRetakes, updateRetakeStatus } from './retakeApi';
import { RetakeStatusBadge } from './statusBadge';
import type { CourseRetake, RetakeStatus } from './types';

const RetakeStudentsTab: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;

  const [loading, setLoading] = useState(true);
  const [retakes, setRetakes] = useState<CourseRetake[]>([]);
  const [openingRetakeId, setOpeningRetakeId] = useState<string | null>(null);

  useEffect(() => {
    const loadRetakes = async () => {
      try {
        const data = await getRetakes();
        setRetakes(data);
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
      const refreshed = await getRetakes();
      setRetakes(refreshed);
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
                <th className="py-3 pr-4">Attempt Number</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {retakes.map((retake) => (
                <tr key={retake.id} className="align-middle">
                  <td className="py-4 pr-4">
                    <div className="font-bold text-gray-900">{retake.student?.name}</div>
                    <div className="text-xs font-medium text-gray-400">
                      {retake.current_batch?.name}
                    </div>
                  </td>
                  <td className="py-4 pr-4 font-semibold text-gray-700">{retake.failed_course?.name}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-gray-700">
                      {retake.attempt_number}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <RetakeStatusBadge status={retake.status} />
                  </td>
                  <td className="py-4 pr-4">
                    <select
                      value={retake.status}
                      onChange={(event) => handleStatusChange(retake.id, event.target.value as RetakeStatus)}
                      className="w-full max-w-[180px] rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:ring-0"
                    >
                      <option value="ongoing">Ongoing</option>
                      <option value="passed">Passed</option>
                      <option value="failed_again">Failed Again</option>
                    </select>
                  </td>
                  <td className="py-4 pr-4">
                    <button
                      type="button"
                      onClick={() => handleOpenAssessment(retake.id)}
                      disabled={openingRetakeId === retake.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {openingRetakeId === retake.id ? 'Opening...' : 'Open Assessment'}
                    </button>
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

export default RetakeStudentsTab;
