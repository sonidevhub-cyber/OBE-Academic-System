import { api } from './api';

export interface PEO {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  is_active: boolean;
  created_at: string;
}

export interface GA {
  id: string;
  program: string;
  code: string;
  title: string;
  description: string;
  order_number: number;
  is_active: boolean;
  created_at: string;
}


export interface GAPEOMapping {
  id: string;
  ga: string;
  peo: string;
  ga_title: string;
  peo_title: string;
}

export interface CLO {
  id: string;
  course: string;
  batch: string;
  course_name: string;
  batch_name: string;
  title: string;
  description: string;
  order_number: number;
  kpi_target: number;
  is_active: boolean;
  created_at: string;
}

export interface CLOGAMapping {
  id: string;
  clo: string;
  ga: string;
  weight: number;
  clo_title: string;
  ga_title: string;
  weight_display: string;
}

export interface CourseSession {
  id: string;
  course: string;
  batch: string;
  instructor: string;
  course_name: string;
  batch_name: string;
  instructor_name: string;
  academic_year: string;
  semester_number: number;
  status: 'pending' | 'allocated' | 'completed';
}

export interface CurriculumVersion {
  id: string;
  batch: string;
  course: string;
  batch_name: string;
  course_name: string;
  action: 'add' | 'remove';
  semester_number: number;
  note: string;
}

export const obeService = {
  // PEOs
  getPEOs: (programId: string) => 
    api.get<PEO[]>(`obe/programs/${programId}/peos/`),
  createPEO: (programId: string, data: Partial<PEO>) =>
    api.post<PEO>(`obe/programs/${programId}/peos/`, data),
  updatePEO: (id: string, data: Partial<PEO>) =>
    api.patch<PEO>(`obe/peos/${id}/`, data),
  deletePEO: (id: string) =>
    api.delete(`obe/peos/${id}/`),

  // GAs
  getGAs: (programId: string) =>
    api.get<GA[]>(`obe/programs/${programId}/gas/`),
  createGA: (programId: string, data: Partial<GA>) =>
    api.post<GA>(`obe/programs/${programId}/gas/`, data),
  updateGA: (id: string, data: Partial<GA>) =>
    api.patch<GA>(`obe/gas/${id}/`, data),
  deleteGA: (id: string) =>
    api.delete(`obe/gas/${id}/`),

  // GA-PEO Matrix
  getGAPEOMatrix: (programId: string) =>
    api.get<{ gas: GA[], peos: PEO[], mappings: GAPEOMapping[] }>(`obe/programs/${programId}/ga-peo-matrix/`),
  saveGAPEOMatrix: (programId: string, mappings: { ga_id: string, peo_id: string }[]) =>
    api.post(`obe/programs/${programId}/ga-peo-matrix/`, { mappings }),

  // CLOs
  getCLOs: (courseId: string, batchId: string) =>
    api.get<CLO[]>(`obe/courses/${courseId}/batches/${batchId}/clos/`),
  createCLO: (courseId: string, batchId: string, data: Partial<CLO>) =>
    api.post<CLO>(`obe/courses/${courseId}/batches/${batchId}/clos/`, data),
  updateCLO: (id: string, data: Partial<CLO>) =>
    api.patch<CLO>(`obe/clos/${id}/`, data),
  deleteCLO: (id: string) =>
    api.delete(`obe/clos/${id}/`),
  copyCLOs: (courseId: string, batchId: string, sourceBatchId: string) =>
    api.post(`obe/courses/${courseId}/batches/${batchId}/clos/copy/`, { source_batch_id: sourceBatchId }),

  // CLO-GA Matrix
  getCLOGAMatrix: (courseId: string, batchId: string) =>
    api.get<{ clos: CLO[], gas: GA[], mappings: CLOGAMapping[] }>(`obe/courses/${courseId}/batches/${batchId}/clo-ga-matrix/`),
  saveCLOGAMatrix: (courseId: string, batchId: string, mappings: { clo_id: string, ga_id: string, weight: number }[]) =>
    api.post(`obe/courses/${courseId}/batches/${batchId}/clo-ga-matrix/`, { mappings }),

  // Course Sessions
  getCourseSessions: (batchId: string) =>
    api.get<{ sessions: CourseSession[], pending_count: number }>(`obe/batches/${batchId}/sessions/`),
  createCourseSession: (data: Partial<CourseSession>) =>
    api.post<CourseSession>(`obe/sessions/`, data),
  updateCourseSession: (id: string, data: Partial<CourseSession>) =>
    api.patch<CourseSession>(`obe/sessions/${id}/`, data),

  // Curriculum
  getCurriculum: (batchId: string) =>
    api.get<CurriculumVersion[]>(`obe/batches/${batchId}/curriculum/`),
  deleteCurriculumVersion: (id: string) =>
    api.delete(`obe/curriculum/${id}/delete/`),
  getEffectiveCurriculum: (batchId: string) =>
    api.get<{ batch: string, base_courses: any[], extra_courses: any[], total_courses: number }>(`obe/batches/${batchId}/effective-curriculum/`),
};
