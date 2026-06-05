import { api } from './api';

export interface InstructorCourse {
  allocation_id: number;
  course_id: number;
  course_name: string;
  course_code: string;
  course_description: string;
  credits: number;
  semester_id: number;
  semester_name: string;
  semester_code: string;
  department: string;
  coordinator_name: string;
  approved_at: string;
  hod_comments: string;
  status: string;
}

export interface CoursesSummary {
  total_allocated: number;
  active_courses: number;
  pending_approval: number;
  approved_courses: number;
  rejected_courses: number;
  recent_allocations: Array<{
    course_name: string;
    course_code: string;
    status: string;
    proposed_at: string;
    approved_at: string;
  }>;
}

export interface CourseDetails {
  allocation_id: number;
  course: {
    course_id: number;
    name: string;
    code: string;
    description: string;
    credits: number;
  };
  semester: {
    semester_id: number;
    name: string;
    code: string;
    program: string;
    capacity: number;
    department: string;
  };
  coordinator: {
    name: string;
    email: string;
    phone: string;
  };
  students: Array<{
    student_id: number;
    name: string;
    email: string;
    phone: string;
  }>;
  total_students: number;
  approved_at: string;
  hod_comments: string;
}

export const instructorCourseService = {
  // Get all active courses for instructor
  getMyCourses: () => {
    return api.get('/instructors/my-courses/');
  },

  // Get courses summary (mapped to the new endpoint for now to avoid 404)
  getCoursesSummary: () => {
    return api.get('/instructors/my-courses/');
  },

  // Get detailed information about a specific course
  getCourseDetails: (courseId: number) => {
    return api.get(`/instructors/my-courses/?course_id=${courseId}`);
  },

  // Get course allocations (including pending ones)
  getAllAllocations: () => {
    return api.get('/coordinators/');
  }
};