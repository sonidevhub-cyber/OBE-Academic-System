import { api } from './api';

export interface CLOGAMapping {
  clo_id: number;
  ga_id: number;
  mapping_strength: 'high' | 'medium' | 'low';
  strength_value: number;
}

export interface MappingMatrix {
  gas: Array<{code: string; title: string}>;
  matrix: Array<{
    clo: string;
    course: string;
    mappings: Record<string, {strength: string | null; value: number}>;
  }>;
}

class OBEService {
  async getMappingMatrix(courseId?: number, departmentId?: number): Promise<MappingMatrix> {
    const params = courseId ? { course_id: courseId } : { department_id: departmentId };
    const response = await api.get('/obe/clo-ga-mappings/mapping_matrix/', { params });
    return response.data;
  }

  async bulkUpdateMappings(mappings: Array<{
    clo_id: number;
    ga_id: number;
    strength: string | null;
  }>): Promise<any> {
    const response = await api.post('/obe/clo-ga-mappings/bulk_update/', { mappings });
    return response.data;
  }

  async getCourseOutcomes(courseId: number) {
    const response = await api.get(`/obe/clos/?course=${courseId}`);
    return response.data;
  }

  async getGraduateAttributes(departmentId?: number) {
    const params = departmentId ? `?department=${departmentId}` : '';
    const response = await api.get(`/obe/graduate-attributes/${params}`);
    return response.data;
  }

  async createCLO(data: any) {
    const response = await api.post('/obe/clos/', data);
    return response.data;
  }

  async updateCLO(id: number, data: any) {
    const response = await api.put(`/obe/clos/${id}/`, data);
    return response.data;
  }

  async deleteCLO(id: number) {
    const response = await api.delete(`/obe/clos/${id}/`);
    return response.data;
  }

  async createGA(data: any) {
    const response = await api.post('/obe/graduate-attributes/', data);
    return response.data;
  }

  async createAssessment(data: any) {
    const response = await api.post('/obe/assessments/', data);
    return response.data;
  }

  async bulkCreateCLOGAMappings(data: { mappings: Array<{ clo: number; ga: number; weightage: number }> }) {
    const response = await api.post('/obe/clo-ga-mappings/bulk_create/', data);
    return response.data;
  }

  async getCLOGAMappings(courseId: number) {
    const response = await api.get(`/obe/clo-ga-mappings/?course=${courseId}`);
    return response.data;
  }

  async deleteCLOGAMapping(id: number) {
    const response = await api.delete(`/obe/clo-ga-mappings/${id}/`);
    return response.data;
  }

  async bulkCreateStudentAssessments(data: any) {
    const response = await api.post('/obe/student-assessments/bulk_create/', data);
    return response.data;
  }
}

export default new OBEService();
