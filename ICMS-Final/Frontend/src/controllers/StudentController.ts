import { studentService } from '../api/apiService';

export class StudentController {
  static async getAllStudents() {
    try {
      const response = await studentService.getAll();
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch students' };
    }
  }

  static async createStudent(studentData: any) {
    try {
      const response = await studentService.create(studentData);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create student' };
    }
  }

  static async updateStudent(id: string | number, studentData: any) {
    try {
      const response = await studentService.update(id, studentData);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update student' };
    }
  }

  static async deleteStudent(id: string | number) {
    try {
      await studentService.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete student' };
    }
  }
}