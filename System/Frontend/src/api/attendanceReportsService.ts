import { api } from './api';

export interface DepartmentAttendanceReport {
  report_type: 'summary' | 'detailed' | 'analytics';
  department: {
    id: number | null;
    name: string;
    code: string;
  };
  date_range: {
    from: string;
    to: string;
  };
  user_role: string;
  student_statistics?: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  faculty_statistics?: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  course_breakdown?: Record<string, {
    total: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  }>;
  faculty_type_breakdown?: {
    instructors: { total: number; present: number; absent: number; late: number };
    coordinators: { total: number; present: number; absent: number; late: number };
    hods: { total: number; present: number; absent: number; late: number };
  };
  student_records?: StudentAttendanceRecord[];
  faculty_records?: FacultyAttendanceRecord[];
  daily_trends?: DailyTrend[];
  course_performance?: {
    top_performing: CoursePerformance[];
    low_performing: CoursePerformance[];
  };
  faculty_performance?: Record<string, FacultyPerformance>;
  insights?: {
    total_days_analyzed: number;
    avg_student_attendance: number;
    avg_faculty_attendance: number;
    most_active_day: string | null;
    least_active_day: string | null;
  };
}

export interface StudentAttendanceRecord {
  student_id: string;
  student_name: string;
  course_code: string;
  course_name: string;
  instructor_name: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  marked_at: string | null;
  is_locked: boolean;
}

export interface FacultyAttendanceRecord {
  faculty_name: string;
  faculty_type: string;
  department: string | null;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  auto_marked: boolean;
  self_marked: boolean;
  marked_at: string | null;
  is_locked: boolean;
}

export interface DailyTrend {
  date: string;
  students: {
    total: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  faculty: {
    total: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
}

export interface CoursePerformance {
  course: string;
  total: number;
  present: number;
  attendance_rate: number;
}

export interface FacultyPerformance {
  total: number;
  present: number;
  auto_marked: number;
  self_marked: number;
  type: string;
  attendance_rate: number;
}

export interface AttendanceFilters {
  dateFrom?: string;
  dateTo?: string;
  reportType?: 'summary' | 'detailed' | 'analytics';
  departmentId?: number;
  studentId?: string;
  courseId?: number;
  facultyType?: 'instructor' | 'coordinator' | 'hod';
  facultyId?: number;
}

class AttendanceReportsService {
  /**
   * Get department-wise attendance reports for coordinators and HODs
   */
  async getDepartmentAttendanceReports(filters: AttendanceFilters = {}): Promise<DepartmentAttendanceReport> {
    const params: any = {};
    
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.reportType) params.report_type = filters.reportType;
    if (filters.departmentId) params.department_id = filters.departmentId;

    const response = await api.get('/attendance/api/department-reports/', { params });
    return response.data;
  }

  /**
   * Get detailed student attendance records
   */
  async getStudentAttendanceDetails(filters: AttendanceFilters = {}): Promise<{
    records: StudentAttendanceRecord[];
    total_records: number;
    filters_applied: any;
  }> {
    const params: any = {};
    
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.studentId) params.student_id = filters.studentId;
    if (filters.courseId) params.course_id = filters.courseId;

    const response = await api.get('/attendance/api/student-attendance-details/', { params });
    return response.data;
  }

  /**
   * Get detailed faculty attendance records
   */
  async getFacultyAttendanceDetails(filters: AttendanceFilters = {}): Promise<{
    records: FacultyAttendanceRecord[];
    total_records: number;
    filters_applied: any;
  }> {
    const params: any = {};
    
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.facultyType) params.faculty_type = filters.facultyType;
    if (filters.facultyId) params.faculty_id = filters.facultyId;

    const response = await api.get('/attendance/api/faculty-attendance-details/', { params });
    return response.data;
  }

  /**
   * Get summary report for dashboard widgets
   */
  async getSummaryReport(dateFrom?: string, dateTo?: string): Promise<DepartmentAttendanceReport> {
    return this.getDepartmentAttendanceReports({
      dateFrom,
      dateTo,
      reportType: 'summary'
    });
  }

  /**
   * Get analytics report for insights
   */
  async getAnalyticsReport(dateFrom?: string, dateTo?: string): Promise<DepartmentAttendanceReport> {
    return this.getDepartmentAttendanceReports({
      dateFrom,
      dateTo,
      reportType: 'analytics'
    });
  }

  /**
   * Get detailed report for comprehensive view
   */
  async getDetailedReport(dateFrom?: string, dateTo?: string): Promise<DepartmentAttendanceReport> {
    return this.getDepartmentAttendanceReports({
      dateFrom,
      dateTo,
      reportType: 'detailed'
    });
  }

  /**
   * Utility methods for data formatting and calculations
   */
  
  formatAttendanceRate(rate: number): string {
    return `${rate.toFixed(1)}%`;
  }

  getAttendanceRateColor(rate: number): string {
    if (rate >= 90) return 'text-green-600 bg-green-50';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-50';
    if (rate >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Present':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'Absent':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'Late':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Present':
        return '✓';
      case 'Absent':
        return '✗';
      case 'Late':
        return '⏰';
      default:
        return '?';
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDateRangeOptions(): { label: string; value: { from: string; to: string } }[] {
    const today = new Date();
    const getDateString = (date: Date) => date.toISOString().split('T')[0];
    
    return [
      {
        label: 'Last 7 days',
        value: {
          from: getDateString(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
          to: getDateString(today)
        }
      },
      {
        label: 'Last 30 days',
        value: {
          from: getDateString(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
          to: getDateString(today)
        }
      },
      {
        label: 'This month',
        value: {
          from: getDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
          to: getDateString(today)
        }
      },
      {
        label: 'Last month',
        value: {
          from: getDateString(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
          to: getDateString(new Date(today.getFullYear(), today.getMonth(), 0))
        }
      },
      {
        label: 'This semester',
        value: {
          from: getDateString(new Date(today.getFullYear(), today.getMonth() >= 6 ? 6 : 0, 1)),
          to: getDateString(today)
        }
      }
    ];
  }

  calculateTrend(currentRate: number, previousRate: number): {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    color: string;
  } {
    const diff = currentRate - previousRate;
    const percentage = Math.abs(diff);
    
    if (Math.abs(diff) < 0.5) {
      return { direction: 'stable', percentage, color: 'text-gray-600' };
    }
    
    return {
      direction: diff > 0 ? 'up' : 'down',
      percentage,
      color: diff > 0 ? 'text-green-600' : 'text-red-600'
    };
  }

  exportToCSV(data: any[], filename: string): void {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  generateReportSummary(report: DepartmentAttendanceReport): string {
    const { student_statistics, faculty_statistics, date_range } = report;
    
    if (!student_statistics || !faculty_statistics) return '';
    
    return `Department Attendance Report (${this.formatDate(date_range.from)} - ${this.formatDate(date_range.to)}):
    
Student Attendance: ${this.formatAttendanceRate(student_statistics.attendance_rate)} (${student_statistics.present}/${student_statistics.total_records})
Faculty Attendance: ${this.formatAttendanceRate(faculty_statistics.attendance_rate)} (${faculty_statistics.present}/${faculty_statistics.total_records})

Total Records: ${student_statistics.total_records + faculty_statistics.total_records}`;
  }
}

export const attendanceReportsService = new AttendanceReportsService();
export default attendanceReportsService;