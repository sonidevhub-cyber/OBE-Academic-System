export interface SemesterRef {
  id: number;
  name: string;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  credits: number;
  department: number | string;
  semester: number | SemesterRef;
}

export interface Instructor {
  id: number;
  user: {
    first_name: string;
    last_name: string;
    email: string;
  };
  department: number | string;
  employee_id: string;
  image?: string;
}
