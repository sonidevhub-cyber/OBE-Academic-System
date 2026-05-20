import { api } from './api';

export interface StudentAttendanceRecord {
  id: number;
  student: number;
  student_name: string;
  course: number;
  course_name: string;
  instructor: number;
  instructor_name: string;
  timetable: number;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  is_locked: boolean;
  marked_at: string;
  updated_at: string;
}

export interface FacultyAttendanceRecord {
  id: number;
  instructor?: number;
  coordinator?: number;
  hod?: number;
  faculty_name: string;
  faculty_type: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  auto_marked: boolean;
  self_marked: boolean;
  is_locked: boolean;
  marked_at: string;
  updated_at: string;
}

export interface AttendanceEditRequest {
  id: number;
  request_type: 'student' | 'faculty';
  student_attendance?: number;
  faculty_attendance?: number;
  requested_by: number;
  requested_by_name: string;
  reason: string;
  proposed_status: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: number;
  admin_notes: string;
}

export interface InstructorClass {
  timetable_id: number;
  course_name: string;
  course_code: string;
  semester: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
  attendance_marked?: boolean;
  student_count: number;
  students?: Array<{
    student_id: number;
    name: string;
  }>;
}

export interface AttendanceStatistics {
  students: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
  };
  faculty: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
  };
}

export interface AttendanceReportResponse {
  student_attendance: StudentAttendanceRecord[];
  faculty_attendance: FacultyAttendanceRecord[];
  statistics: AttendanceStatistics;
}

export interface FacultyAttendanceSummary {
  attendance_records: FacultyAttendanceRecord[];
  statistics: {
    total_days: number;
    present_days: number;
    absent_days: number;
    auto_marked: number;
    self_marked: number;
    attendance_percentage: number;
  };
  faculty_name: string;
  faculty_type: string;
}

export interface FacultyAttendance {
  id: number;
  status: 'Present' | 'Absent' | 'Late' | 'Not Marked';
  date: string;
  marked_at: string;
  marked_by_system: boolean;
  marked_by_self: boolean;
  auto_marked: boolean;
  self_marked: boolean;
  can_edit: boolean;
  is_submitted: boolean;
}

export interface AttendanceSlot {
  timetable_id: number;
  course: {
    name: string;
    code: string;
  };
  department: string;
  semester: string;
  time_slot: string;
  room: string;
  time_remaining: number;
  is_submitted: boolean;
  can_mark_attendance: boolean;
  students: StudentAttendance[];
}

export interface StudentAttendance {
  student_id: number;
  name: string;
  email: string;
  current_status: 'Present' | 'Absent' | 'Late';
  can_edit: boolean;
}

class ProfessionalAttendanceService {
  // Instructor Methods
  async getInstructorClasses() {
    try {
      const response = await api.get('/attendance/instructor/classes/');
      return response.data;
    } catch (error) {
      console.error('Error fetching instructor classes:', error);
      throw error;
    }
  }

  async markClassAttendance(timetableId: number, attendanceData: Array<{student_id: number, status: string}>, date?: string) {
    try {
      const response = await api.post('/attendance/mark-class/', {
        timetable_id: timetableId,
        attendance_data: attendanceData,
        date: date || new Date().toISOString().split('T')[0]
      });
      return response.data;
    } catch (error) {
      console.error('Error marking class attendance:', error);
      throw error;
    }
  }

  // Faculty Self Attendance
  async markSelfAttendance(status: string = 'Present', date?: string) {
    try {
      const response = await api.post('/attendance/api/mark-self-attendance/', {
        status,
        date: date || new Date().toISOString().split('T')[0]
      });
      return response.data;
    } catch (error) {
      console.error('Error marking self attendance:', error);
      throw error;
    }
  }

  async getFacultyAttendanceSummary(): Promise<FacultyAttendanceSummary> {
    try {
      const response = await api.get('/attendance/api/faculty-attendance-summary/');
      return response.data;
    } catch (error) {
      console.error('Error fetching faculty attendance summary:', error);
      throw error;
    }
  }

  // Attendance Reports
  async getAttendanceReports(filters?: {
    department?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<AttendanceReportResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.department) params.append('department', filters.department.toString());
      if (filters?.date_from) params.append('date_from', filters.date_from);
      if (filters?.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/attendance/api/attendance-reports/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance reports:', error);
      throw error;
    }
  }

  // Edit Requests
  async requestAttendanceEdit(
    requestType: 'student' | 'faculty',
    attendanceId: number,
    reason: string,
    proposedStatus: string
  ) {
    try {
      const response = await api.post('/attendance/instructor/request-update/', {
        timetable_id: attendanceId,
        date: new Date().toISOString().split('T')[0],
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Error requesting attendance edit:', error);
      throw error;
    }
  }

  // Admin Methods
  async getEditRequests(): Promise<AttendanceEditRequest[]> {
    try {
      const response = await api.get('/attendance/api/manage-edit-requests/');
      return response.data;
    } catch (error) {
      console.error('Error fetching edit requests:', error);
      throw error;
    }
  }

  async manageEditRequest(requestId: number, action: 'approve' | 'reject', adminNotes?: string) {
    try {
      const response = await api.post('/attendance/api/manage-edit-requests/', {
        request_id: requestId,
        action,
        admin_notes: adminNotes || ''
      });
      return response.data;
    } catch (error) {
      console.error('Error managing edit request:', error);
      throw error;
    }
  }

  // Utility Methods
  formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Present':
        return 'text-green-600 bg-green-100';
      case 'Absent':
        return 'text-red-600 bg-red-100';
      case 'Late':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  calculateAttendancePercentage(present: number, total: number): number {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  }

  isCurrentTimeSlot(startTime: string, endTime: string): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const slotStart = startHour * 60 + startMin;
    const slotEnd = endHour * 60 + endMin;
    
    return currentTime >= slotStart && currentTime <= slotEnd;
  }

  getTodayClasses(classes: InstructorClass[]): InstructorClass[] {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return classes.filter(cls => cls.day === today);
  }

  // Bulk Operations
  async bulkMarkAttendance(
    timetableId: number,
    defaultStatus: string = 'Present',
    exceptions: Array<{student_id: number, status: string}> = []
  ) {
    try {
      const classData = await this.getInstructorClasses();
      const targetClass = classData.today_classes.find((cls: InstructorClass) => cls.timetable_id === timetableId);
      
      if (!targetClass) {
        throw new Error('Class not found');
      }

      const attendanceData = targetClass.students?.map((student: { student_id: number; name: string }) => {
        const exception = exceptions.find(ex => ex.student_id === student.student_id);
        return {
          student_id: student.student_id,
          status: exception ? exception.status : defaultStatus
        };
      }) || [];

      return await this.markClassAttendance(timetableId, attendanceData);
    } catch (error) {
      console.error('Error in bulk mark attendance:', error);
      throw error;
    }
  }

  // Analytics Methods
  async getAttendanceTrends(filters?: {
    department?: number;
    days?: number;
  }) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (filters?.days || 30));

      const reports = await this.getAttendanceReports({
        department: filters?.department,
        date_from: startDate.toISOString().split('T')[0],
        date_to: endDate.toISOString().split('T')[0]
      });

      const dailyStats = this.processDailyAttendanceStats(reports);
      
      return {
        daily_stats: dailyStats,
        overall_stats: reports.statistics,
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('Error fetching attendance trends:', error);
      throw error;
    }
  }

  private processDailyAttendanceStats(reports: AttendanceReportResponse) {
    const dailyStats: { [key: string]: { students: any, faculty: any } } = {};

    reports.student_attendance.forEach(record => {
      if (!dailyStats[record.date]) {
        dailyStats[record.date] = {
          students: { present: 0, absent: 0, late: 0, total: 0 },
          faculty: { present: 0, absent: 0, late: 0, total: 0 }
        };
      }
      dailyStats[record.date].students[record.status.toLowerCase() as 'present' | 'absent' | 'late']++;
      dailyStats[record.date].students.total++;
    });

    reports.faculty_attendance.forEach(record => {
      if (!dailyStats[record.date]) {
        dailyStats[record.date] = {
          students: { present: 0, absent: 0, late: 0, total: 0 },
          faculty: { present: 0, absent: 0, late: 0, total: 0 }
        };
      }
      dailyStats[record.date].faculty[record.status.toLowerCase() as 'present' | 'absent' | 'late']++;
      dailyStats[record.date].faculty.total++;
    });

    return dailyStats;
  }

  async getInstructorActiveSlots() {
    try {
      const response = await api.get('/attendance/api/instructor-classes/');
      const data = response.data;

      return {
        active_slots: data.today_classes || [],
        current_time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        current_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        instructor_name: data.instructor_name || 'Instructor'
      };
    } catch (error) {
      console.error('Error fetching instructor active slots:', error);
      throw error;
    }
  }

  async markStudentAttendance(timetableId: number, attendanceData: Array<{student_id: number, status: string}>) {
    return this.markClassAttendance(timetableId, attendanceData);
  }

  async submitAttendance(timetableId: number) {
    try {
      const response = await api.post('/attendance/api/submit-attendance/', {
        timetable_id: timetableId
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting attendance:', error);
      throw error;
    }
  }

  formatTimeSlot(startTime: string, endTime: string): string {
    return `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`;
  }

  // Missing methods for components
  async getDepartmentAttendanceSummary(dateFrom: string, dateTo: string) {
    try {
      const response = await api.get('/attendance/api/department-attendance-summary/', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching department attendance summary:', error);
      throw error;
    }
  }

  async getDepartmentAttendanceReport(dateFrom: string, dateTo: string) {
    try {
      const response = await api.get('/attendance/api/department-attendance-report/', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching department attendance report:', error);
      throw error;
    }
  }

  async getFacultyAttendanceStatus() {
    try {
      const response = await api.get('/attendance/api/faculty-attendance-status/');
      return response.data;
    } catch (error) {
      console.error('Error fetching faculty attendance status:', error);
      throw error;
    }
  }

  async markFacultyAttendance(status: 'Present' | 'Absent' | 'Late') {
    try {
      const response = await api.post('/attendance/api/mark-faculty-attendance/', {
        status
      });
      return response.data;
    } catch (error) {
      console.error('Error marking faculty attendance:', error);
      throw error;
    }
  }

  formatDateTime(dateTime: string): string {
    const d = new Date(dateTime);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

export const professionalAttendanceService = new ProfessionalAttendanceService();
export default professionalAttendanceService;
