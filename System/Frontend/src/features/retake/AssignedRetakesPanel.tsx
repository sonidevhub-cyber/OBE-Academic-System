import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getMyAssignedRetakes } from './retakeApi';
import { RetakeStatusBadge } from './statusBadge';
import type { CourseRetake, RetakeAssessmentGroup } from './types';

interface AssignedRetakesPanelProps {
  onOpenResults?: (group: RetakeAssessmentGroup) => void;
}

const AssignedRetakesPanel: React.FC<AssignedRetakesPanelProps> = ({ onOpenResults }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [retakes, setRetakes] = useState<CourseRetake[]>([]);

  const role = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const isInstructor = ['instructor', 'Teacher'].includes(String(role));

  const retakeGroups = useMemo<RetakeAssessmentGroup[]>(() => {
    const grouped = new Map<string, RetakeAssessmentGroup>();

    retakes.forEach((retake) => {
      const courseId = String(retake.failed_course?.id || '');
      const batchId = String(retake.current_batch?.id || '');
      const attemptNumber = retake.attempt_number;
      const groupKey = `${courseId}:${batchId}:${attemptNumber}`;
      const existing = grouped.get(groupKey);

      if (existing) {
        existing.retakes.push(retake);
        return;
      }

      grouped.set(groupKey, {
        groupKey,
        courseId,
        courseName: retake.failed_course?.name || 'Course',
        batchId,
        batchName: retake.current_batch?.name || 'Batch',
        currentSemester: retake.current_batch?.current_semester,
        curriculumVersionId: retake.current_batch?.curriculum_version_id,
        attemptNumber,
        status: retake.status,
        retakes: [retake],
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const batchCompare = a.batchName.localeCompare(b.batchName);
      if (batchCompare !== 0) return batchCompare;
      const courseCompare = a.courseName.localeCompare(b.courseName);
      if (courseCompare !== 0) return courseCompare;
      return Number(a.attemptNumber) - Number(b.attemptNumber);
    });
  }, [retakes]);

  const loadRetakes = async () => {
    try {
      setLoading(true);
      const data = await getMyAssignedRetakes();
      setRetakes(data);
    } catch (error) {
      console.error('Failed to load assigned retakes', error);
      toast.error('Failed to load assigned retakes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInstructor) {
      loadRetakes();
    } else {
      setLoading(false);
    }
  }, [isInstructor]);

  if (!isInstructor) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-6 text-sm text-gray-500">
        Assigned retakes are visible to instructors only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Assigned Retakes</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              SAC-assigned retake students appear here so you can handle their assessment work.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRetakes}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm font-medium text-gray-500">Loading assigned retakes...</div>
        ) : retakeGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm font-medium text-gray-500">
            No retakes have been assigned to you yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                  <th className="pb-3 pr-4">Course</th>
                  <th className="pb-3 pr-4">Batch</th>
                  <th className="pb-3 pr-4">Attempt</th>
                  <th className="pb-3 pr-4">Students</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {retakeGroups.map((group) => (
                  <tr key={group.groupKey} className="align-middle border-b border-gray-50 last:border-b-0">
                    <td className="py-4 pr-4 font-semibold text-gray-700">{group.courseName}</td>
                    <td className="py-4 pr-4 text-sm text-gray-600">{group.batchName}</td>
                    <td className="py-4 pr-4 text-sm font-bold text-gray-700">{group.attemptNumber}</td>
                    <td className="py-4 pr-4">
                      <div className="font-bold text-gray-900">{group.retakes.length} student(s)</div>
                      <div className="text-xs text-gray-500">
                        {group.retakes.slice(0, 3).map((retake) => retake.student?.name).filter(Boolean).join(', ')}
                        {group.retakes.length > 3 ? ` +${group.retakes.length - 3} more` : ''}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <RetakeStatusBadge status={group.status} />
                    </td>
                    <td className="py-4 pr-4">
                      {onOpenResults ? (
                        <button
                          type="button"
                          onClick={() => onOpenResults(group)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                        >
                          <ClipboardList className="h-4 w-4" />
                          Open Group
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-gray-400">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <div className="flex items-center justify-between gap-4">
          <p className="leading-6">
            Retakes are grouped by batch, course, and attempt number so one marking screen can handle the full group.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssignedRetakesPanel;
