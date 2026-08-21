import { api } from './api';
import { AxiosResponse } from 'axios';

// User Interface
export interface User {
  id: string;
  custom_id?: string;
  username?: string;
  email: string;
  name?: string;
  role?: string;
}

// Department Interface
export interface Department {
  id?: string | number;
  name: string;
  description: string;
  code: string; // Required field that was missing
}

// Semester Interface
export interface Semester {
  id?: string | number;
  name: string;
  semester_code: string;
  program: string;
  capacity: number;
  department: string;
}

// Instructor Interface
export interface Instructor {
  id?: string | number;
  custom_id?: string;
  user?: User | string;
  name?: string;
  email?: string;
  phone?: string;
  department?: Department | string;
  department_id?: string | number;
  department_name?: string;
  employment_type?: 'PERMANENT' | 'VISITING' | 'INTERNEE';
  qualification?: string;
  experience?: number;
  joining_date?: string;
  image?: string | null;
  user_email?: string;
  employee_id?: string;
  designation?: string;
  address?: string;
  specialization?: string;
  experience_years?: number;
  hire_date?: string;
  password?: string;
}

// Subject Interface
export interface Subject {
  id?: string | number;
  name: string;
  code: string;
  department: string;
}

// Course Interface
export interface Course {
  course_id: string | number;
  custom_id?: string;
  name: string;
  code: string;
  description?: string;
  semester_details?: {
    semester_id: string | number;
    name: string;
    semester_code: string;
    department: {
      department_id: string | number;
      name: string;
      code: string;
    };
  };
}

// InstructorAssignment Interface
export interface InstructorAssignment {
  id?: string | number;
  instructor: string;
  semester: string;
  subject: string;
}

// Department Service
export const departmentService = {
  // Department methods
  getAllDepartments: (): Promise<AxiosResponse<any>> => api.get('academics/departments/'),
  getDepartmentById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${id}/`),
  createDepartment: (data: Department): Promise<AxiosResponse<any>> => api.post('academics/departments/', data),
  updateDepartment: (id: string | number, data: Department): Promise<AxiosResponse<any>> => api.put(`academics/departments/${id}/`, data),
  deleteDepartment: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`academics/departments/${id}/`),

  // Semester methods
  getAllSemesters: (): Promise<AxiosResponse<any>> => api.get('academics/semesters/'),
  getSemesterById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`academics/semesters/${id}/`),
  getSemestersByDepartment: (departmentId: string | number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${departmentId}/semesters/`),
  createSemester: (data: any): Promise<AxiosResponse<any>> => api.post('academics/semesters/', data),
  updateSemester: (id: string | number, data: any): Promise<AxiosResponse<any>> => api.put(`academics/semesters/${id}/`, data),
  deleteSemester: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`academics/semesters/${id}/`),
};

// Instructor Service
export const instructorService = {
  // Using the correct endpoint path that matches the backend URL configuration
  getAllInstructors: (): Promise<AxiosResponse<any>> => api.get('instructors/'),
  getInstructorById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`instructors/${id}/`),
  getInstructorProfile: (): Promise<AxiosResponse<any>> => api.get('instructors/profile/'),
  createInstructor: (data: Instructor | FormData): Promise<AxiosResponse<any>> => api.post('instructors/', data),
  updateInstructor: (id: string | number, data: Instructor | FormData): Promise<AxiosResponse<any>> => api.put(`instructors/${id}/`, data),
  deleteInstructor: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`instructors/${id}/`),
  uploadInstructorImage: (id: string | number, imageData: FormData): Promise<AxiosResponse<any>> => api.post(`instructors/${id}/upload-image/`, imageData),
  getAllDepartments: (): Promise<AxiosResponse<any>> => api.get('academics/departments/'),
};

// Instructor Assignment Service
export const instructorAssignmentService = {
  getAllAssignments: (): Promise<AxiosResponse<any>> => api.get('instructor-assignments/'),
  getAssignmentById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`instructor-assignments/${id}/`),
  createAssignment: (data: InstructorAssignment): Promise<AxiosResponse<any>> => api.post('instructor-assignments/', data),
  updateAssignment: (id: string | number, data: InstructorAssignment): Promise<AxiosResponse<any>> => api.put(`instructor-assignments/${id}/`, data),
  deleteAssignment: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`instructor-assignments/${id}/`),
};

// Subject Service
export const subjectService = {
  getAllSubjects: (): Promise<AxiosResponse<any>> => api.get('academics/subjects/'),
  getSubjectById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`academics/subjects/${id}/`),
  createSubject: (data: Subject): Promise<AxiosResponse<any>> => api.post('academics/subjects/', data),
  updateSubject: (id: string | number, data: Subject): Promise<AxiosResponse<any>> => api.put(`academics/subjects/${id}/`, data),
  deleteSubject: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`academics/subjects/${id}/`),
  getSubjectsByDepartment: (departmentId: string | number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${departmentId}/subjects/`),
};

// Course Service
export const courseService = {
  getAllCourses: (): Promise<AxiosResponse<any>> => api.get('academics/courses/'),
  getCourseById: (id: string | number): Promise<AxiosResponse<any>> => api.get(`academics/courses/${id}/`),
  createCourse: (data: any): Promise<AxiosResponse<any>> => api.post('academics/courses/', data),
  updateCourse: (id: string | number, data: any): Promise<AxiosResponse<any>> => api.put(`academics/courses/${id}/`, data),
  deleteCourse: (id: string | number): Promise<AxiosResponse<any>> => api.delete(`academics/courses/${id}/`),
  getCoursesBySemester: (semesterId: string | number): Promise<AxiosResponse<any>> => api.get(`academics/semesters/${semesterId}/courses/`),
};

// Student Service (for instructor use)
export const studentService = {
  getStudentCourses: (studentId: string | number): Promise<AxiosResponse<any>> => api.get(`students/${studentId}/courses/`),
};
