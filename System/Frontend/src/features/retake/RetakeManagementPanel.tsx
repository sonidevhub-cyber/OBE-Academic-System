import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import AssignRetakeForm from './AssignRetakeForm';
import { getRetakes, updateRetakeStatus } from './retakeApi';
import { RetakeStatusBadge } from './statusBadge';
import type { CourseRetake, RetakeStatus } from './types';

const RetakeManagementPanel: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [retakes, setRetakes] = useState<CourseRetake[]>([]);

  const isSac = currentUser?.effective_role === 'SAC' || currentUser?.role === 'SAC';

  const loadRetakes = async () => {
    try {
      setLoading(true);
      const data = await getRetakes();
      setRetakes(data);
    } catch (error) {
      console.error('Failed to load retakes', error);
      toast.error('Failed to load retake records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSac) {
      loadRetakes();
    } else {
      setLoading(false);
    }
  }, [isSac]);

  const handleStatusChange = async (retakeId: string, nextStatus: RetakeStatus) => {
    setRetakes((prev) => prev.map((retake) => (retake.id === retakeId ? { ...retake, status: nextStatus } : retake)));

    try {
      const updated = await updateRetakeStatus(retakeId, nextStatus);
      setRetakes((prev) => prev.map((retake) => (retake.id === retakeId ? updated : retake)));
      toast.success('Retake status updated');
    } catch (error) {
      console.error('Failed to update retake status', error);
      toast.error('Failed to update retake status');
      await loadRetakes();
    }
  };

  if (!isSac) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-6 text-sm text-gray-500">
        Retake management is restricted to SAC users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Retake Management</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              SAC can assign retakes, track attempts, and update outcomes from here.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRetakes}
            className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-900"
          >
            Refresh
          </button>
        </div>

        <AssignRetakeForm onCreated={loadRetakes} />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="text-xl font-black text-gray-900">Current Retakes</h4>
            <p className="text-sm font-medium text-gray-500">
              Review all retake assignments created by SAC.
            </p>
          </div>
          <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
            {retakes.length} total
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm font-medium text-gray-500">Loading retakes...</div>
        ) : retakes.length === 0 ? (
          <div className="py-10 text-center text-sm font-medium text-gray-500">No retake records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">Course</th>
                  <th className="pb-3 pr-4">Batch</th>
                  <th className="pb-3 pr-4">Teacher</th>
                  <th className="pb-3 pr-4">Attempt</th>
                  <th className="pb-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {retakes.map((retake) => (
                  <tr key={retake.id} className="align-middle border-b border-gray-50 last:border-b-0">
                    <td className="py-4 pr-4">
                      <div className="font-bold text-gray-900">{retake.student?.name}</div>
                      <div className="text-xs text-gray-500">
                        {retake.student?.registration_number || retake.current_batch?.name}
                      </div>
                    </td>
                    <td className="py-4 pr-4 font-semibold text-gray-700">{retake.failed_course?.name}</td>
                    <td className="py-4 pr-4 text-sm text-gray-600">{retake.current_batch?.name}</td>
                    <td className="py-4 pr-4 text-sm text-gray-600">{retake.retake_teacher?.name || 'Unassigned'}</td>
                    <td className="py-4 pr-4 text-sm font-bold text-gray-700">{retake.attempt_number}</td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <RetakeStatusBadge status={retake.status} />
                        <select
                          value={retake.status}
                          onChange={(event) => handleStatusChange(retake.id, event.target.value as RetakeStatus)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="ongoing">Ongoing</option>
                          <option value="passed">Passed</option>
                          <option value="failed_again">Failed Again</option>
                          <option value="dropped">Dropped</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetakeManagementPanel;
