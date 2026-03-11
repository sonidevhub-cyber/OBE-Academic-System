import { api } from './api';

export interface Coordinator {
  id: number;
  name: string;
  email: string;
  phone: string;
  employee_id: string;
  department: number;
  department_name: string;
  designation: string;
  specialization: string;
  experience_years: number;
  can_act_as_instructor: boolean;
  assigned_by: number;
  assigned_by_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TimetableProposal {
  proposal_id: number;
  title: string;
  description: string;
  semester: number;
  semester_name: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'implemented';
  coordinator: number;
  coordinator_name: string;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  hod_comments: string;
  slots: TimetableSlot[];
}

export interface TimetableSlot {
  id: number;
  course: number;
  course_name: string;
  course_code: string;
  instructor: number | null;
  instructor_name: string | null;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface CourseAllocation {
  allocation_id: number;
  course: number;
  course_name: string;
  course_code: string;
  instructor: number;
  instructor_name: string;
  semester: number;
  semester_name: string;
  coordinator: number;
  coordinator_name: string;
  status: 'proposed' | 'approved' | 'rejected' | 'active';
  proposed_at: string;
  approved_at: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  hod_comments: string;
}

export interface CoordinatorDashboard {
  id: number;
  coordinator: number;
  coordinator_name: string;
  total_courses_managed: number;
  total_instructors_coordinated: number;
  pending_approvals: number;
  active_timetables: number;
  training_hours: number;
  certifications: string;
  performance_rating: number;
  last_updated: string;
}

export interface DashboardOverview {
  coordinator_info: {
    name: string;
    department: string | null;
    can_act_as_instructor: boolean;
    experience_years: number;
  };
  dashboard_metrics: {
    total_courses_managed: number;
    total_instructors_coordinated: number;
    pending_approvals: number;
    active_timetables: number;
    approval_rate: number;
  };
  department_overview: {
    total_courses: number;
    total_instructors: number;
    pending_proposals: number;
    pending_allocations: number;
  };
  recent_activities: {
    proposals: Array<{
      id: number;
      title: string;
      status: string;
      created_at: string;
      semester: string;
    }>;
    allocations: Array<{
      id: number;
      course: string;
      instructor: string;
      status: string;
      proposed_at: string;
    }>;
  };
  professional_development: {
    training_hours: number;
    performance_rating: number;
    certifications: string;
  };
}

export interface TimetablePublishAudit {
  department: {
    id: number | null;
    name: string | null;
  };
  summary: {
    implemented_proposals: number;
    total_slots: number;
    published_slots: number;
    unpublished_slots: number;
  };
  audit: Array<{
    proposal_id: number;
    title: string;
    semester_name: string | null;
    coordinator_name: string | null;
    reviewed_at: string | null;
    published_slots: number;
    total_slots: number;
    slots: Array<{
      proposal_slot_id: number;
      course_name: string | null;
      course_code: string | null;
      instructor_name: string | null;
      day: string;
      start_time: string;
      end_time: string;
      room: string;
      published: boolean;
      timetable_id: number | null;
    }>;
  }>;
}

export const coordinatorService = {
  // Dashboard
  getDashboardOverview: () => 
    api.get<DashboardOverview>('coordinators/professional-dashboard/dashboard_overview/'),
  
  // Role Management
  getUserRoles: () =>
    api.get('coordinators/coordinators/get_user_roles/'),
  
  switchRole: (role: string) =>
    api.post('coordinators/coordinators/switch_role/', { role }),
  
  // Coordinators
  getCoordinators: () =>
    api.get<Coordinator[]>('coordinators/hod-management/department_coordinators/'),
  
  getCoordinator: (id: number) =>
    api.get<Coordinator>(`coordinators/${id}/`),
  
  getWorkloadAnalysis: () =>
    api.get('coordinators/professional-dashboard/workload_analysis/'),
  
  getPerformanceMetrics: () =>
    api.get('coordinators/professional-dashboard/performance_metrics/'),
  
  updateProfessionalInfo: (data: { training_hours?: number; certifications?: string }) =>
    api.post('coordinators/professional-dashboard/update_professional_info/', data),

  // Timetable Proposals
  getTimetableProposals: () =>
    api.get<TimetableProposal[]>('coordinators/timetable-proposals/'),
  
  createTimetableProposal: (data: { semester: number; title: string; description: string }) =>
    api.post<TimetableProposal>('coordinators/timetable-proposals/', data),
  
  getTimetableProposal: (id: number) =>
    api.get<TimetableProposal>(`coordinators/timetable-proposals/${id}/`),
  
  updateTimetableProposal: (id: number, data: Partial<TimetableProposal>) =>
    api.put<TimetableProposal>(`coordinators/timetable-proposals/${id}/`, data),
  
  submitProposalToHOD: (id: number) =>
    api.post(`coordinators/timetable-proposals/${id}/submit_to_hod/`),

  approveTimetableProposal: (id: number, data: { comments?: string }) =>
    api.post(`coordinators/timetable-proposals/${id}/approve_proposal/`, data),

  rejectTimetableProposal: (id: number, data: { comments?: string }) =>
    api.post(`coordinators/timetable-proposals/${id}/reject_proposal/`, data),

  getTimetablePublishAudit: () =>
    api.get<TimetablePublishAudit>('coordinators/timetable-proposals/published_audit/'),
  
  // Timetable Slots
  getTimetableSlots: (proposalId?: number) =>
    api.get<TimetableSlot[]>('coordinators/timetable-slots/', {
      params: proposalId ? { proposal_id: proposalId } : {}
    }),
  
  createTimetableSlot: (data: {
    proposal_id: number;
    course: number;
    instructor?: number;
    day: string;
    start_time: string;
    end_time: string;
    room: string;
  }) =>
    api.post<TimetableSlot>('coordinators/timetable-slots/', data),
  
  updateTimetableSlot: (id: number, data: Partial<TimetableSlot>) =>
    api.put<TimetableSlot>(`coordinators/timetable-slots/${id}/`, data),
  
  deleteTimetableSlot: (id: number) =>
    api.delete(`coordinators/timetable-slots/${id}/`),

  // Course Allocations
  getCourseAllocations: () =>
    api.get<CourseAllocation[]>('coordinators/course-allocations/'),
  
  createCourseAllocation: (data: {
    course: number;
    instructor: number;
    semester: number;
    hod_comments?: string;
  }) =>
    api.post<CourseAllocation>('coordinators/course-allocations/', data),
  
  updateCourseAllocation: (id: number, data: Partial<CourseAllocation>) =>
    api.put<CourseAllocation>(`coordinators/course-allocations/${id}/`, data),
  
  deleteCourseAllocation: (id: number) =>
    api.delete(`coordinators/course-allocations/${id}/`),
  
  approveCourseAllocation: (id: number, data: { comments?: string }) =>
    api.post(`coordinators/course-allocations/${id}/approve_allocation/`, data),
  
  rejectCourseAllocation: (id: number, data: { comments?: string; rejection_reason?: string }) =>
    api.post(`coordinators/course-allocations/${id}/reject_allocation/`, data),

  // Academic Data
  getDepartments: () =>
    api.get('academics/departments/'),
  
  getSemesters: () =>
    api.get('academics/semesters/'),
  
  getCourses: (semesterId?: number) =>
    api.get('academics/courses/', {
      params: semesterId ? { semester: semesterId } : {}
    }),
  
  getInstructors: () =>
    api.get('instructors/instructor/'),

  // Rooms
  getRooms: () =>
    api.get('academics/rooms/'),

  // Timetables - Professional semester-based system
  getTimetables: () =>
    api.get('coordinators/semester-timetables/'),
  
  createSemesterTimetable: (data: {
    semester_id: number;
    timetable_slots: Array<{
      allocation_id: number;
      day: string;
      start_time: string;
      end_time: string;
      room_name: string;
    }>;
  }) =>
    api.post('coordinators/timetable-proposals/', {
      semester: data.semester_id,
      title: `Semester ${data.semester_id} Timetable`,
      description: `Complete timetable for semester ${data.semester_id}`,
      status: 'submitted',
      slots: data.timetable_slots.map(slot => ({
        allocation_id: slot.allocation_id,
        day: slot.day,
        start_time: slot.start_time,
        end_time: slot.end_time,
        room: slot.room_name
      }))
    }),
  
  checkTimeConflicts: (data: {
    day: string;
    start_time: string;
    end_time: string;
    room_name: string;
    instructor_id: number;
  }) =>
    api.post('coordinators/check-time-conflicts/', data),

  // HOD Management
  promoteInstructorToCoordinator: (instructorId: number, canActAsInstructor: boolean = false) =>
    api.post('coordinators/hod-management/promote_instructor_to_coordinator/', {
      instructor_id: instructorId,
      can_act_as_instructor: canActAsInstructor
    }),

  updateCoordinator: (id: number, data: Partial<Coordinator>) =>
    api.post(`coordinators/hod-management/${id}/toggle_instructor_permission/`),
};
