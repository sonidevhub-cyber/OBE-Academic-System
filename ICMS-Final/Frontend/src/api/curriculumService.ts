import { api } from './api';

export interface CurriculumVersion {
  id: number;
  program: number;
  program_name: string;
  program_total_semesters?: number;
  batch: string;
  batch_name: string;
  assigned_batches?: Array<{ id: string; name: string }>;
  version_no: string;
  status: 'draft' | 'finalized' | 'archived';
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
    api.get('curriculum-versions/', { params }),
  
  getVersion: (id: number) => {
    if (isNaN(id)) {
      console.warn('curriculumService.getVersion called with NaN');
      return Promise.reject(new Error('Invalid ID'));
    }
    return api.get(`curriculum-versions/${id}/`);
  },
  
  createCurriculumVersion: (data: any) => 
    api.post('curriculum-versions/', data),
  
  updateVersion: (id: number, data: any) => 
    api.patch(`curriculum-versions/${id}/`, data),
  
  finalizeVersion: (id: number) => 
    api.post(`curriculum-versions/${id}/finalize/`),
  syncVersionCourses: (id: number) =>
    api.post(`curriculum-versions/${id}/sync_courses/`),
  branchVersion: (id: number, batchId: string) =>
    api.post(`curriculum-versions/${id}/branch/`, { batch_id: batchId }),
  cloneVersion: (id: number, targetBatchId: string) =>
    api.post(`curriculum-versions/${id}/clone/`, { target_batch_id: targetBatchId }),
  getMasterCurricula: (programId: string) =>
    api.get(`curriculum-versions/master/`, { params: { program_id: programId } }),
  getAllMasterCurricula: () =>
    api.get(`curriculum-versions/master/`),
  getAllCourses: () =>
    api.get('courses/'),
  addCourseToVersion: (versionId: number, courseId: string | number, semester: number) => {
    // Backend `Course` PK is UUID (string), so DO NOT convert to Number.
    // Only guard against null/undefined-like values.
    const isNullish =
      courseId === null ||
      courseId === undefined ||
      courseId === 'null' ||
      courseId === 'undefined' ||
      courseId === '';

    if (!versionId || isNullish) {
      return Promise.reject(new Error('Invalid course selection'));
    }

    return api.post(`curriculum-versions/${versionId}/courses/`, {
      course: courseId,
      semester_no: semester,
    });
  },



  // Nested Courses
  getCourses: (versionId: number) => 
    api.get(`curriculum-versions/${versionId}/courses/`),
  
  addCourse: (versionId: number, data: any) => 
    api.post(`curriculum-versions/${versionId}/courses/`, data),
  
  updateCourse: (versionId: number, courseId: number, data: any) => 
    api.patch(`curriculum-versions/${versionId}/courses/${courseId}/`, data),
  
  removeCourse: (versionId: number, courseId: number) => 
    api.delete(`curriculum-versions/${versionId}/courses/${courseId}/`),

  createCourse: (data: { 
    name: string; 
    code: string; 
    credit_hours: number; 
    course_type: string;
    program_id: number | string;
    semester_no: number;
    parent_course?: string | number;
  }) =>
    api.post('courses/', data),
};