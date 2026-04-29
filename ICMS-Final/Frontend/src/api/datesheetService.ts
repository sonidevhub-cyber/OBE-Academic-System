import { api } from './api';

export type DateSheetStatusApi = 'draft' | 'pending' | 'approved' | 'rejected';
export type DateSheetExamTypeApi = 'Mid' | 'Final';

export interface DateSheetApiItem {
  id: number;
  course: number;
  course_name: string;
  course_code: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  exam_type: DateSheetExamTypeApi;
}

export interface DateSheetApiRecord {
  id: number;
  department_id: number;
  semester_id: number;
  department: {
    id: number;
    name: string;
    code: string;
  };
  semester: {
    id: number;
    name: string;
    semester_code: string;
  };
  created_by: number | null;
  created_by_name: string | null;
  status: DateSheetStatusApi;
  status_label: string;
  review_comment: string;
  rejection_reason: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
  items: DateSheetApiItem[];
  eligibility_summary: {
    total: number;
    eligible: number;
    not_eligible: number;
    overridden: number;
  };
}

export interface DateSheetDashboardResponse {
  role: string;
  counts: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  recent: DateSheetApiRecord[];
}

export interface DateSheetEligibilityRecord {
  id: number;
  datesheet: number;
  student: string | number;
  student_name: string;
  student_roll_no: string;
  department: string;
  semester: string;
  course: number;
  course_name: string;
  course_code: string;
  attendance_percentage: number;
  is_eligible: boolean;
  overridden_by_hod: boolean;
  eligibility_status?: string;
  hod_reason: string;
  overridden_by: number | null;
  overridden_by_name: string | null;
  updated_at: string;
  created_at: string;
}

export interface DateSheetPayloadItem {
  course: number;
  exam_date: string;
  start_time: string;
  end_time: string;
  exam_type: DateSheetExamTypeApi;
}

export interface DateSheetPayload {
  department_id: number;
  semester_id: number;
  items: DateSheetPayloadItem[];
}

export const datesheetService = {
  getDashboard: () => api.get<DateSheetDashboardResponse>('academics/datesheets/dashboard/'),
  list: (params?: { department?: number; semester?: number; status?: DateSheetStatusApi }) =>
    api.get<DateSheetApiRecord[]>('academics/datesheets/', { params }),
  create: (payload: DateSheetPayload) =>
    api.post<DateSheetApiRecord>('academics/datesheets/', {
      department_id: payload.department_id,
      semester_id: payload.semester_id,
      items: payload.items,
    }),
  update: (id: number, payload: DateSheetPayload) =>
    api.put<DateSheetApiRecord>(`academics/datesheets/${id}/`, {
      department_id: payload.department_id,
      semester_id: payload.semester_id,
      items: payload.items,
    }),
  submit: (id: number) => api.post(`academics/datesheets/${id}/submit/`),
  approve: (id: number, review_comment = '') => api.post(`academics/datesheets/${id}/approve/`, { review_comment }),
  reject: (id: number, reason: string) => api.post(`academics/datesheets/${id}/reject/`, { reason }),
  listEligibility: (params?: { department?: number; semester?: number; course?: number; datesheet?: number; low_attendance?: boolean }) =>
    api.get<DateSheetEligibilityRecord[]>('academics/datesheet-eligibility/', { params }),
  overrideEligibility: (id: number, reason: string) =>
    api.post(`academics/datesheet-eligibility/${id}/override/`, { hod_reason: reason }),
  listDepartments: () => api.get<any[]>('academics/departments/'),
  listSemesters: (departmentId?: number) =>
    api.get<any[]>('academics/semesters/', {
      params: departmentId ? { department: departmentId } : {},
    }),
  listCourses: (semesterId?: number) =>
    api.get<any[]>('academics/courses/', {
      params: semesterId ? { semester: semesterId } : {},
    }),
};
