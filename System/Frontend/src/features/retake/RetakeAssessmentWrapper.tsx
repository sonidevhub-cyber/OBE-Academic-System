import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { getRetakeAssessmentContext } from './retakeApi';
import type { AssessmentContext, CourseRetake, RetakeAssessmentGroup } from './types';
import ManageClass from '../../views/pages/ManageClass';
import RetakeBadge from './retakeBadge';

type RetakeAssessmentLocationState = {
  retake?: CourseRetake;
  retakeGroup?: RetakeAssessmentGroup;
  assessmentContext?: AssessmentContext;
};

const normalizeId = (value: unknown) => (value == null ? '' : String(value));

const RetakeAssessmentWrapper: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const params = useParams<{ retakeId?: string }>();
  const state = (location.state as RetakeAssessmentLocationState | null) || null;

  const retakeId = useMemo(
    () => normalizeId(searchParams.get('retake_id') || params.retakeId || state?.retake?.id),
    [params.retakeId, searchParams, state?.retake?.id]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentContext, setAssessmentContext] = useState<AssessmentContext | null>(state?.assessmentContext || null);
  const retake = state?.retake || null;
  const retakeGroup = state?.retakeGroup || null;
  const groupRetakes = retakeGroup?.retakes || (retake ? [retake] : []);
  const studentIds = groupRetakes.map((item) => normalizeId(item.student?.id)).filter(Boolean);
  const retakeIdByStudentId = groupRetakes.reduce<Record<string, string>>((acc, item) => {
    const studentId = normalizeId(item.student?.id);
    if (studentId) {
      acc[studentId] = normalizeId(item.id);
    }
    return acc;
  }, {});

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      if (!retakeId) {
        setError('Missing retake id.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (!assessmentContext) {
          const context = await getRetakeAssessmentContext(retakeId);
          if (!cancelled) {
            setAssessmentContext(context);
          }
        }
      } catch (loadError) {
        console.error('Failed to load retake assessment context', loadError);
        if (!cancelled) {
          setError('Failed to load retake assessment context.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [assessmentContext, retakeId]);

  const currentSemester = assessmentContext?.currentSemester ?? retakeGroup?.currentSemester ?? retake?.current_batch?.current_semester ?? 1;
  const semesterNumber = String(currentSemester || 1);
  const semesterId = String(currentSemester || 1);
  const batchId = assessmentContext?.batchId || retakeGroup?.batchId || normalizeId(retake?.current_batch?.id);
  const courseId = assessmentContext?.courseId || retakeGroup?.courseId || normalizeId(retake?.failed_course?.id);
  const studentId = assessmentContext?.studentId || normalizeId(retake?.student?.id);
  const studentName = assessmentContext?.studentName || retake?.student?.name || 'Student';
  const attemptNumber = assessmentContext?.attemptNumber ?? retakeGroup?.attemptNumber ?? retake?.attempt_number ?? 1;
  const status = assessmentContext?.status ?? retakeGroup?.status ?? retake?.status ?? 'ongoing';
  const curriculumVersionId = assessmentContext?.curriculumVersionId || retakeGroup?.curriculumVersionId || normalizeId(retake?.current_batch?.curriculum_version_id);
  const isGroupMode = groupRetakes.length > 1;

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm font-medium text-gray-500">
        Loading retake assessment context...
      </div>
    );
  }

  if (error || !retakeId || !courseId || !batchId || (!studentId && studentIds.length === 0)) {
    return (
      <div className="space-y-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-2xl font-black text-gray-900">Retake Assessment</h3>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {error || 'We could not load the retake context.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/teacher')}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-indigo-950 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-600 p-2 text-white shadow-sm">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-black">Retake Assessment</h3>
              <RetakeBadge attemptNumber={Number(attemptNumber) || 1} status={status} />
            </div>
            <p className="mt-1 text-sm font-medium text-indigo-900/80">
              {isGroupMode
                ? `Attempt ${attemptNumber} for ${groupRetakes.length} students in ${retakeGroup?.batchName || 'this batch'}`
                : `Attempt ${attemptNumber} for ${studentName}`}
            </p>
            <p className="mt-1 text-xs font-medium text-indigo-900/70">
              {isGroupMode
                ? 'This grouped view saves each student against their own retake record.'
                : 'This view reuses the existing assessment entry flow and limits it to the retake student.'}
            </p>
          </div>
        </div>
      </div>

      <ManageClass
        courseId={courseId}
        batchId={batchId}
        semesterNumber={semesterNumber}
        semesterId={semesterId}
        selectedCourse={null}
        curriculumVersionId={curriculumVersionId}
        historyBatchId={retake?.failed_batch?.id}
        historySemesterId={semesterId}
        retakeStudentId={studentId}
        retakeStudentIds={studentIds}
        retakeId={retakeId}
        retakeIdByStudentId={retakeIdByStudentId}
        retakeGroupLabel={isGroupMode ? `${retakeGroup?.courseName || 'Course'} - ${retakeGroup?.batchName || 'Batch'} - Attempt ${attemptNumber}` : undefined}
      />
    </div>
  );
};

export default RetakeAssessmentWrapper;
