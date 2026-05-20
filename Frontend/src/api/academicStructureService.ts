import { api } from './api';

export interface Program {
  id: string;
  name: string;
  code: string;
  description?: string;
  total_semesters: number;
  created_at: string;
  semesters: Semester[];
}

export interface Semester {
  id: string;
  number: number;
  name: string;
  course_count?: number;
  courses?: Course[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  course_type: 'theory' | 'lab';
  credit_hours: number;
  semester_id: string;
  program_id: string;
  semester_number?: number;
  program_name?: string;
}

const academicStructureService = {
  // Programs
  getPrograms: () => api.get<Program[]>('programs/'),
  createProgram: (data: { name: string; code: string; description?: string; total_semesters: number }) => 
    api.post<Program>('programs/', data),
  getProgramDetail: (id: string) => api.get<Program>(`programs/${id}/`),

  // Courses
  getCourses: (program_id: string, semester_id?: string) => {
    let url = `courses/?program_id=${program_id}`;
    if (semester_id) url += `&semester_id=${semester_id}`;
    return api.get<Course[]>(url);
  },
  createCourse: (data: Omit<Course, 'id' | 'semester_number' | 'program_name'>) => 
    api.post<Course>('courses/add/', data),
  updateCourse: (id: string, data: Partial<Omit<Course, 'id' | 'program_id'>>) => 
    api.patch<Course>(`courses/${id}/edit/`, data),
  deleteCourse: (id: string) => api.delete<{ success: boolean }>(`courses/${id}/delete/`),
};

export default academicStructureService;
