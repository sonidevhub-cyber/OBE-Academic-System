import { api } from './api';

// ==================== STUDENT MODULE ====================
export const studentService = {
  getAll: (filters?: { department?: number; semester?: number; search?: string; ordering?: string }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department.toString());
    if (filters?.semester) params.append('semester', filters.semester.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.ordering) params.append('ordering', filters.ordering);
    return api.get(`students/${params.toString() ? '?' + params.toString() : ''}`);
  },
  getById: (id: number) => api.get(`students/${id}/`),
  create: (data: any) => api.post('students/', data),
  update: (id: number, data: any) => api.put(`students/${id}/`, data),
  delete: (id: number) => api.delete(`students/${id}/`),
  getProfile: () => api.get('students/profile/'),
  uploadImage: (id: number, formData: FormData) => api.post(`students/${id}/upload-image/`, formData),
  getStatistics: () => api.get('students/department-stats/'),
  getByDepartment: (departmentId?: number) => api.get(`students/department-filter/${departmentId ? '?department_id=' + departmentId : ''}`),
  // Backward compatibility aliases
  getAllStudents: function(filters?: any) { return this.getAll(filters); },
  getStudentById: function(id: number) { return this.getById(id); },
  createStudent: function(data: any) { return this.create(data); },
  updateStudent: function(id: number, data: any) { return this.update(id, data); },
  deleteStudent: function(id: number) { return this.delete(id); },
  uploadStudentImage: function(id: number, formData: FormData) { return this.uploadImage(id, formData); },
};

// ==================== DEPARTMENT MODULE ====================
export const departmentService = {
  getAll: () => api.get('academics/departments/'),
  getById: (id: number) => api.get(`academics/departments/${id}/`),
  create: (data: any) => api.post('academics/departments/', data),
  update: (id: number, data: any) => api.put(`academics/departments/${id}/`, data),
  delete: (id: number) => api.delete(`academics/departments/${id}/`),
  // Backward compatibility aliases
  getAllDepartments: function() { return this.getAll(); },
  getDepartmentById: function(id: number) { return this.getById(id); },
  createDepartment: function(data: any) { return this.create(data); },
  updateDepartment: function(id: number, data: any) { return this.update(id, data); },
  deleteDepartment: function(id: number) { return this.delete(id); },
  getSemestersByDepartment: (departmentId: number) => api.get(`academics/departments/${departmentId}/semesters/`),
};

// ==================== SEMESTER MODULE ====================
export const semesterService = {
  getAll: () => api.get('academics/semesters/'),
  getById: (id: number) => api.get(`academics/semesters/${id}/`),
  create: (data: any) => api.post('academics/semesters/', data),
  update: (id: number, data: any) => api.put(`academics/semesters/${id}/`, data),
  delete: (id: number) => api.delete(`academics/semesters/${id}/`),
  getByDepartment: (departmentId: number) => api.get(`academics/departments/${departmentId}/semesters/`),
  // Backward compatibility aliases
  getAllSemesters: function() { return this.getAll(); },
  getSemesterById: function(id: number) { return this.getById(id); },
  createSemester: function(data: any) { return this.create(data); },
  updateSemester: function(id: number, data: any) { return this.update(id, data); },
  deleteSemester: function(id: number) { return this.delete(id); },
  getSemestersByDepartment: function(departmentId: number) { return this.getByDepartment(departmentId); },
};

// ==================== COURSE MODULE ====================
export const courseService = {
  getAll: () => api.get('academics/courses/'),
  getById: (id: number) => api.get(`academics/courses/${id}/`),
  create: (data: any) => api.post('academics/courses/', data),
  update: (id: number, data: any) => api.put(`academics/courses/${id}/`, data),
  delete: (id: number) => api.delete(`academics/courses/${id}/`),
  getBySemester: (semesterId: number) => api.get(`academics/courses/?semester=${semesterId}`),
  // Backward compatibility aliases
  getAllCourses: function() { return this.getAll(); },
  getCourseById: function(id: number) { return this.getById(id); },
  createCourse: function(data: any) { return this.create(data); },
  updateCourse: function(id: number, data: any) { return this.update(id, data); },
  deleteCourse: function(id: number) { return this.delete(id); },
  getCoursesBySemester: function(semesterId: number) { return this.getBySemester(semesterId); },
};

// ==================== INSTRUCTOR MODULE ====================
export const instructorService = {
  getAll: () => api.get('instructors/'),
  getById: (id: number) => api.get(`instructors/${id}/`),
  create: (data: any) => api.post('instructors/', data),
  update: (id: number, data: any) => api.put(`instructors/${id}/`, data),
  delete: (id: number) => api.delete(`instructors/${id}/`),
  getProfile: () => api.get('instructors/profile/'),
  // Backward compatibility aliases
  getAllInstructors: function() { return this.getAll(); },
};

// ==================== HOD MODULE ====================
export const hodService = {
  getAll: () => api.get('hods/'),
  getById: (id: number) => api.get(`hods/${id}/`),
  create: (data: any) => api.post('hods/', data),
  update: (id: number, data: any) => api.put(`hods/${id}/`, data),
  delete: (id: number) => api.delete(`hods/${id}/`),
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
