export interface Department {
  id: number;
  name: string;
  code?: string;
  num_semesters?: number;
}

export interface Semester {
  id: number;
  name: string;
  department: number | Department;
}
