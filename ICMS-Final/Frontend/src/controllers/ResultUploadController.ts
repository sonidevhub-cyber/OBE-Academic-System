import { useState, useEffect } from 'react';
import { StudentModel, Student } from '../models/StudentModel';
import { ResultModel, Result } from '../models/ResultModel';
import { academicsService } from '../api/academicsService_enhanced';
import { instructorAttendanceService, Department, Semester } from '../api/instructorAttendanceService';

export const useResultUploadController = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [assignedCourses, setAssignedCourses] = useState<{course_id: number; name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    exam_type: 'Mid Term',
    exam_date: new Date().toISOString().split('T')[0],
    total_marks: 25,
    obtained_marks: 0,
    grade: ''
  });

  const studentModel = new StudentModel();
  const resultModel = new ResultModel();

  const getDefaultTotalMarks = (examType: string): number => {
    const examTypeLower = examType.toLowerCase();
    if (examTypeLower.includes('assignment')) return 5;
    if (examTypeLower.includes('mid')) return 25;
    if (examTypeLower.includes('final')) return 60;
    return 25;
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      const deptId = parseInt(selectedDepartment);
      if (!isNaN(deptId)) {
        fetchSemesters(deptId);
      }
      setSelectedSemester(null);
      setStudents([]);
      setSelectedStudent(null);
      setResults([]);
      setAssignedCourses([]);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment && selectedSemester) {
      const deptId = parseInt(selectedDepartment);
      if (!isNaN(deptId)) {
        fetchStudents(deptId, selectedSemester);
      }
    }
  }, [selectedDepartment, selectedSemester]);

  useEffect(() => {
    const defaultTotal = getDefaultTotalMarks(formData.exam_type);
    setFormData(prev => ({ ...prev, total_marks: defaultTotal }));
  }, [formData.exam_type]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getDepartments();
      setDepartments(response);
    } catch (err: any) {
      setError('Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async (departmentId: number) => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getSemestersByDepartment(departmentId);
      setSemesters(response);
    } catch (err: any) {
      setError('Failed to fetch semesters');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (departmentId: number, semesterId: number) => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getStudentsByDepartmentAndSemester(departmentId, semesterId);
      const transformedStudents: Student[] = response.map((student: any) => ({
        id: student.student_id,
        student_id: student.student_id,
        name: student.name,
        roll_number: student.student_id,
        email: student.email,
        department: { name: departments.find(d => d.id === departmentId)?.name || 'Unknown' },
        semester: { name: semesters.find(s => s.id === semesterId)?.name || 'Unknown' }
      }));
      setStudents(transformedStudents);
    } catch (err: any) {
      setError('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async (studentId: string) => {
    if (!studentId) return;
    try {
      setLoading(true);
      const data = await resultModel.fetchResults(studentId);
      setResults(data.results);
      setAssignedCourses(data.assigned_courses);
    } catch (err: any) {
      setError('Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    fetchResults(student.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedDepartment || !selectedSemester) return;

    const selectedCourse = assignedCourses.find(course => course.name === formData.subject);
    const courseId = selectedCourse ? selectedCourse.course_id : null;

    const dataToSubmit = {
      course_id: courseId,
      exam_type: formData.exam_type,
      exam_date: formData.exam_date,
      obtained_marks_input: formData.obtained_marks
    };

    try {
      setLoading(true);
      await resultModel.createResult(selectedStudent.id, dataToSubmit);
      setShowForm(false);
      setFormData({
        subject: '',
        exam_type: 'Mid Term',
        exam_date: new Date().toISOString().split('T')[0],
        total_marks: 25,
        obtained_marks: 0,
        grade: ''
      });
      setSuccess('Result added successfully');
    } catch (err: any) {
      setError('Failed to create result record');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (resultId: number) => {
    if (!window.confirm('Are you sure you want to delete this result record?')) return;

    try {
      setLoading(true);
      await resultModel.deleteResult(resultId);
      if (selectedStudent) {
        fetchResults(selectedStudent.id);
      }
      setSuccess('Result deleted successfully');
    } catch (err: any) {
      setError('Failed to delete result record');
    } finally {
      setLoading(false);
    }
  };

  const calculateGrade = (obtained: number, total: number): string => {
    return resultModel.calculateGrade(obtained, total);
  };

  return {
    departments,
    semesters,
    students,
    selectedDepartment,
    setSelectedDepartment,
    selectedSemester,
    setSelectedSemester,
    selectedStudent,
    results,
    assignedCourses,
    loading,
    error,
    success,
    showForm,
    setShowForm,
    formData,
    setFormData,
    handleStudentSelect,
    handleSubmit,
    handleDelete,
    calculateGrade,
    getDefaultTotalMarks
  };
};
