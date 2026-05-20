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

<<<<<<< HEAD
export interface MappingMatrix {
  gas: Array<{id: string; code: string; title: string}>;
  matrix: Array<{
    clo: string;
    course: string;
    mappings: Record<string, {strength: string | null; value: number}>;
  }>;
}

export interface PEO {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  is_active: boolean;
}

export interface GA {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  is_active: boolean;
}

export interface GAPEOMapping {
  id: string;
  ga: string;
  peo: string;
}

export interface GAPEOMatrix {
  gas: GA[];
  peos: PEO[];
  mappings: GAPEOMapping[];
}

class OBEService {
  // --- Legacy Methods for Backward Compatibility ---
  async getMappingMatrix(courseId?: string, batchId?: string): Promise<any>;
  async getMappingMatrix(courseId?: number, departmentId?: number): Promise<any>;
  async getMappingMatrix(courseId?: any, batchOrDeptId?: any): Promise<any> {
    if (typeof courseId === 'string' && typeof batchOrDeptId === 'string') {
      // New UUID-based call
      const response = await api.get(`/obe/courses/${courseId}/batches/${batchOrDeptId}/clo-ga-matrix/`);
      return response.data;
    } else {
      // Legacy number-based call
      const params = courseId ? { course_id: courseId } : { department_id: batchOrDeptId };
      const response = await api.get('/obe/clo-ga-mappings/mapping_matrix/', { params });
      return response.data;
    }
  }

  async bulkUpdateMappings(mappings: any[]): Promise<any> {
    const response = await api.post('/obe/clo-ga-mappings/bulk_update/', { mappings });
    return response.data;
  }

  async getGraduateAttributes(departmentId?: number) {
    const params = departmentId ? `?department=${departmentId}` : '';
    const response = await api.get(`/obe/graduate-attributes/${params}`);
    return response.data;
  }

  async getCourseOutcomes(courseId: number) {
    const response = await api.get(`/obe/clos/?course=${courseId}`);
    return response.data;
  }

  async bulkCreateCLOGAMappings(data: { mappings: Array<{ clo: number; ga: number; weightage: number }> }) {
    const response = await api.post('/obe/clo-ga-mappings/bulk_create/', { mappings: data.mappings });
    return response.data;
  }

  async getCLOGAMappings(courseId: number) {
    const response = await api.get(`/obe/clo-ga-mappings/?course=${courseId}`);
    return response.data;
  }

  // --- New PEO Methods ---
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

  // --- New GA Methods ---
  async getGAs(programId: string): Promise<GA[]> {
    const response = await api.get(`/obe/programs/${programId}/gas/`);
    return response.data;
  }

  // Supporting both legacy and new createGA
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

  // --- New GA-PEO Matrix Methods ---
  async getGAPEOMatrix(programId: string): Promise<GAPEOMatrix> {
    const response = await api.get(`/obe/programs/${programId}/ga-peo-matrix/`);
    return response.data;
  }

  async updateGAPEOMappings(programId: string, mappings: Array<{ga_id: string, peo_id: string}>): Promise<any> {
    const response = await api.post(`/obe/programs/${programId}/ga-peo-matrix/`, { mappings });
    return response.data;
  }

  // --- New CLO Methods ---
  async getCLOs(courseId: string, batchId: string): Promise<any[]> {
    const response = await api.get(`/obe/courses/${courseId}/batches/${batchId}/clos/`);
    return response.data;
  }

  // Supporting both legacy and new createCLO
  async createCLO(courseId: string, batchId: string, data: any): Promise<any>;
  async createCLO(data: any): Promise<any>;
  async createCLO(courseIdOrData: any, maybeBatchId?: any, maybeData?: any): Promise<any> {
    if (typeof courseIdOrData === 'string' && maybeBatchId && maybeData) {
      // New UUID-based call: (courseId, batchId, data)
      const response = await api.post(`/obe/courses/${courseIdOrData}/batches/${maybeBatchId}/clos/`, maybeData);
      return response.data;
    } else {
      // Legacy call: (data)
      const response = await api.post('/obe/clos/', courseIdOrData);
      return response.data;
    }
  }

  async updateCLO(id: any, data: any): Promise<any> {
    if (typeof id === 'string') {
      const response = await api.patch(`/obe/clos/${id}/`, data);
      return response.data;
    } else {
      const response = await api.put(`/obe/clos/${id}/`, data);
      return response.data;
    }
  }

  async deleteCLO(id: any): Promise<any> {
    const response = await api.delete(`/obe/clos/${id}/`);
    return response.data;
  }

  async updateCLOGAMappings(courseId: string, batchId: string, mappings: any[]): Promise<any> {
    const response = await api.post(`/obe/courses/${courseId}/batches/${batchId}/clo-ga-matrix/`, { mappings });
    return response.data;
  }

  // Program Vision (using Program description for now as requested)
  async updateProgramVision(programId: string, vision: string): Promise<any> {
    const response = await api.patch(`/programs/${programId}/`, { description: vision });
    return response.data;
  }
=======
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
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
