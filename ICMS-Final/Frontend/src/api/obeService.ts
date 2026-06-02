import { api } from './api';

export interface CLOGAMapping {
  clo_id: number;
  ga_id: number;
  mapping_strength: 'high' | 'medium' | 'low';
  strength_value: number;
}

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

export interface PerformanceIndicator {
  id: string;
  ga: string;
  code: string;
  description: string;
  kpi: number;
  created_at: string;
}

export interface GA {
  id: string;
  program: string;
  title: string;
  description: string;
  order_number: number;
  kpi_target: number;
  performance_indicators: PerformanceIndicator[];
  is_active: boolean;
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

class OBEService {
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

  // --- PI Mapping Matrix ---
  async getPIMappingMatrix(courseId: string, versionId: number): Promise<any> {
    const response = await api.get(`/obe/courses/${courseId}/versions/${versionId}/clo-pi-matrix/`);
    return response.data;
  }

  async saveCLOPIMappings(courseId: string, versionId: number, mappings: any[]): Promise<any> {
    const response = await api.post(`/obe/courses/${courseId}/versions/${versionId}/clo-pi-matrix/`, { mappings });
    return response.data;
  }

  async getCLOPIMappingMatrix(courseId: string, id: string | number): Promise<any> {
    if (typeof id === 'number') {
      const response = await api.get(`/obe/courses/${courseId}/versions/${id}/clo-pi-matrix/`);
      return response.data;
    } else {
      const response = await api.get(`/obe/courses/${courseId}/batches/${id}/clo-pi-matrix/`);
      return response.data;
    }
  }

  async updateCLOPIMappings(courseId: string, id: string | number, mappings: any[]): Promise<any> {
    if (typeof id === 'number') {
      const response = await api.post(`/obe/courses/${courseId}/versions/${id}/clo-pi-matrix/`, { mappings });
      return response.data;
    } else {
      const response = await api.post(`/obe/courses/${courseId}/batches/${id}/clo-pi-matrix/`, { mappings });
      return response.data;
    }
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
  async getCourseSessions(batchId: string) {
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
}

export default new OBEService();
