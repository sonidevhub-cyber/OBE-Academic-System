import { api } from './api';

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
  teacher_id: number;
  allocated_by_name: string;
  allocated_at: string;
  status: 'active' | 'changed' | 'cancelled';
  change_reason: string;
  cloned_from_id: number | null;
  version_no: string;
}

export const teacherAllocationService = {
  getAllocations: (params?: any) => 
    api.get('coordinators/', { params }),
  
  createAllocation: (data: any) => 
    api.post('coordinators/', data),
  
  bulkAllocate: (data: { curriculum_version: number; allocations: { course: string; teacher: number }[] }) => 
    api.post('coordinators/bulk/', data),
  
  cancelAllocation: (id: number, reason: string) => 
    api.post(`coordinators/${id}/cancel/`, { reason }),
  
  getHistory: (id: number) => 
    api.get(`coordinators/${id}/history/`),
    
  getVersionAllocations: (versionId: number) => 
    api.get(`coordinators/`, { params: { version: versionId } }),
};
