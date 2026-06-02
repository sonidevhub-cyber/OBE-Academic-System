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
  allocation?: any;
}

export interface CourseAllocation {
  allocation_id: number;
  course: string;
  course_name: string;
  course_code: string;
  instructor: number;
  instructor_name: string;
  teacher?: number;
  teacher_name?: string;
  batch: string;
  batch_name: string;
  coordinator: string;
  coordinator_name: string;
  status: 'proposed' | 'approved' | 'rejected' | 'active';
  proposed_at: string;
  approved_at: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  hod_comments: string;
  rejection_reason?: string;
}

export interface TeacherAllocation {
  id: number;
  curriculum_version: number;
  course: string;
  course_name: string;
  course_code: string;
  batch: string;
  batch_name: string;
  semester_no: number;
  teacher: number;
  teacher_name: string;
  allocated_by_name: string;
  allocated_at: string;
  status: 'active' | 'changed' | 'cancelled';
  change_reason: string;
  cloned_from_id: number | null;
  version_no: string;
}

export const coordinatorService = {
  // --- Curriculum Versions ---
  getCurriculumVersions: (params?: any) => 
    api.get('curriculum-versions/curriculum-versions/', { params }),
  
  getVersion: (id: number) => {
    if (isNaN(id)) {
      console.warn('coordinatorService.getVersion called with NaN');
      return Promise.reject(new Error('Invalid ID'));
    }
    return api.get(`curriculum-versions/curriculum-versions/${id}/`);
  },
  
  createVersion: (data: any) => 
    api.post('curriculum-versions/curriculum-versions/', data),
  
  activateVersion: (id: number) => 
    api.post(`curriculum-versions/curriculum-versions/${id}/activate/`),
  
  cloneVersion: (id: number, target_batch_id: string) => 
    api.post(`curriculum-versions/curriculum-versions/${id}/clone/`, { target_batch_id }),

  // --- Teacher Allocations ---
  getCourseAllocations: (params?: any) => 
    api.get('coordinators/', { params }),
  
  bulkAllocate: (data: any) => 
    api.post('coordinators/bulk/', data),

  cancelAllocation: (id: number, reason: string) => 
    api.post(`coordinators/${id}/cancel/`, { reason }),
  
  getHistory: (id: number) => 
    api.get(`coordinators/${id}/history/`),

  // --- Supporting Data ---
  getPrograms: () => api.get('programs/'),
  getInstructors: () => api.get('instructors/profiles/'),
  getBatches: () => api.get('batches/all/'),
  getBatchesByProgram: (programId: string) => api.get(`batches/all/?program=${programId}`),
  getCoursesByProgram: (programId: string) => api.get(`courses/?program_id=${programId}`),
  getCoursesByBatch: (programId: string, semester: number) => 
    api.get(`courses/?program_id=${programId}&semester_num=${semester}`),

  // --- HOD Specific Actions ---
  approveCourseAllocation: (id: number, data: any) => 
    api.post(`coordinators/${id}/approve/`, data),
  
  rejectCourseAllocation: (id: number, data: any) => 
    api.post(`coordinators/${id}/reject/`, data),

  getTimetableProposals: (params?: any) => 
    api.get('timetable/proposals/', { params }),

  getTimetablePublishAudit: (params?: any) => 
    api.get('timetable/publish-audit/', { params }),

  approveTimetableProposal: (id: number, data: any) => 
    api.post(`timetable/proposals/${id}/approve/`, data),

  rejectTimetableProposal: (id: number, data: any) => 
    api.post(`timetable/proposals/${id}/reject/`, data),
};