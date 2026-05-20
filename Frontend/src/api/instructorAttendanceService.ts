import { api } from './api';

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface Semester {
  id: number;
  name: string;
  department: number;
}

export interface Student {
  student_id: string;
  name: string;
  email: string;
  department: number;
  semester: number;
  department_name: string;
  semester_name: string;
}

export interface AttendanceRecord {
  student_id: string;
  student_name: string;
  status: 'Present' | 'Absent' | 'Late';
  created: boolean;
}

export interface BulkAttendanceRequest {
  date: string;
  attendances: {
    student_id: string;
    status: 'Present' | 'Absent' | 'Late';
  }[];
}

export interface BulkAttendanceResponse {
  message: string;
  attendances: AttendanceRecord[];
}

class InstructorAttendanceService {
  // Get all departments added by admin (for attendance and results)
  async getDepartments(): Promise<Department[]> {
    const response = await api.get('/instructors/departments/');
    return response.data;
  }

  // Get semesters for a department
  async getSemestersByDepartment(departmentId: number): Promise<Semester[]> {
    const response = await api.get(`/instructors/departments/${departmentId}/semesters/`);
    return response.data;
  }

  // Get students by department and semester
  async getStudentsByDepartmentAndSemester(departmentId: number, semesterId: number): Promise<Student[]> {
    const response = await api.get(`/instructors/departments/${departmentId}/semesters/${semesterId}/students/`);
    return response.data;
  }

  // Mark bulk attendance
  async markBulkAttendance(data: BulkAttendanceRequest): Promise<BulkAttendanceResponse> {
    const response = await api.post('/instructors/attendance/bulk/', data);
    return response.data;
  }
}

export const instructorAttendanceService = new InstructorAttendanceService();
