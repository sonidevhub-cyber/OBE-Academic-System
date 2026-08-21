// ==================== DATA MODELS ====================

export interface Student {
  student_id: string;
  name: string;
  email: string;
  phone?: string;
  department?: Department;
  semester?: Semester;
  gpa?: number;
  attendance_percentage?: number;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  num_semesters?: number;
}

export interface Semester {
  id: number;
  name: string;
  semester_code: string;
  department?: Department;
}

export interface Course {
  course_id: number;
  name: string;
  code: string;
  credits: number;
  semester?: Semester;
  department?: Department;
}

export interface Instructor {
  id: number;
  name: string;
  email: string;
  department?: Department;
  courses?: Course[];
}

export interface HOD {
  id: number;
  name: string;
  email: string;
  department: Department;
}

export interface Timetable {
  id: number;
  course: string;
  instructor: string;
  room: string;
  day: string;
  start_time: string;
  end_time: string;
}

export interface Attendance {
  id: number;
  student: string;
  course: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

export interface Feedback {
  id: number;
  title: string;
  message: string;
  feedback_type: string;
  rating: number;
  created_at: string;
  is_reviewed: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  created_at: string;
  author?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Result {
  id: number;
  student: Student;
  course: Course;
  marks: number;
  grade: string;
  exam_date: string;
}