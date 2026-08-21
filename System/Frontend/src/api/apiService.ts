import { api } from './api';

// ==================== STUDENT MODULE ====================
export const studentService = {
  getAll: (filters?: { department?: number; semester?: number; batch?: string; role?: string; search?: string; ordering?: string; page?: number; page_size?: number }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department.toString());
    if (filters?.semester) params.append('semester', filters.semester.toString());
    if (filters?.batch) params.append('batch', filters.batch);
    if (filters?.role) params.append('role', filters.role);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.ordering) params.append('ordering', filters.ordering);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    return api.get(`students/${params.toString() ? '?' + params.toString() : ''}`);
  },
  getById: (id: string | number) => api.get(`students/${id}/`),
  create: (data: any) => api.post('students/', data),
  update: (id: string | number, data: any) => api.put(`students/${id}/`, data),
  delete: (id: string | number) => api.delete(`students/${id}/`),
  getProfile: () => api.get('students/profile/'),
  uploadImage: (id: string | number, formData: FormData) => api.post(`students/${id}/upload-image/`, formData),
  getStatistics: () => api.get('students/department-stats/'),
  getByDepartment: (departmentId?: number) => api.get(`students/department-filter/${departmentId ? '?department_id=' + departmentId : ''}`),
  // Backward compatibility aliases
  getAllStudents: function(filters?: any) { return this.getAll(filters); },
  getStudentById: (id: string | number) => api.get(`students/${id}/`),
  createStudent: (data: any) => api.post('students/', data),
  updateStudent: (id: string | number, data: any) => api.put(`students/${id}/`, data),
  deleteStudent: (id: string | number) => api.delete(`students/${id}/`),
  uploadStudentImage: function(id: string | number, formData: FormData) { return this.uploadImage(id, formData); },
};

// ==================== DEPARTMENT MODULE ====================
export const departmentService = {
  getAll: () => api.get('academics/departments/'),
  getById: (id: string | number) => api.get(`academics/departments/${id}/`),
  create: (data: any) => api.post('academics/departments/', data),
  update: (id: string | number, data: any) => api.put(`academics/departments/${id}/`, data),
  delete: (id: string | number) => api.delete(`academics/departments/${id}/`),
  // Backward compatibility aliases
  getAllDepartments: function() { return this.getAll(); },
  getDepartmentById: function(id: string | number) { return this.getById(id); },
  createDepartment: function(data: any) { return this.create(data); },
  updateDepartment: function(id: string | number, data: any) { return this.update(id, data); },
  deleteDepartment: function(id: string | number) { return this.delete(id); },
  getSemestersByDepartment: (departmentId: string | number) => api.get(`academics/departments/${departmentId}/semesters/`),
};

// ==================== SEMESTER MODULE ====================
export const semesterService = {
  getAll: () => api.get('academics/semesters/'),
  getById: (id: string | number) => api.get(`academics/semesters/${id}/`),
  create: (data: any) => api.post('academics/semesters/', data),
  update: (id: string | number, data: any) => api.put(`academics/semesters/${id}/`, data),
  delete: (id: string | number) => api.delete(`academics/semesters/${id}/`),
  getByDepartment: (departmentId: string | number) => api.get(`academics/departments/${departmentId}/semesters/`),
  // Backward compatibility aliases
  getAllSemesters: function() { return this.getAll(); },
  getSemesterById: function(id: string | number) { return this.getById(id); },
  createSemester: function(data: any) { return this.create(data); },
  updateSemester: function(id: string | number, data: any) { return this.update(id, data); },
  deleteSemester: function(id: string | number) { return this.delete(id); },
  getSemestersByDepartment: function(departmentId: string | number) { return this.getByDepartment(departmentId); },
};

// ==================== COURSE MODULE ====================
export const courseService = {
  getAll: () => api.get('courses/'),
  getById: (id: string | number) => api.get(`courses/${id}/`),
  create: (data: any) => api.post('courses/', data),
  update: (id: string | number, data: any) => api.put(`courses/${id}/`, data),
  delete: (id: string | number) => api.delete(`courses/${id}/`),
  getBySemester: (semesterId: string | number) => api.get(`courses/?semester=${semesterId}`),
  // Backward compatibility aliases
  getAllCourses: function() { return this.getAll(); },
  getCourseById: function(id: string | number) { return this.getById(id); },
  createCourse: function(data: any) { return this.create(data); },
  updateCourse: function(id: string | number, data: any) { return this.update(id, data); },
  deleteCourse: function(id: string | number) { return this.delete(id); },
  getCoursesBySemester: function(semesterId: string | number) { return this.getBySemester(semesterId); },
};

// ==================== INSTRUCTOR MODULE ====================
export const instructorService = {
  getAll: () => api.get('instructors/'),
  getById: (id: string | number) => api.get(`instructors/${id}/`),
  create: (data: any) => api.post('instructors/', data),
  update: (id: string | number, data: any) => api.put(`instructors/${id}/`, data),
  delete: (id: string | number) => api.delete(`instructors/${id}/`),
  getProfile: () => api.get('instructors/profile/'),
  // Backward compatibility aliases
  getAllInstructors: function() { return this.getAll(); },
};

// ==================== HOD MODULE ====================
export const hodService = {
  getAll: () => api.get('hods/'),
  getById: (id: string | number) => api.get(`hods/${id}/`),
  create: (data: any) => api.post('hods/', data),
  update: (id: string | number, data: any) => api.put(`hods/${id}/`, data),
  delete: (id: string | number) => api.delete(`hods/${id}/`),
  getProfile: () => api.get('hods/profile/'),
};

// ==================== TIMETABLE MODULE ====================
export const timetableService = {
  getAll: () => api.get('academics/timetables/'),
  getById: (id: number) => api.get(`academics/timetables/${id}/`),
  create: (data: any) => api.post('academics/timetables/', data),
  update: (id: number, data: any) => api.put(`academics/timetables/${id}/`, data),
  delete: (id: number) => api.delete(`academics/timetables/${id}/`),
  getByDepartment: (departmentId: number) => api.get(`academics/timetables/?department=${departmentId}`),
  getBySemester: (semesterId: number) => api.get(`academics/timetables/?semester=${semesterId}`),
};

// ==================== ATTENDANCE MODULE ====================
export const attendanceService = {
  getAll: () => api.get('academics/attendance/'),
  getById: (id: number) => api.get(`academics/attendance/${id}/`),
  create: (data: any) => api.post('academics/attendance/', data),
  update: (id: number, data: any) => api.put(`academics/attendance/${id}/`, data),
  delete: (id: number) => api.delete(`academics/attendance/${id}/`),
  getByStudent: (studentId: number) => api.get(`academics/attendance/?student=${studentId}`),
  getByCourse: (courseId: number) => api.get(`academics/attendance/?course=${courseId}`),
  markAttendance: (data: any) => api.post('academics/attendance/mark/', data),
};

// ==================== FEEDBACK MODULE ====================
export const feedbackService = {
  submit: (data: any) => api.post('feedback/submit/', data),
  getDepartmentFeedback: () => api.get('feedback/department/'),
  markReviewed: (id: number) => api.patch(`feedback/${id}/reviewed/`),
  getNotifications: () => api.get('feedback/notifications/'),
  markNotificationRead: (id: number) => api.patch(`feedback/notifications/${id}/read/`),
};

// ==================== ANNOUNCEMENT MODULE ====================
export const announcementService = {
  getAll: () => api.get('announcements/'),
  getById: (id: number) => api.get(`announcements/${id}/`),
  create: (data: any) => api.post('announcements/', data),
  update: (id: number, data: any) => api.put(`announcements/${id}/`, data),
  delete: (id: number) => api.delete(`announcements/${id}/`),
  // Backward compatibility aliases
  getAllAnnouncements: function() { return this.getAll(); },
  getAnnouncementById: function(id: number) { return this.getById(id); },
  createAnnouncement: function(data: any) { return this.create(data); },
  updateAnnouncement: function(id: number, data: any) { return this.update(id, data); },
  deleteAnnouncement: function(id: number) { return this.delete(id); },
};

// ==================== EVENT MODULE ====================
export const eventService = {
  getAll: () => api.get('events/'),
  create: (data: any) => api.post('events/', data),
  approve: (id: number) => api.post(`events/${id}/approve/`),
  reject: (id: number) => api.post(`events/${id}/reject/`),
};

// ==================== RESULT MODULE ====================
export const resultService = {
  getAll: () => api.get('academics/results/'),
  getById: (id: number) => api.get(`academics/results/${id}/`),
  create: (data: any) => api.post('academics/results/', data),
  update: (id: number, data: any) => api.put(`academics/results/${id}/`, data),
  delete: (id: number) => api.delete(`academics/results/${id}/`),
  getByStudent: (studentId: number) => api.get(`academics/results/?student=${studentId}`),
};

// ==================== CLASS SCHEDULE MODULE ====================
export const scheduleService = {
  getAll: () => api.get('academics/schedules/'),
  getById: (id: number) => api.get(`academics/schedules/${id}/`),
  create: (data: any) => api.post('academics/schedules/', data),
  update: (id: number, data: any) => api.put(`academics/schedules/${id}/`, data),
  delete: (id: number) => api.delete(`academics/schedules/${id}/`),
  getByDepartment: (departmentId: number) => api.get(`academics/schedules/?department=${departmentId}`),
  getByInstructor: (instructorId: number) => api.get(`academics/schedules/?instructor=${instructorId}`),
};

// ==================== ADMIN MODULE ====================
export const adminService = {
  getDashboardStats: () => api.get('admin/dashboard-stats/'),
  getSystemHealth: () => api.get('admin/system-health/'),
  getUsers: () => api.get('admin/users/'),
  createUser: (data: any) => api.post('admin/users/', data),
  updateUser: (id: number, data: any) => api.put(`admin/users/${id}/`, data),
  deleteUser: (id: number) => api.delete(`admin/users/${id}/`),
};

// Re-export authService from api.ts
export { authService } from './api';