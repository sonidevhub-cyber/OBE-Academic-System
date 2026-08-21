export type RetakeAttemptNumber = 1 | 2 | 3;
export type RetakeStatus = 'ongoing' | 'passed' | 'failed_again';

export interface RetakeRelation {
  id: string;
  name: string;
}

export interface RetakeBatchRelation extends RetakeRelation {
  current_semester?: number;
  curriculum_version_id?: string;
}

export interface RetakeGAScore {
  id: string;
  course_session: string;
  course_code: string;
  ga: string;
  ga_title: string;
  score: number;
  enrolled_students?: number;
  calculated_at: string;
  is_stale: boolean;
}

export interface CourseRetake {
  id: string;
  student: RetakeRelation;
  failed_course: RetakeRelation;
  failed_batch: RetakeBatchRelation;
  current_batch: RetakeBatchRelation;
  retake_teacher: RetakeRelation | null;
  attempt_number: RetakeAttemptNumber;
  status: RetakeStatus;
  is_active: boolean;
  ga_score: RetakeGAScore | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRetakePayload {
  student: string;
  failed_course: string;
  failed_batch: string;
  current_batch: string;
  retake_teacher?: string | null;
}

export interface TeacherOption {
  id: string;
  name: string;
}

export interface StudentOption {
  id: string;
  name: string;
  registration_number?: string;
  batch_id?: string;
  batch_name?: string;
}

export interface CourseOption {
  id: string;
  name: string;
  code?: string;
  semester_no?: number;
}

export interface BatchOption {
  id: string;
  name: string;
  current_semester?: number;
  curriculum_version_id?: number;
}

export interface AssessmentQuestion {
  id: string;
  description: string;
  bloom_level: string;
  marks: number;
  clo: string;
  clo_code?: string;
}

export interface AssessmentStructureItem {
  id: string;
  title: string;
  assessment_type: string;
  total_marks: number;
  assessment_date: string;
  is_finalized: boolean;
  questions: AssessmentQuestion[];
  student_marks: Array<{
    question_id: string;
    marks_obtained: number;
  }>;
}

export interface AssessmentContext {
  retakeId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentRegistrationNumber?: string;
  batchId?: string;
  batchName?: string;
  currentSemester?: number;
  attemptNumber?: RetakeAttemptNumber;
  status?: RetakeStatus;
  assessmentStructure: AssessmentStructureItem[];
  curriculumVersionId?: string;
}

export interface InvalidationLogEntry {
  id: string;
  studentId: string;
  studentName: string;
  studentRegistrationNumber?: string;
  triggeredByRetakeId?: string | null;
  retake?: {
    id: string;
    attempt_number: number;
    status: RetakeStatus;
    course_id: string;
    batch_id?: string;
  } | null;
  affectedStudentReport: boolean;
  affectedBatchReport: boolean;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface FailedStudentOption {
  student_id: string;
  name: string;
  registration_number?: string;
  last_percentage?: number | null;
  last_grade?: string | null;
  current_retake_attempts: number;
  has_active_retake: boolean;
}

export interface PreviousInstructorInfo {
  teacher_id?: string | null;
  name?: string | null;
  found: boolean;
}

export interface PerStudentRetakeResult {
  student_id: string;
  success: boolean;
  error?: string | null;
  retake_id?: string | null;
  attempt_number?: number | null;
}

export interface BulkRetakeAssignmentPayload {
  batch_id: string;
  course_id: string;
  teacher_id?: string | null;
  student_ids: string[];
}

export interface BulkRetakeAssignmentResponse {
  results: PerStudentRetakeResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
