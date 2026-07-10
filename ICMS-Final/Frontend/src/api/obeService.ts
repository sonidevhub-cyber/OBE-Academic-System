
import { api } from './api';

export interface CLOGAMapping {
  clo_id: number | string;
  ga_id: number | string;
  weight: number;
}

export interface MappingMatrix {
  clos: any[];
  gas: Array<{id: string; code: string; title: string}>;
  matrix: Array<{
    clo: string;
    course: string;
    mappings: Record<string, {strength: string | null; value: number}>;
  }>;
  mappings: CLOGAMapping[];
}

export interface PEO {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  kpi_threshold: number;
  is_active: boolean;
  created_at: string;
  alumni_survey_question_text?: string | null;
}

export interface AlumniSurveyQuestion {
  id: string;
  peo: string | PEO;
  peo_id?: string;
  peo_title?: string;
  peo_description?: string;
  question_text: string;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GA {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  kpi_threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface CourseGAScore {
  id: string;
  course_session: string;
  ga: string;
  ga_title: string;
  score: number;
  calculated_at: string;
  is_stale: boolean;
}

export interface GACQIRecord {
  id: string;
  ga: string;
  ga_title: string;
  ga_code: string;
  batch: string;
  batch_name: string;
  cqi_level: 'SEMESTER' | 'CUMULATIVE';
  semester: number | null;
  attainment_value: number | null;
  kpi_threshold_at_trigger: number | null;
  root_cause: string | null;
  remedial_plan: string | null;
  hod_comment: string | null;
  status: 'NOT_TRIGGERED' | 'PENDING_HOD_INPUT' | 'SAVED' | 'EXPORTED' | 'PENDING' | 'SENT_BACK' | 'FULLY_APPROVED';
  submitted_by: any | null;
  approved_by: any | null;
  is_audit_visible: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  history?: GACQIResubmissionHistory[];
  contributing_courses?: GAReportContributingCourse[];
  issue_statement: string | null;
  hod_action_plan: string | null;
  triggered_at: string | null;
  saved_by_hod: any | null;
  saved_at: string | null;
  is_active: boolean;
}

export interface GACQIResubmissionHistory {
  id: string;
  cqi_record: string;
  root_cause_snapshot: string | null;
  remedial_plan_snapshot: string | null;
  hod_comment_snapshot: string | null;
  status_at_time: string;
  submitted_at: string;
}

export interface GAReportContributingCourse {
  course_code: string;
  course_name?: string;
  course_ga_score: number; // Direct score
  course_feedback_score?: number | null; // Indirect (CF) score
  enrolled_students?: number;
  semester?: number | null;
  credits?: number;
}

export interface GAReportItem {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  direct_score: number | null;
  indirect_score: number | null;
  course_feedback_score?: number | null;
  course_feedback_coverage?: number | null;
  exit_survey_score?: number | null;
  exit_survey_coverage?: number | null;
  ga_attainment: number | null;
  ga_kpi_threshold: number;
  kpi_threshold?: number;
  status: 'ACHIEVED' | 'BELOW_TARGET' | 'NOT_ASSESSED';
  contributing_courses: GAReportContributingCourse[];
  ga_cqi_records: GACQIRecord[];
}

export interface InterimAlertCourse {
  course_code: string;
  semester: number | null;
  ga_score: number;
  status: string;
}

export interface InterimAlert {
  ga_code: string;
  ga_title: string;
  previous_courses: InterimAlertCourse[];
  mapped_clos?: Array<{
    clo_id: string;
    clo_code: string;
    clo_title: string | null;
    bloom_level?: string;
  }>;
  previous_batch?: {
    id: string | null;
    name: string | null;
    custom_id: string | null;
  } | null;
  source_semester?: {
    number: number | null;
    name: string | null;
  } | null;
  issue_statement?: string | null;
  attainment_value?: number | null;
  saved_at?: string | null;
}

export interface CourseInfo {
  id: string;
  course_code: string;
  course_name: string;
  instructor_name: string;
  semester_number?: number | null;
  semester_name?: string | null;
}

export interface ReadinessResponse {
  ready: boolean;
  finalized_courses: number;
  total_courses: number;
  pending_courses: string[];
  finalized_courses_list: CourseInfo[];
  in_process_courses_list: CourseInfo[];
}

export interface BatchGAReportResponse {
  is_program_end_ready: boolean;
  readiness: ReadinessResponse;
  ga_reports: GAReportItem[];
  ongoing_semester?: {
    number: number;
    name?: string | null;
  };
}

export interface SemesterGASummaryResponse {
  semester: {
    id: string;
    number: number;
    name: string;
  } | null;
  readiness?: ReadinessResponse;
  ga_reports: GAReportItem[];
}

export interface TeacherGAContext {
  course_gas: string[];
  interim_alerts: InterimAlert[];
}

export interface GAPEOMapping {
  id: string;
  ga: string;
  peo: string;
  ga_id?: string;
  peo_id?: string;
}

export interface GAPEOMatrix {
  gas: GA[];
  peos: PEO[];
  mappings: GAPEOMapping[];
}

export interface CourseSession {
  id: string;
  course: any;
  batch: any;
  semester: any;
  instructor: any;
  course_name: string;
  course_code: string;
  batch_name: string;
  semester_name: string;
  semester_number?: number;
  instructor_name: string;
  is_active: boolean;
  assessment_status: 'IN_PROGRESS' | 'ASSESSMENT_DONE';
  created_at: string;
}

// --- CLO Report Interfaces ---
export interface AssessmentInfo {
  id: string;
  title: string;
  weightage: number;
}

export interface CLOSummary {
  clo_code: string;
  description: string;
  target_kpi: number;
  overall_attainment: number | null;
  status: 'ACHIEVED' | 'BELOW_TARGET' | 'NOT_ASSESSED';
  mapped_assessments: AssessmentInfo[];
  unmapped_assessments: AssessmentInfo[];
}

export interface AssessmentEffectiveness {
  assessment: AssessmentInfo;
  mapped_clos: string[];
  avg_attainment: number | null;
  effectiveness: 'EFFECTIVE' | 'INEFFECTIVE';
}

export interface CLOCQIListItem {
  clo_code: string;
  clo_description: string;
  course_code: string;
  reason: string;
  action_plan: string;
  instructor: string;
  approved_by: string;
  status: string;
}

export interface CLOReportResponse {
  course: {
    code: string;
    title: string;
    semester: number | null;
    batch: string | null;
    session: string;
  };
  clo_summary: CLOSummary[];
  assessment_effectiveness: AssessmentEffectiveness[];
  cqi_list: CLOCQIListItem[];
}

export interface AlumniDashboardResponse {
  name: string;
  roll_no: string;
  batch_id?: string | null;
  batch: string;
  program_id?: string | null;
  program: string;
  graduation_year: string;
  cgpa: number;
  completed_courses: number;
  current_employer: string;
  designation: string;
  transcripts: Array<{
    semester: string;
    courses: Array<{
      semester: string;
      course_code: string;
      course_name: string;
      credits: number;
      percentage: number;
      gpa: number;
    }>;
    courses_count: number;
  }>;
}

// --- Exit Survey Interfaces ---
export interface ExitSurveyQuestion {
  id: string;
  ga: string | GA;
  ga_id?: string;
  ga_title: string;
  ga_description: string;
  ga_order_number?: number;
  ga_code?: string;
  question_text: string;
  is_locked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExitSurveyResponseSubmission {
  responses: Array<{
    question_id: string;
    rating_value: number;
  }>;
}

export interface StudentPortalStatus {
  locked: boolean;
  reason?: string;
}

export interface BatchPendingExitSurvey {
  pending_count: number;
  students: Array<{
    id: string;
    name: string;
    registration_number: string;
    status: string;
  }>;
}

// --- Batch Interfaces ---
export interface Batch {
  id: string;
  name: string;
  custom_id: string;
  program: any;
  current_semester: number;
  exit_survey_enabled: boolean;
  exit_survey_enabled_at: string | null;
  graduated_at?: string | null;
  alumni_feedback_enabled: boolean;
  alumni_feedback_enabled_at: string | null;
  is_graduating_eligible: boolean;
  is_alumni_feedback_eligible: boolean;
  pending_exit_survey_count: number;
  graduation_status: 'not_graduating' | 'in_progress' | 'graduated_partial' | 'graduated_complete';
  status: 'active' | 'graduated'; // Added status field
  alumni_feedback_cycle_status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | null;
  alumni_feedback_due_at?: string | null;
  alumni_feedback_response_rate?: number;
  alumni_feedback_response_count?: number;
  alumni_feedback_total_alumni?: number;
}

// --- CLO Master Compilation Interfaces ---
export interface CLOMasterCompilationCourseCLO {
  clo_id: string;
  clo_code: string;
  clo_title: string;
  kpi_target: number;
  cohort_achieved_count: number;
  cohort_percentage: number;
  cqi: {
    reason: string;
    action_plan: string;
    coordinator_comment: string;
  } | null;
}

export interface CLOMasterCompilationCourse {
  course_id: string;
  course_code: string;
  course_name: string;
  clos: CLOMasterCompilationCourseCLO[];
}

export interface CLOMasterCompilationStudentCourseCLO {
  score: number;
  achieved: boolean;
}

export interface CLOMasterCompilationStudent {
  sr_no: number;
  reg_no: string;
  name: string;
  courses: Record<string, Record<string, CLOMasterCompilationStudentCourseCLO | null>>;
}

export interface CLOMasterCompilationPendingCourse {
  course_id: string;
  course_code: string;
  course_name: string;
  instructor_name: string;
  status: string;
}

export interface CLOMasterCompilationResponse {
  program: { id: string; name: string; code: string };
  semester: { id: string; name: string; number: number };
  batch?: { id: string; name: string } | null;
  status: {
    finalized_count: number;
    total_count: number;
    is_fully_compiled: boolean;
  };
  finalized_courses: CLOMasterCompilationCourse[];
  students: CLOMasterCompilationStudent[];
  pending_courses: CLOMasterCompilationPendingCourse[];
  summary: {
    total_students: number;
    kpi_breakdown: Record<string, number>;
  };
}

class OBEService {
  // --- New GA Module Methods ---
  
  // Get all GAs
  async getAllGAs(): Promise<GA[]> {
    const response = await api.get('/obe/ga/');
    return response.data;
  }

  // Create CLO-GA mapping
  async createCLOGAMapping(gaId: string, data: Partial<CLOGAMapping>): Promise<CLOGAMapping> {
    const response = await api.post(`/obe/ga/${gaId}/clo-mapping/`, data);
    return response.data;
  }

  // Get CLO-GA matrix for a course
  async getCourseCLOGAMatrix(courseId: string): Promise<MappingMatrix> {
    const response = await api.get(`/obe/courses/${courseId}/clo-ga-matrix/`);
    return response.data;
  }

  // Final submit course assessment
  async finalSubmitCourse(sessionId: string): Promise<CourseSession> {
    const response = await api.post(`/obe/courses/${sessionId}/final-submit/`);
    return response.data;
  }

  // Get Course GA scores
  async getCourseGAScores(sessionId: string): Promise<CourseGAScore[]> {
    const response = await api.get(`/obe/courses/${sessionId}/ga-scores/`);
    return response.data;
  }

  // Get Semester GA Summary
  async getSemesterGASummary(batchId: string, semesterId?: string): Promise<any> {
    const params = semesterId ? { semester_id: semesterId } : {};
    const response = await api.get(`/obe/batches/${batchId}/semester-ga-summary/`, { params });
    return response.data;
  }

  // Get Program GA Summary
  async getProgramGASummary(batchId: string): Promise<any[]> {
    const response = await api.get(`/obe/batches/${batchId}/program-ga-summary/`);
    return response.data;
  }

  // Create GA CQI
  async createGACQI(data: Partial<GACQIRecord>): Promise<GACQIRecord> {
    const response = await api.post('/obe/ga-cqi/', data);
    return response.data;
  }

  // Get GA CQI record
  async getGACQIRecord(cqiId: string): Promise<GACQIRecord> {
    const response = await api.get(`/obe/ga-cqi/${cqiId}/`);
    return response.data;
  }

  // Update GA CQI record
  async updateGACQIRecord(cqiId: string, data: Partial<GACQIRecord>): Promise<GACQIRecord> {
    const response = await api.patch(`/obe/ga-cqi/${cqiId}/`, data);
    return response.data;
  }

  // Approve GA CQI
  async approveGACQI(cqiId: string): Promise<GACQIRecord> {
    const response = await api.patch(`/obe/ga-cqi/${cqiId}/approve/`);
    return response.data;
  }

  // Reject GA CQI
  async rejectGACQI(cqiId: string, hodComment: string): Promise<GACQIRecord> {
    const response = await api.patch(`/obe/ga-cqi/${cqiId}/reject/`, { hod_comment: hodComment });
    return response.data;
  }

  // Get GA CQI History
  async getGACQIHistory(cqiId: string): Promise<GACQIResubmissionHistory[]> {
    const response = await api.get(`/obe/ga-cqi/${cqiId}/history/`);
    return response.data;
  }

  // Unlock Course Assessment
  async unlockCourse(sessionId: string): Promise<CourseSession> {
    const response = await api.post(`/obe/courses/${sessionId}/unlock/`);
    return response.data;
  }

  // Get Batch GA Report
  async getBatchGAReport(batchId: string, params?: {
    mode?: 'semester' | 'cumulative';
    semester?: number;
    scope?: 'cohort' | 'student' | 'all_students' | 'course_wise';
    student_id?: string;
  }): Promise<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | any> {
    const response = await api.get(`/obe/ga-reports/${batchId}/`, { params });
    return response.data;
  }

  // Get Teacher GA Context
  async getTeacherGAContext(courseId: string, batchId?: string): Promise<TeacherGAContext> {
    const response = await api.get(`/obe/teacher/ga-context/${courseId}/`, {
      params: batchId ? { batch_id: batchId } : undefined
    });
    return response.data;
  }

  // Get All Batches
  async getAllBatches(params?: { alumni_feedback?: boolean | 'all'; program?: string }): Promise<Batch[]> {
    const response = await api.get('/batches/all/', { params });
    return response.data;
  }

  async getAlumniFeedbackBatches(programId?: string): Promise<Batch[]> {
    const params = { alumni_feedback: 'all' as const, ...(programId ? { program: programId } : {}) };
    const response = await api.get('/batches/all/', { params });
    return response.data;
  }

  // Get Students for a Batch
  async getBatchStudents(batchId: string): Promise<Array<{id: string, student_id: string, name: string, roll_number: string, is_active: boolean}>> {
    const response = await api.get(`/obe/ga-reports/${batchId}/students/`);
    return response.data;
  }

  // Get Course CLO Report
  async getCourseCLOReport(sessionId: string): Promise<CLOReportResponse> {
    const response = await api.get(`/obe/courses/${sessionId}/clo-report/`);
    return response.data;
  }

  // Get Alumni Dashboard
  async getAlumniDashboard(): Promise<AlumniDashboardResponse> {
    const response = await api.get('/obe/alumni/dashboard/');
    return response.data;
  }

  async getProgramPEOs(programId: string): Promise<PEO[]> {
    const response = await api.get(`/obe/programs/${programId}/peos/`);
    return response.data;
  }

  // --- Exit Survey Methods ---
  async getExitSurveyQuestions(gaId?: string): Promise<ExitSurveyQuestion[]> {
    const params = gaId ? { ga_id: gaId } : {};
    const response = await api.get('/obe/exit-survey/questions/', { params });
    return response.data;
  }

  async generateExitSurveyQuestions(): Promise<{ success: boolean }> {
    const response = await api.post('/obe/exit-survey/questions/generate/');
    return response.data;
  }

  async toggleExitSurveyForBatch(batchId: string): Promise<{
    exit_survey_enabled: boolean;
    exit_survey_enabled_at: string | null;
    graduation_status: string;
  }> {
    const response = await api.patch(`/obe/batches/${batchId}/toggle-exit-survey/`);
    return response.data;
  }

  async toggleAlumniFeedbackForBatch(batchId: string, data?: {
    due_at?: string;
    duration_days?: number;
  }): Promise<{
    alumni_feedback_enabled: boolean;
    alumni_feedback_enabled_at: string | null;
    cycle?: any;
  }> {
    const response = await api.patch(`/obe/batches/${batchId}/toggle-alumni-feedback/`, data || {});
    return response.data;
  }

  async getAlumniSurveyCycles(batchId: string): Promise<any[]> {
    const response = await api.get(`/obe/batches/${batchId}/alumni-survey-cycles/`);
    return response.data;
  }

  async getAlumniSurveyQuestions(cycleId: string): Promise<AlumniSurveyQuestion[]> {
    const response = await api.get(`/obe/alumni-survey/${cycleId}/`);
    return response.data;
  }

  async getPEOAlumniSurveyQuestions(peoId: string): Promise<AlumniSurveyQuestion[]> {
    const response = await api.get(`/obe/peo/${peoId}/alumni-survey-questions/`);
    return response.data;
  }

  async submitAlumniSurvey(
    cycleId: string,
    studentId: string,
    data: {
      employment_status?: string;
      organization_name?: string;
      current_designation?: string;
      responses: Array<{ question: string; score: number }>;
    }
  ): Promise<{ success: boolean }> {
    const response = await api.post(`/obe/alumni-survey/${cycleId}/student/${studentId}/`, data);
    return response.data;
  }

  async initiateGraduationForBatch(batchId: string): Promise<{
    graduation_initiated: boolean;
    graduation_initiated_at: string;
  }> {
    const response = await api.post(`/obe/batches/${batchId}/initiate-graduation/`);
    return response.data;
  }

  async getPendingExitSurveyForBatch(batchId: string): Promise<BatchPendingExitSurvey> {
    const response = await api.get(`/obe/batches/${batchId}/pending-exit-survey/`);
    return response.data;
  }

  async getMyExitSurveyQuestions(): Promise<ExitSurveyQuestion[]> {
    const response = await api.get('/obe/exit-survey/my-questions/');
    return response.data;
  }

  async submitExitSurvey(data: ExitSurveyResponseSubmission): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/obe/exit-survey/submit/', data);
    return response.data;
  }

  async getStudentPortalStatus(): Promise<StudentPortalStatus> {
    const response = await api.get('/obe/student/portal-status/');
    return response.data;
  }

  async getAlumniEmploymentStats(batchId: string): Promise<{
    employment_distribution: Record<string, number>;
    top_employers: Array<{ name: string; count: number }>;
  }> {
    const response = await api.get(`/obe/batches/${batchId}/alumni-employment-stats/`);
    return response.data;
  }

  // --- New GA CQI Cohort Methods ---
  async getGAStatusRow(programId: string, batchId: string): Promise<Array<{
    ga_id: string;
    ga_code: string;
    ga_title: string;
    cohort_score: number | null;
    kpi_threshold: number;
    status: 'ACHIEVED' | 'BELOW_TARGET' | 'NOT_ASSESSED';
    cqi_record_id: string | null;
    cqi_status: string | null;
  }>> {
    const response = await api.get(`/ga-report/${programId}/${batchId}/status-row/`);
    return response.data;
  }

  async saveGACQI(recordId: string, data: {
    hod_action_plan: string;
    issue_statement?: string;
  }): Promise<GACQIRecord> {
    const response = await api.patch(`/ga-cqi/${recordId}/save/`, data);
    return response.data;
  }

  async getGACQIAdvisoryExport(programId: string, batchId: string): Promise<GACQIRecord[]> {
    const response = await api.get(`/ga-cqi/advisory-export/${programId}/${batchId}/`);
    return response.data;
  }

  async downloadGACQIAdvisoryExportPDF(programId: string, batchId: string): Promise<Blob> {
    const response = await api.get(`/ga-cqi/advisory-export/${programId}/${batchId}/pdf/`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // --- CLO Master Compilation Methods ---
  async getCLOMasterCompilation(
    programId: string,
    semesterId: string,
    batchId?: string,
    format?: 'json'
  ): Promise<CLOMasterCompilationResponse>;
  async getCLOMasterCompilation(
    programId: string,
    semesterId: string,
    batchId?: string,
    format?: 'xlsx'
  ): Promise<Blob>;
  async getCLOMasterCompilation(
    programId: string,
    semesterId: string,
    batchId?: string,
    format?: 'json' | 'xlsx'
  ): Promise<CLOMasterCompilationResponse | Blob> {
    const params: Record<string, any> = {};
    if (batchId) params['batch_id'] = batchId;
    if (format === 'xlsx') {
      params['format'] = 'xlsx';
      const response = await api.get(`clo-master/report/${programId}/${semesterId}/`, {
        params,
        responseType: 'blob'
      });
      return response.data;
    }
    const response = await api.get(`clo-master/report/${programId}/${semesterId}/`, { params });
    return response.data;
  }

  // --- Existing Methods ---

  // --- GA-CLO Mapping Matrix ---
  async getMappingMatrix(courseId: string | number | undefined, secondId: string | number | undefined): Promise<any> {
    if (typeof courseId === 'string' && typeof secondId === 'number') {
      // New version-based call
      const response = await api.get(`/obe/courses/${courseId}/versions/${secondId}/clo-ga-matrix/`);
      return response.data;
    } else if (typeof courseId === 'string' && typeof secondId === 'string') {
      // Batch-based call
      const response = await api.get(`/obe/courses/${courseId}/batches/${secondId}/clo-ga-matrix/`);
      return response.data;
    } else {
      // Legacy or department-based
      const params = courseId ? { course_id: courseId } : { department_id: secondId };
      const response = await api.get('/obe/clo-ga-mappings/mapping_matrix/', { params });
      return response.data;
    }
  }

  async bulkUpdateMappings(mappings: any[]): Promise<any> {
    const response = await api.post('/obe/clo-ga-mappings/bulk_update/', { mappings });
    return response.data;
  }

  async saveCLOGAMappings(courseId: string, versionId: number, mappings: any[]): Promise<any> {
    const response = await api.post(`/obe/courses/${courseId}/versions/${versionId}/clo-ga-matrix/`, { mappings });
    return response.data;
  }

  async bulkCreateCLOGAMappings(data: { mappings: Array<{ clo: number; ga: number; weightage: number }> }) {
    const response = await api.post('/obe/clo-ga-mappings/bulk_create/', { mappings: data.mappings });
    return response.data;
  }

  async getCLOGAMappings(courseId: string) {
    const response = await api.get(`/obe/clo-ga-mappings/?course=${courseId}`);
    return response.data;
  }

  // --- CLO Management ---
  async getCLOs(courseId: string, id: string | number): Promise<any[]> {
    if (typeof id === 'number') {
      // versionId
      const response = await api.get(`/obe/courses/${courseId}/versions/${id}/clos/`);
      return response.data;
    } else {
      // batchId
      const response = await api.get(`/obe/courses/${courseId}/batches/${id}/clos/`);
      return response.data;
    }
  }

  async createCLO(courseId: string, id: string | number, data: any): Promise<any>;
  async createCLO(data: any): Promise<any>;
  async createCLO(courseIdOrData: any, maybeId?: any, maybeData?: any): Promise<any> {
    if (typeof courseIdOrData === 'string' && maybeId) {
      if (typeof maybeId === 'number') {
        // versionId
        const response = await api.post(`/obe/courses/${courseIdOrData}/versions/${maybeId}/clos/`, maybeData);
        return response.data;
      } else {
        // batchId
        const response = await api.post(`/obe/courses/${courseIdOrData}/batches/${maybeId}/clos/`, maybeData);
        return response.data;
      }
    } else {
      // Legacy call: (data)
      const response = await api.post('/obe/clos/', courseIdOrData);
      return response.data;
    }
  }

  async updateCLO(id: any, data: any): Promise<any> {
    const response = await api.patch(`/obe/clos/${id}/`, data);
    return response.data;
  }

  async deleteCLO(id: any): Promise<any> {
    const response = await api.delete(`/obe/clos/${id}/`);
    return response.data;
  }

  async copyCLOs(courseId: string, versionId: number, sourceVersionId: number) {
    const response = await api.post(`/obe/courses/${courseId}/versions/${versionId}/clos/copy/`, {
      source_version_id: sourceVersionId
    });
    return response.data;
  }

  // --- PEO Methods ---
  async getPEOs(programId: string): Promise<PEO[]> {
    const response = await api.get(`/obe/programs/${programId}/peos/`);
    return response.data;
  }

  async createPEO(programId: string, data: Partial<PEO>): Promise<PEO> {
    const response = await api.post(`/obe/programs/${programId}/peos/`, data);
    return response.data;
  }

  async updatePEO(id: string, data: Partial<PEO>): Promise<PEO> {
    const response = await api.patch(`/obe/peos/${id}/`, data);
    return response.data;
  }

  async deletePEO(id: string): Promise<any> {
    const response = await api.delete(`/obe/peos/${id}/`);
    return response.data;
  }

  // --- GA Methods ---
  async getGAs(programId: string): Promise<GA[]> {
    const response = await api.get(`/obe/programs/${programId}/gas/`);
    return response.data;
  }

  async getGraduateAttributes(departmentId?: number) {
    const params = departmentId ? `?department=${departmentId}` : '';
    const response = await api.get(`/obe/graduate-attributes/${params}`);
    return response.data;
  }

  async createGA(programId: string, data: Partial<GA>): Promise<any>;
  async createGA(data: any): Promise<any>;
  async createGA(programIdOrData: any, maybeData?: any): Promise<any> {
    if (typeof programIdOrData === 'string' && maybeData) {
      // New UUID-based call: (programId, data)
      const response = await api.post(`/obe/programs/${programIdOrData}/gas/`, maybeData);
      return response.data;
    } else {
      // Legacy call: (data)
      const response = await api.post('/obe/graduate-attributes/', programIdOrData);
      return response.data;
    }
  }

  async updateGA(id: string, data: Partial<GA>): Promise<GA> {
    const response = await api.patch(`/obe/gas/${id}/`, data);
    return response.data;
  }

  async deleteGA(id: string): Promise<any> {
    const response = await api.delete(`/obe/gas/${id}/`);
    return response.data;
  }

  // --- GA-PEO Matrix Methods ---
  async getGAPEOMatrix(programId: string): Promise<GAPEOMatrix> {
    const response = await api.get(`/obe/programs/${programId}/ga-peo-matrix/`);
    return response.data;
  }

  async saveGAPEOMappings(programId: string, mappings: Array<{ga_id: string, peo_id: string}>): Promise<any> {
    const response = await api.post(`/obe/programs/${programId}/ga-peo-matrix/`, { mappings });
    return response.data;
  }

  // --- Course Session Views ---
  async getCourseSessions(batchId: string): Promise<{ sessions: CourseSession[] }> {
    const response = await api.get(`/obe/batches/${batchId}/sessions/`);
    return response.data;
  }

  async createCourseSession(data: any) {
    const response = await api.post('/obe/sessions/', data);
    return response.data;
  }

  async updateCourseSession(id: string, data: any) {
    const response = await api.patch(`/obe/sessions/${id}/`, data);
    return response.data;
  }

  // Program Vision
  async updateProgramVision(programId: string, vision: string): Promise<any> {
    const response = await api.patch(`/programs/${programId}/`, { description: vision });
    return response.data;
  }

  // --- Legacy PI functions (stubs) ---
  async getCLOPIMappingMatrix(courseId: string, versionId: number): Promise<any> {
    return { clos: [], gas: [], mappings: [] };
  }

  async updateCLOPIMappings(courseId: string, versionId: number, mappings: any[]): Promise<any> {
    return;
  }

  async getPIMappingMatrix(courseId: string, versionId: number): Promise<any> {
    return { clos: [], gas: [], mappings: [] };
  }

  async saveCLOPIMappings(courseId: string, versionId: number, mappings: any[]): Promise<any> {
    return;
  }
}

export default new OBEService();
