import { api } from './api';

export type CourseOfferingType = 'COMPULSORY' | 'ELECTIVE' | 'SELECTIVE';

export interface ElectiveGroup {
  id: string;
  group_name: string;
  batch_id?: string;
  batch_name?: string;
  batch_custom_id?: string;
  semester_id?: string;
  semester_number?: number;
  is_active: boolean;
  created_at?: string;
  course_count?: number;
}

export interface SelectiveGroup {
  id: string;
  group_name: string;
  curriculum_version_id?: string;
  curriculum_version_version_no?: string;
  semester_id?: string;
  semester_number?: number;
  is_active: boolean;
  created_at?: string;
  course_count?: number;
  has_eligibility_rules?: boolean;
  eligibility_rules?: EligibilityRule[];
}

export interface EligibilityRule {
  id: string;
  selective_group_id: string;
  course_id?: string;
  course_code?: string;
  course_name?: string;
  student_attribute_field: string;
  student_attribute_value: string;
  is_active: boolean;
  created_at?: string;
}

export interface ElectiveSelectionWindow {
  id: string;
  batch_id: string;
  batch_name: string;
  batch_custom_id: string;
  semester_id: string;
  semester_number: number;
  is_open: boolean;
  status: 'NOT_OPENED' | 'OPEN' | 'LOCKED';
  opened_by?: string | null;
  opened_by_name?: string | null;
  opened_at?: string | null;
  closed_by?: string | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  max_electives_allowed: number;
  is_active: boolean;
  created_at: string;
}

export interface ElectiveCourseOption {
  id: string;
  name: string;
  code: string;
  course_type: 'LECTURE' | 'LAB';
  offering_type: CourseOfferingType;
  elective_group_id?: string | null;
  elective_group_name?: string | null;
  selective_group_id?: string | null;
  selective_group_name?: string | null;
  credit_hours: number;
  program_id?: string;
  semester_id?: string;
  semester_number?: number;
}

export interface GroupedElectiveCoursesResponse {
  batch_id: string;
  batch_name: string;
  batch_custom_id: string;
  semester_id: string;
  semester_number: number;
  window: ElectiveSelectionWindow | null;
  elective_groups: Array<{
    elective_group_id: string;
    group_name: string;
    courses: ElectiveCourseOption[];
  }>;
  selective_groups: Array<{
    selective_group_id: string;
    group_name: string;
    required: boolean;
    courses: ElectiveCourseOption[];
  }>;
  open_electives: ElectiveCourseOption[];
  current_student_selections: string[];
}

export interface StudentElectiveEnrollment {
  id: string;
  student_id: string;
  student_custom_id: string;
  student_name: string;
  student_registration_number: string;
  course_id: string;
  course_name: string;
  course_code: string;
  semester_id: string;
  semester_number: number;
  batch_id: string;
  batch_custom_id: string;
  elective_group_id?: string | null;
  elective_group_name?: string | null;
  enrolled_by_id?: string | null;
  enrolled_by_name?: string | null;
  course_offering_type?: CourseOfferingType;
  selective_group_id?: string | null;
  selective_group_name?: string | null;
  enrolled_at: string;
  is_locked: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SACElectiveEnrollmentsResponse {
  batch_id: string;
  batch_custom_id: string;
  semester_id: string | null;
  semester_number: number | null;
  window: ElectiveSelectionWindow | null;
  selective_group_enrollments: Array<{
    selective_group_id: string;
    group_name: string;
    enrollments: StudentElectiveEnrollment[];
    incomplete_students: Array<{
      student_id: string;
      custom_id: string;
      name: string;
      registration_number: string;
    }>;
  }>;
  elective_group_enrollments: Array<{
    elective_group_id: string;
    group_name: string;
    enrollments: StudentElectiveEnrollment[];
  }>;
  open_elective_enrollments: StudentElectiveEnrollment[];
  all_enrollments: StudentElectiveEnrollment[];
  incomplete_summary: {
    total_students_in_batch: number;
    students_missing_selective_picks: Array<{
      student_id: string;
      custom_id: string;
      name: string;
      registration_number: string;
      missing_groups: Array<{
        selective_group_id: string;
        group_name: string;
      }>;
    }>;
  };
}

export interface EnrollRequest {
  course_ids: string[];
  batch_id: string;
  semester_id?: string;
  semester_no?: number;
}

export interface EnrollResponse {
  created_count: number;
  enrollments: StudentElectiveEnrollment[];
  errors?: string[];
}

export interface WindowOpenRequest {
  batch_id: string;
  semester_id?: string;
  semester_no?: number;
  max_electives_allowed?: number;
}

export interface WindowLockRequest {
  batch_id: string;
  semester_id?: string;
  semester_no?: number;
}

export interface SACAssignRequest {
  student_id: string;
  course_id: string;
  batch_id: string;
  semester_id?: string;
  semester_no?: number;
  action?: 'add' | 'remove';
}

export interface WindowLockError {
  error: string;
  incomplete_picks?: Array<{
    student_id: string;
    custom_id: string;
    name: string;
    registration_number: string;
    missing_groups: Array<{
      selective_group_id: string;
      group_name: string;
    }>;
  }>;
}

export type LockWithIncompleteResponse =
  | { window: ElectiveSelectionWindow; locked_enrollments_count: number }
  | WindowLockError;

export interface IncompleteLockCheckPayload {
  batch_id: string;
  semester_id?: string;
  semester_no?: number;
}

export const electivesApi = {
  getElectiveGroups: (params?: { batch_id?: string; semester_id?: string; semester_no?: string }) =>
    api.get<ElectiveGroup[]>('/electives/groups/', { params }),

  createElectiveGroup: (data: { group_name: string; batch_id: string; semester_id?: string; semester_no?: number }) =>
    api.post<ElectiveGroup>('/electives/groups/', data),

  deleteElectiveGroup: (id: string) =>
    api.delete(`/electives/groups/${id}/`),

  getSelectiveGroups: (params?: { curriculum_version_id?: string; semester_id?: string; semester_no?: string }) =>
    api.get<SelectiveGroup[]>('/electives/selective-groups/', { params }),

  createSelectiveGroup: (data: {
    group_name: string;
    curriculum_version_id: string;
    semester_id?: string;
    semester_no?: number;
  }) => api.post<SelectiveGroup>('/electives/selective-groups/', data),

  getSelectiveGroupDetail: (id: string) =>
    api.get<SelectiveGroup>(`/electives/selective-groups/${id}/`),

  deleteSelectiveGroup: (id: string) =>
    api.delete(`/electives/selective-groups/${id}/`),

  createEligibilityRule: (data: Partial<EligibilityRule> & { selective_group_id: string; course_id: string }) =>
    api.post<EligibilityRule>('/electives/eligibility-rules/', data),

  deleteEligibilityRule: (id: string) =>
    api.delete(`/electives/eligibility-rules/?pk=${id}`),

  getElectiveCourses: (params: { batch: string; semester?: string; semester_id?: string; student?: string }) =>
    api.get<GroupedElectiveCoursesResponse>('/electives/courses/choices/', { params }),

  getCourseChoices: (params: { batch: string; semester?: string; semester_id?: string; student?: string }) =>
    api.get<GroupedElectiveCoursesResponse>('/electives/courses/choices/', { params }),

  enrollElectives: (data: EnrollRequest) =>
    api.post<EnrollResponse>('/electives/students/enroll/', data),

  getMyEnrollments: (params?: { batch_id?: string; semester_id?: string; semester_no?: string }) =>
    api.get<StudentElectiveEnrollment[]>('/electives/students/my-enrollments/', { params }),

  getSACEnrollments: (params: { batch: string; semester?: string; semester_id?: string }) =>
    api.get<SACElectiveEnrollmentsResponse>('/electives/sac/enrollments/', { params }),

  sacAssign: (data: SACAssignRequest) =>
    api.post<StudentElectiveEnrollment>('/electives/sac/assign/', data),

  openSelectionWindow: (data: WindowOpenRequest) =>
    api.post<ElectiveSelectionWindow>('/electives/sac/window/open/', data),

  lockSelectionWindow: async (data: WindowLockRequest): Promise<LockWithIncompleteResponse> => {
    try {
      const response = await api.post<{ window: ElectiveSelectionWindow; locked_enrollments_count: number }>(
        '/electives/sac/window/lock/',
        data
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 400) {
        const errData = error.response.data;
        const windowLockError: WindowLockError = {
          error: errData?.error || errData?.message || 'Lock failed due to incomplete selections',
          incomplete_picks: errData?.incomplete_picks || errData?.incomplete_selections || undefined,
        };
        return windowLockError;
      }
      throw error;
    }
  },

   lockElectiveEnrollmentsOnly: (data: { batch_id: string; semester_id?: string; semester_no?: number }) =>
    api.post<{ window: ElectiveSelectionWindow; locked_enrollments_count: number; message: string }>(
      '/electives/sac/window/lock-electives/',
      data
    ),

  listWindows: (params?: { batch_id?: string; semester_id?: string }) =>
    api.get<ElectiveSelectionWindow[]>('/electives/sac/windows/', { params }),
};

export default electivesApi;
