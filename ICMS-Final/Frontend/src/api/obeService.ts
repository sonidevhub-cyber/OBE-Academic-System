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
    const response = await api.get(`/obe/course-outcomes/?course=${courseId}`);
    return response.data;
  }

  async getGraduateAttributes(departmentId: number) {
    const response = await api.get(`/obe/graduate-attributes/?department=${departmentId}`);
    return response.data;
  }

  async createCLO(data: any) {
    console.log('Creating CLO with URL: /obe/course-outcomes/');
    const response = await api.post('/obe/course-outcomes/', data);
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

  async bulkCreateStudentAssessments(data: any) {
    const response = await api.post('/obe/student-assessments/bulk_create/', data);
    return response.data;
  }
}

export default new OBEService();