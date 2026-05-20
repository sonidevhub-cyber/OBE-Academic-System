import { api } from './api';

export interface CurriculumVersion {
  id: number;
  program: number;
  program_name: string;
  batch: string;
  batch_name: string;
  version_no: string;
  status: 'draft' | 'active' | 'archived';
  cloned_from: number | null;
  cloned_from_version_no: string | null;
  created_by: number;
  created_by_name: string;
  activated_by: number | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  total_courses: number;
  is_editable: boolean;
  courses_by_semester?: Record<string, CurriculumCourse[]>;
}

export interface CurriculumCourse {
  id: number;
  course: string;
  course_code: string;
  course_name: string;
  course_type: string;
  credit_hours: number;
  semester_no: number;
  is_active: boolean;
  allocation?: any; // Module 2 data
}

export const curriculumService = {
  getVersions: (params?: any) => 
    api.get('curriculum-versions/curriculum-versions/', { params }),
  
  getVersion: (id: number) => {
    if (isNaN(id)) {
      console.warn('curriculumService.getVersion called with NaN');
      return Promise.reject(new Error('Invalid ID'));
    }
    return api.get(`curriculum-versions/curriculum-versions/${id}/`);
  },
  
  createVersion: (data: any) => 
    api.post('curriculum-versions/curriculum-versions/', data),
  
  updateVersion: (id: number, data: any) => 
    api.patch(`curriculum-versions/curriculum-versions/${id}/`, data),
  
  activateVersion: (id: number) => 
    api.post(`curriculum-versions/curriculum-versions/${id}/activate/`),
  syncVersionCourses: (id: number) =>
    api.post(`curriculum-versions/curriculum-versions/${id}/sync_courses/`),
  cloneVersion: (id: number, targetBatchId: string) =>
    api.post(`curriculum-versions/curriculum-versions/${id}/clone/`, { target_batch_id: targetBatchId }),

  // Nested Courses
  getCourses: (versionId: number) => 
    api.get(`curriculum-versions/curriculum-versions/${versionId}/courses/`),
  
  addCourse: (versionId: number, data: any) => 
    api.post(`curriculum-versions/curriculum-versions/${versionId}/courses/`, data),
  
  updateCourse: (versionId: number, courseId: number, data: any) => 
    api.patch(`curriculum-versions/curriculum-versions/${versionId}/courses/${courseId}/`, data),
  
  removeCourse: (versionId: number, courseId: number) => 
    api.delete(`curriculum-versions/curriculum-versions/${versionId}/courses/${courseId}/`),
};
