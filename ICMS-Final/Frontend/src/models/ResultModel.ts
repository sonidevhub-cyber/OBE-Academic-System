import { academicsService } from '../api/academicsService_enhanced';

export interface Result {
  result_id: number;
  subject: string;
  exam_type: string;
  exam_date: string;
  total_marks: number;
  obtained_marks: number;
  grade: string;
}

export class ResultModel {
  private results: Result[] = [];
  private assignedCourses: { course_id: number; name: string }[] = [];

  async fetchResults(studentId: string): Promise<{ results: Result[]; assigned_courses: { course_id: number; name: string }[] }> {
    const response = await academicsService.getStudentResults(studentId);
    this.results = response.data.results || [];
    this.assignedCourses = response.data.assigned_courses || [];
    return { results: this.results, assigned_courses: this.assignedCourses };
  }

  async createResult(studentId: string, data: any): Promise<void> {
    await academicsService.createStudentResult(studentId, data);
    // Refetch results after creation
    await this.fetchResults(studentId);
  }

  async deleteResult(resultId: number): Promise<void> {
    await academicsService.deleteResult(resultId);
  }

  getResults(): Result[] {
    return this.results;
  }

  getAssignedCourses(): { course_id: number; name: string }[] {
    return this.assignedCourses;
  }

  calculateGrade(obtained: number, total: number): string {
    const percentage = (obtained / total) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D+';
    if (percentage >= 40) return 'D';
    return 'F';
  }
}
