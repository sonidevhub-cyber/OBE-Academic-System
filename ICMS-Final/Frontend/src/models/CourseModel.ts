import { Department, Semester } from './DepartmentModel';

export interface Course {
  id: number;
  name: string;
  code: string;
  credits: number;
  department: number | Department;
  semester: number | Semester;
}

export interface Instructor {
  id: number;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
  department: number | Department;
  employee_id: string;
  image?: string;
}
