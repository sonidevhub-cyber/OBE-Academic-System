import { api } from './api';

export const academicsService = {
  getDepartments: () => api.get('academics/departments/'),
  getSemestersByDepartment: (departmentId: number) => api.get(`academics/departments/${departmentId}/semesters/`),
  getCourses: () => api.get('academics/courses/'),
  getCoursesBySemester: (semesterId: number) => api.get(`academics/semesters/${semesterId}/courses/`),
  getCoursesByDepartment: (departmentId: number) => api.get(`academics/departments/${departmentId}/courses/`),
  getResultsByDepartmentCourse: (departmentId: number, courseId: number) => api.get(`academics/departments/${departmentId}/courses/${courseId}/results/professional/`),

  // Attendance APIs
  getStudentAttendance: (studentId: string) => api.get(`academics/students/${studentId}/attendance/`),
  createStudentAttendance: (studentId: string, data: any) => api.post(`academics/students/${studentId}/attendance/`, data),
  updateAttendance: (attendanceId: number, data: any) => api.put(`academics/attendance/${attendanceId}/`, data),
  deleteAttendance: (attendanceId: number) => api.delete(`academics/attendance/${attendanceId}/`),

  // Result APIs
  getStudentResults: (studentId: string) => api.get(`academics/students/${studentId}/results/professional/`),
  createStudentResult: (studentId: string, data: any) => api.post(`academics/students/${studentId}/results/professional/`, data),
  updateResult: (resultId: number, data: any) => api.put(`academics/results/${resultId}/`, data),
  deleteResult: (resultId: number) => api.delete(`academics/results/${resultId}/`),

  // Add other academic related API calls here
};
