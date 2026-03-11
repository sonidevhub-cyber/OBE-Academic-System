import axios from 'axios';

const API_BASE_URL = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api`;

// Get auth token
const getAuthToken = () => {
  const authData = localStorage.getItem('auth');
  return authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;
};

// Create axios instance with auth
const createAuthAxios = () => {
  const token = getAuthToken();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

export interface TimetableEntry {
  id: number;
  course_name: string;
  course_code: string;
  instructor_name: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface StudentTimetableResponse {
  success: boolean;
  student_id: string;
  student_name: string;
  department: string;
  semester: string;
  timetable: {
    monday: TimetableEntry[];
    tuesday: TimetableEntry[];
    wednesday: TimetableEntry[];
    thursday: TimetableEntry[];
    friday: TimetableEntry[];
    saturday: TimetableEntry[];
  };
}

export const studentTimetableService = {
  // Get student's timetable
  getStudentTimetable: async (studentId: string): Promise<StudentTimetableResponse> => {
    const api = createAuthAxios();
    const response = await api.get(`/students/${studentId}/timetable/`);
    return response.data;
  }
};

export default studentTimetableService;