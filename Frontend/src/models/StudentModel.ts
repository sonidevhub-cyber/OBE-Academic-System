export interface Student {
  id: string;
  student_id: string;
  name: string;
  roll_number: string;
  email: string;
  department: { name: string };
  semester: { name: string };
}

export class StudentModel {
  private students: Student[] = [];

  async fetchStudents(departmentId: number, semesterId: number): Promise<Student[]> {
    // API call to fetch students
    const response = await fetch(`/api/students?department=${departmentId}&semester=${semesterId}`);
    this.students = await response.json();
    return this.students;
  }

  getStudents(): Student[] {
    return this.students;
  }

  getStudentById(id: string): Student | undefined {
    return this.students.find(student => student.id === id);
  }
}
