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
  status: 'PENDING' | 'SENT_BACK' | 'FULLY_APPROVED';
  submitted_by: any | null;
  approved_by: any | null;
  is_audit_visible: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  history?: GACQIResubmissionHistory[];
  contributing_courses?: GAReportContributingCourse[];
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
  course_ga_score: number;
  enrolled_students?: number;
  semester?: number | null;
  credits?: number;
}

export interface GAReportItem {
  ga_id: string;
  ga_code: string;
  ga_title: string;
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
}

export interface ReadinessResponse {
  ready: boolean;
  finalized_courses: number;
  total_courses: number;
  missing_courses: string[];
}

export interface BatchGAReportResponse {
  is_program_end_ready: boolean;
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
  batch: string;
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

// --- Batch Interfaces ---
export interface Batch {
  id: string;
  name: string;
  program: any;
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
  async getSemesterGASummary(batchId: string, semesterId?: string): Promise<any[]> {
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
    scope?: 'cohort' | 'student';
    student_id?: string;
  }): Promise<GAReportItem[] | ReadinessResponse | BatchGAReportResponse> {
    const response = await api.get(`/obe/ga-reports/${batchId}/`, { params });
    return response.data;
  }

  // Get Teacher GA Context
  async getTeacherGAContext(courseId: string): Promise<TeacherGAContext> {
    const response = await api.get(`/obe/teacher/ga-context/${courseId}/`);
    return response.data;
  }

  // Get All Batches
  async getAllBatches(): Promise<Batch[]> {
    const response = await api.get('/batches/all/');
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
