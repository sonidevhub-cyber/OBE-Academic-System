import { api } from '../../api/api';
import type {
  AssessmentContext,
  BulkRetakeAssignmentPayload,
  BulkRetakeAssignmentResponse,
  CourseRetake,
  CreateRetakePayload,
  FailedStudentOption,
  InvalidationLogEntry,
  PreviousInstructorInfo,
  RetakeStatus,
} from './types';

const unwrapList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.results)) return payload.results as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  return [];
};

export async function createRetake(payload: CreateRetakePayload): Promise<CourseRetake> {
  const response = await api.post('retakes/', payload);
  return response.data;
}

export async function getFailedStudentsForBatchCourse(
  batchId: string,
  courseId: string
): Promise<FailedStudentOption[]> {
  const response = await api.get('retakes/lookup/failed-students/', {
    params: {
      batch_id: batchId,
      course_id: courseId,
    },
  });
  return unwrapList<FailedStudentOption>(response.data);
}

export async function getPreviousInstructor(
  batchId: string,
  courseId: string
): Promise<PreviousInstructorInfo> {
  const response = await api.get('retakes/lookup/previous-instructor/', {
    params: {
      batch_id: batchId,
      course_id: courseId,
    },
  });
  const data = response.data || {};
  return {
    teacher_id: data.teacher_id ?? null,
    name: data.name ?? null,
    found: Boolean(data.found),
  };
}

export async function bulkAssignRetakes(
  payload: BulkRetakeAssignmentPayload
): Promise<BulkRetakeAssignmentResponse> {
  const response = await api.post('retakes/bulk-assign/', payload);
  const data = response.data || {};
  return {
    results: Array.isArray(data.results) ? data.results : [],
    summary: data.summary || { total: 0, succeeded: 0, failed: 0 },
  };
}

export async function getRetakes(): Promise<CourseRetake[]> {
  const response = await api.get('retakes/');
  return unwrapList<CourseRetake>(response.data);
}

export async function getMyAssignedRetakes(): Promise<CourseRetake[]> {
  const response = await api.get('retakes/my-assigned/');
  return unwrapList<CourseRetake>(response.data);
}

export async function updateRetakeStatus(id: string, status: RetakeStatus): Promise<CourseRetake> {
  const response = await api.patch(`retakes/${id}/status/`, { status });
  return response.data;
}

export async function getStudentRetakeHistory(studentId: string): Promise<CourseRetake[]> {
  const response = await api.get(`retakes/student/${studentId}/`);
  return unwrapList<CourseRetake>(response.data);
}

export async function getRetakeAssessmentContext(retakeId: string): Promise<AssessmentContext & { raw?: any }> {
  const response = await api.get(`retakes/${retakeId}/assessment-context/`);
  const data = response.data || {};

  return {
    retakeId: String(data.retake_id || retakeId),
    courseId: String(data.course_id || ''),
    studentId: String(data.student_id || ''),
    studentName: String(data.student?.name || ''),
    studentRegistrationNumber: data.student?.registration_number ? String(data.student.registration_number) : undefined,
    batchId: data.batch_id ? String(data.batch_id) : undefined,
    batchName: data.batch?.name ? String(data.batch.name) : undefined,
    currentSemester: typeof data.batch?.current_semester === 'number' ? data.batch.current_semester : undefined,
    curriculumVersionId: data.batch?.curriculum_version_id ? String(data.batch.curriculum_version_id) : undefined,
    attemptNumber: data.attempt_number,
    status: data.status,
    assessmentStructure: Array.isArray(data.assessments) ? data.assessments : [],
    raw: data,
  };
}

export async function getPendingRetakeInvalidations(
  params: { studentId?: string; batchId?: string } = {}
): Promise<InvalidationLogEntry[]> {
  const response = await api.get('retakes/invalidation-log/pending/', {
    params: {
      student_id: params.studentId,
      batch_id: params.batchId,
    },
  });
  const rows = unwrapList<any>(response.data);

  return rows.map((row) => ({
    id: String(row.id),
    studentId: String(row.student_id || row.student || ''),
    studentName: String(row.student_name || row.student?.name || ''),
    studentRegistrationNumber: row.student_registration_number ? String(row.student_registration_number) : undefined,
    triggeredByRetakeId: row.triggered_by_retake ? String(row.triggered_by_retake) : row.retake?.id || null,
    retake: row.retake
      ? {
          id: String(row.retake.id),
          attempt_number: Number(row.retake.attempt_number),
          status: row.retake.status,
          course_id: String(row.retake.course_id || ''),
          batch_id: row.retake.batch_id ? String(row.retake.batch_id) : undefined,
        }
      : null,
    affectedStudentReport: Boolean(row.affected_student_report),
    affectedBatchReport: Boolean(row.affected_batch_report),
    triggeredAt: String(row.triggered_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  }));
}

export async function getRetakeInvalidationLogs(studentId: string): Promise<InvalidationLogEntry[]> {
  const response = await api.get('retakes/invalidation-log/', {
    params: { student_id: studentId },
  });
  const rows = unwrapList<any>(response.data);

  return rows.map((row) => ({
    id: String(row.id),
    studentId: String(row.student_id || row.student || ''),
    studentName: String(row.student_name || row.student?.name || ''),
    studentRegistrationNumber: row.student_registration_number ? String(row.student_registration_number) : undefined,
    triggeredByRetakeId: row.triggered_by_retake ? String(row.triggered_by_retake) : row.retake?.id || null,
    retake: row.retake
      ? {
          id: String(row.retake.id),
          attempt_number: Number(row.retake.attempt_number),
          status: row.retake.status,
          course_id: String(row.retake.course_id || ''),
          batch_id: row.retake.batch_id ? String(row.retake.batch_id) : undefined,
        }
      : null,
    affectedStudentReport: Boolean(row.affected_student_report),
    affectedBatchReport: Boolean(row.affected_batch_report),
    triggeredAt: String(row.triggered_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  }));
}
