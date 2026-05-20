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
}

export default new OBEService();
