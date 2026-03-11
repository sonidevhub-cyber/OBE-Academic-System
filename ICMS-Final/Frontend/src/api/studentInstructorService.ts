import { api } from './api';
import { AxiosResponse } from 'axios';

// User Interface
export interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  role: string;
}

// Department Interface
export interface Department {
  id?: number;
  name: string;
  description: string;
  code: string; // Required field that was missing
}

// Semester Interface
export interface Semester {
  id?: number;
  name: string;
  semester_code: string;
  program: string;
  capacity: number;
  department: number;
}

// Instructor Interface
export interface Instructor {
  id?: number;
  user?: User | number;
  name?: string;
  email?: string;
  phone?: string;
  department?: Department | number;
  department_id?: number;
  department_name?: string;
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
  id?: number;
  name: string;
  code: string;
  department: number;
}

// Course Interface
export interface Course {
  course_id: number;
  name: string;
  code: string;
  description?: string;
  semester_details?: {
    semester_id: number;
    name: string;
    semester_code: string;
    department: {
      department_id: number;
      name: string;
      code: string;
    };
  };
}

// InstructorAssignment Interface
export interface InstructorAssignment {
  id?: number;
  instructor: number;
  semester: number;
  subject: number;
}

// Department Service
export const departmentService = {
  // Department methods
  getAllDepartments: (): Promise<AxiosResponse<any>> => api.get('academics/departments/'),
  getDepartmentById: (id: number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${id}/`),
  createDepartment: (data: Department): Promise<AxiosResponse<any>> => api.post('academics/departments/', data),
  updateDepartment: (id: number, data: Department): Promise<AxiosResponse<any>> => api.put(`academics/departments/${id}/`, data),
  deleteDepartment: (id: number): Promise<AxiosResponse<any>> => api.delete(`academics/departments/${id}/`),

  // Semester methods
  getAllSemesters: (): Promise<AxiosResponse<any>> => api.get('academics/semesters/'),
  getSemesterById: (id: number): Promise<AxiosResponse<any>> => api.get(`academics/semesters/${id}/`),
  getSemestersByDepartment: (departmentId: number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${departmentId}/semesters/`),
  createSemester: (data: any): Promise<AxiosResponse<any>> => api.post('academics/semesters/', data),
  updateSemester: (id: number, data: any): Promise<AxiosResponse<any>> => api.put(`academics/semesters/${id}/`, data),
  deleteSemester: (id: number): Promise<AxiosResponse<any>> => api.delete(`academics/semesters/${id}/`),
};

// Instructor Service
export const instructorService = {
  // Using the correct endpoint path that matches the backend URL configuration
  getAllInstructors: (): Promise<AxiosResponse<any>> => api.get('instructors/instructor/'),
  getInstructorById: (id: number): Promise<AxiosResponse<any>> => api.get(`instructors/instructor/${id}/`),
  getInstructorProfile: (): Promise<AxiosResponse<any>> => api.get('instructors/profile/'),
  createInstructor: (data: Instructor | FormData): Promise<AxiosResponse<any>> => api.post('instructors/instructor/', data),
  updateInstructor: (id: number, data: Instructor | FormData): Promise<AxiosResponse<any>> => api.put(`instructors/instructor/${id}/`, data),
  deleteInstructor: (id: number): Promise<AxiosResponse<any>> => api.delete(`instructors/instructor/${id}/`),
  uploadInstructorImage: (id: number, imageData: FormData): Promise<AxiosResponse<any>> => api.post(`instructors/instructor/${id}/upload-image/`, imageData),
  getAllDepartments: (): Promise<AxiosResponse<any>> => api.get('academics/departments/'),
};

// Instructor Assignment Service
export const instructorAssignmentService = {
  getAllAssignments: (): Promise<AxiosResponse<any>> => api.get('instructor-assignments/'),
  getAssignmentById: (id: number): Promise<AxiosResponse<any>> => api.get(`instructor-assignments/${id}/`),
  createAssignment: (data: InstructorAssignment): Promise<AxiosResponse<any>> => api.post('instructor-assignments/', data),
  updateAssignment: (id: number, data: InstructorAssignment): Promise<AxiosResponse<any>> => api.put(`instructor-assignments/${id}/`, data),
  deleteAssignment: (id: number): Promise<AxiosResponse<any>> => api.delete(`instructor-assignments/${id}/`),
};

// Subject Service
export const subjectService = {
  getAllSubjects: (): Promise<AxiosResponse<any>> => api.get('academics/subjects/'),
  getSubjectById: (id: number): Promise<AxiosResponse<any>> => api.get(`academics/subjects/${id}/`),
  createSubject: (data: Subject): Promise<AxiosResponse<any>> => api.post('academics/subjects/', data),
  updateSubject: (id: number, data: Subject): Promise<AxiosResponse<any>> => api.put(`academics/subjects/${id}/`, data),
  deleteSubject: (id: number): Promise<AxiosResponse<any>> => api.delete(`academics/subjects/${id}/`),
  getSubjectsByDepartment: (departmentId: number): Promise<AxiosResponse<any>> => api.get(`academics/departments/${departmentId}/subjects/`),
};

// Course Service
export const courseService = {
  getAllCourses: (): Promise<AxiosResponse<any>> => api.get('academics/courses/'),
  getCourseById: (id: number): Promise<AxiosResponse<any>> => api.get(`academics/courses/${id}/`),
  createCourse: (data: any): Promise<AxiosResponse<any>> => api.post('academics/courses/', data),
  updateCourse: (id: number, data: any): Promise<AxiosResponse<any>> => api.put(`academics/courses/${id}/`, data),
  deleteCourse: (id: number): Promise<AxiosResponse<any>> => api.delete(`academics/courses/${id}/`),
  getCoursesBySemester: (semesterId: number): Promise<AxiosResponse<any>> => api.get(`academics/semesters/${semesterId}/courses/`),
};

// Student Service (for instructor use)
export const studentService = {
  getStudentCourses: (studentId: string): Promise<AxiosResponse<any>> => api.get(`students/${studentId}/courses/`),
};
