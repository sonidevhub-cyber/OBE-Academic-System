import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export interface TimetableEntry {
  id: number;
  course_code: string;
  course_name: string;
  instructor_name: string;
  room: string;
  start_time: string;
  end_time: string;
  day: string;
  semester?: string;
  department?: string;
  credits?: number;
  type?: 'lecture' | 'lab' | 'tutorial';
  instructor_id?: number;
  course_id?: number;
  semester_id?: number;
}

export interface TimetableResponse {
  timetable: {
    [key: string]: TimetableEntry[];
  };
  student_name?: string;
  student_id?: string;
  instructor_name?: string;
  instructor_id?: string;
  department?: string;
  semester?: string;
  total_classes?: number;
  total_credits?: number;
}

export interface TimetableFilters {
  semester_id?: number;
  department_id?: number;
  instructor_id?: number;
  course_type?: string;
  day?: string;
}

class ProfessionalTimetableService {
  private getAuthHeaders() {
    const authData = localStorage.getItem('auth');
    if (!authData) {
      throw new Error('No authentication data found');
    }
    
    const { access_token } = JSON.parse(authData);
    return {
      'Authorization': `Token ${access_token}`,
      'Content-Type': 'application/json'
    };
  }

  // Student Timetable Methods
  async getStudentTimetable(studentId?: string, filters?: TimetableFilters): Promise<TimetableResponse> {
    try {
      const params = new URLSearchParams();
      if (studentId) params.append('student_id', studentId);
      if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());
      if (filters?.course_type) params.append('course_type', filters.course_type);

      const response = await axios.get(
        `${API_BASE_URL}/students/timetable/?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return this.formatTimetableResponse(response.data);
    } catch (error) {
      console.error('Error fetching student timetable:', error);
      throw this.handleError(error);
    }
  }

  // Instructor Timetable Methods
  async getInstructorTimetable(instructorId?: string, filters?: TimetableFilters): Promise<TimetableResponse> {
    try {
      const params = new URLSearchParams();
      if (instructorId) params.append('instructor_id', instructorId);
      if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());
      if (filters?.day) params.append('day', filters.day);

      const response = await axios.get(
        `${API_BASE_URL}/instructors/timetable/?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return this.formatTimetableResponse(response.data);
    } catch (error) {
      console.error('Error fetching instructor timetable:', error);
      throw this.handleError(error);
    }
  }

  // HOD Timetable Methods
  async getHODTimetable(filters?: TimetableFilters): Promise<TimetableResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());
      if (filters?.department_id) params.append('department_id', filters.department_id.toString());
      if (filters?.instructor_id) params.append('instructor_id', filters.instructor_id.toString());

      const response = await axios.get(
        `${API_BASE_URL}/hods/timetable/?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return this.formatTimetableResponse(response.data);
    } catch (error) {
      console.error('Error fetching HOD timetable:', error);
      throw this.handleError(error);
    }
  }

  // Generic Timetable Method (tries multiple endpoints)
  async getTimetable(userType?: string, userId?: string, filters?: TimetableFilters): Promise<TimetableResponse> {
    const endpoints = [
      `${API_BASE_URL}/timetable/`,
      `${API_BASE_URL}/students/timetable/`,
      `${API_BASE_URL}/instructors/timetable/`,
      `${API_BASE_URL}/hods/timetable/`,
      `${API_BASE_URL}/academics/timetable/`
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const params = new URLSearchParams();
        if (userId) params.append('user_id', userId);
        if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());

        const response = await axios.get(
          `${endpoint}?${params.toString()}`,
          { headers: this.getAuthHeaders() }
        );

        if (response.data && (response.data.timetable || response.data.timetables || Array.isArray(response.data))) {
          return this.formatTimetableResponse(response.data);
        }
      } catch (error) {
        lastError = error;
        console.log(`Endpoint ${endpoint} failed:`, error);
        continue;
      }
    }

    throw lastError || new Error('No timetable data available from any endpoint');
  }

  // Timetable Management Methods (for HOD/Admin)
  async createTimetableEntry(entry: Partial<TimetableEntry>): Promise<TimetableEntry> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/timetable/`,
        entry,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating timetable entry:', error);
      throw this.handleError(error);
    }
  }

  async updateTimetableEntry(id: number, entry: Partial<TimetableEntry>): Promise<TimetableEntry> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/timetable/${id}/`,
        entry,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error updating timetable entry:', error);
      throw this.handleError(error);
    }
  }

  async deleteTimetableEntry(id: number): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/timetable/${id}/`,
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error('Error deleting timetable entry:', error);
      throw this.handleError(error);
    }
  }

  // Bulk Operations
  async bulkCreateTimetableEntries(entries: Partial<TimetableEntry>[]): Promise<TimetableEntry[]> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/timetable/bulk-create/`,
        { entries },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error bulk creating timetable entries:', error);
      throw this.handleError(error);
    }
  }

  async bulkUpdateTimetableEntries(entries: { id: number; data: Partial<TimetableEntry> }[]): Promise<TimetableEntry[]> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/timetable/bulk-update/`,
        { entries },
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error bulk updating timetable entries:', error);
      throw this.handleError(error);
    }
  }

  // Export Methods
  async exportTimetable(format: 'pdf' | 'excel' | 'csv', filters?: TimetableFilters): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());
      if (filters?.department_id) params.append('department_id', filters.department_id.toString());

      const response = await axios.get(
        `${API_BASE_URL}/timetable/export/?${params.toString()}`,
        {
          headers: this.getAuthHeaders(),
          responseType: 'blob'
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error exporting timetable:', error);
      throw this.handleError(error);
    }
  }

  // Analytics Methods
  async getTimetableAnalytics(filters?: TimetableFilters): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (filters?.semester_id) params.append('semester_id', filters.semester_id.toString());
      if (filters?.department_id) params.append('department_id', filters.department_id.toString());

      const response = await axios.get(
        `${API_BASE_URL}/timetable/analytics/?${params.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching timetable analytics:', error);
      throw this.handleError(error);
    }
  }

  // Conflict Detection
  async checkTimetableConflicts(entry: Partial<TimetableEntry>): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/timetable/check-conflicts/`,
        entry,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error checking timetable conflicts:', error);
      throw this.handleError(error);
    }
  }

  // Utility Methods
  private formatTimetableResponse(data: any): TimetableResponse {
    // Handle different response formats from various endpoints
    let timetableEntries: TimetableEntry[] = [];
    
    if (Array.isArray(data)) {
      timetableEntries = data;
    } else if (data.timetables && Array.isArray(data.timetables)) {
      timetableEntries = data.timetables;
    } else if (data.timetable) {
      if (Array.isArray(data.timetable)) {
        timetableEntries = data.timetable;
      } else if (typeof data.timetable === 'object') {
        // Handle grouped timetable data
        timetableEntries = Object.values(data.timetable).flat() as TimetableEntry[];
      }
    } else if (data.schedule && Array.isArray(data.schedule)) {
      timetableEntries = data.schedule;
    }

    // Group entries by day
    const groupedTimetable: { [key: string]: TimetableEntry[] } = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
      groupedTimetable[day] = timetableEntries.filter(entry => 
        entry.day?.toLowerCase() === day
      ).sort((a, b) => a.start_time.localeCompare(b.start_time));
    });

    return {
      timetable: groupedTimetable,
      student_name: data.student_name,
      student_id: data.student_id,
      instructor_name: data.instructor_name || data.instructor?.name,
      instructor_id: data.instructor_id || data.instructor?.id,
      department: data.department || data.instructor?.department,
      semester: data.semester,
      total_classes: timetableEntries.length,
      total_credits: timetableEntries.reduce((sum, entry) => sum + (entry.credits || 0), 0)
    };
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return new Error('Authentication failed. Please login again.');
      } else if (error.response?.status === 403) {
        return new Error('Access denied. You don\'t have permission to view this timetable.');
      } else if (error.response?.status === 404) {
        return new Error('Timetable not found.');
      } else if (error.response?.data?.error) {
        return new Error(error.response.data.error);
      } else if (error.response?.data?.message) {
        return new Error(error.response.data.message);
      }
    }
    
    return new Error(error.message || 'An unexpected error occurred while fetching timetable data.');
  }

  // Mock data for development/testing
  getMockTimetableData(): TimetableResponse {
    const mockEntries: TimetableEntry[] = [
      {
        id: 1,
        course_code: 'CS101',
        course_name: 'Introduction to Computer Science',
        instructor_name: 'Dr. John Smith',
        room: 'Room A-101',
        start_time: '09:00',
        end_time: '10:00',
        day: 'monday',
        semester: 'Fall 2024',
        department: 'Computer Science',
        credits: 3,
        type: 'lecture'
      },
      {
        id: 2,
        course_code: 'CS102',
        course_name: 'Programming Lab',
        instructor_name: 'Prof. Jane Doe',
        room: 'Lab B-201',
        start_time: '10:00',
        end_time: '12:00',
        day: 'monday',
        semester: 'Fall 2024',
        department: 'Computer Science',
        credits: 2,
        type: 'lab'
      },
      {
        id: 3,
        course_code: 'MATH201',
        course_name: 'Calculus II',
        instructor_name: 'Dr. Mike Johnson',
        room: 'Room C-301',
        start_time: '14:00',
        end_time: '15:00',
        day: 'tuesday',
        semester: 'Fall 2024',
        department: 'Mathematics',
        credits: 4,
        type: 'lecture'
      },
      {
        id: 4,
        course_code: 'ENG101',
        course_name: 'English Composition',
        instructor_name: 'Ms. Sarah Wilson',
        room: 'Room D-102',
        start_time: '11:00',
        end_time: '12:00',
        day: 'wednesday',
        semester: 'Fall 2024',
        department: 'English',
        credits: 3,
        type: 'lecture'
      },
      {
        id: 5,
        course_code: 'PHY101',
        course_name: 'Physics Lab',
        instructor_name: 'Dr. Robert Brown',
        room: 'Physics Lab 1',
        start_time: '15:00',
        end_time: '17:00',
        day: 'thursday',
        semester: 'Fall 2024',
        department: 'Physics',
        credits: 2,
        type: 'lab'
      },
      {
        id: 6,
        course_code: 'CS201',
        course_name: 'Data Structures Tutorial',
        instructor_name: 'Dr. Alice Green',
        room: 'Room E-205',
        start_time: '13:00',
        end_time: '14:00',
        day: 'friday',
        semester: 'Fall 2024',
        department: 'Computer Science',
        credits: 1,
        type: 'tutorial'
      }
    ];

    return this.formatTimetableResponse(mockEntries);
  }
}

export const professionalTimetableService = new ProfessionalTimetableService();
export default professionalTimetableService;