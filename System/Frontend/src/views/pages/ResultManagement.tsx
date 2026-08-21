import React, { useState, useEffect, ReactElement } from 'react';
import { academicsService } from '../../api/academicsService';
import ReportCard from '../../components/ui/ReportCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface Result {
  id: number;
  student_id: string;
  result_id: number;
  student_name: string;
  subject: string;
  grade: string;
  marks: string;
  percentage: number;
  exam_type: string;
  exam_date: string;
  semester: string;
  department: string;
  course: any;
}

interface SearchableStudentSelectProps {
  students: string[];
  selectedStudent: string | null;
  onStudentSelect: (studentName: string | null) => void;
  disabled: boolean;
}

const SearchableStudentSelect: React.FC<SearchableStudentSelectProps> = ({
  students,
  selectedStudent,
  onStudentSelect,
  disabled
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredStudents, setFilteredStudents] = useState<string[]>(students);

  useEffect(() => {
    const filtered = students.filter(student =>
      student.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [students, searchTerm]);

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={selectedStudent || searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          disabled={disabled}
          placeholder={disabled ? 'No students available' : 'Search students by name...'}
          className="shadow appearance-none border rounded w-full py-2 px-3 pr-10 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center pr-3 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faFilter} className="text-gray-400" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
          {filteredStudents.length === 0 ? (
            <div className="px-3 py-2 text-gray-500">No students found</div>
          ) : (
            <>
              <div
                onClick={() => {
                  onStudentSelect(null);
                  setSearchTerm('');
                  setIsOpen(false);
                }}
                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
              >
                <span className="font-normal block truncate text-gray-500">Clear selection</span>
              </div>
              {filteredStudents.map((studentName) => (
                <div
                  key={studentName}
                  onClick={() => {
                    onStudentSelect(studentName);
                    setSearchTerm('');
                    setIsOpen(false);
                  }}
                  className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                    selectedStudent === studentName ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className={`font-normal block truncate ${selectedStudent === studentName ? 'font-semibold' : ''}`}>
                    {studentName}
                  </span>
                  {selectedStudent === studentName && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                      <FontAwesomeIcon icon={faCheckCircle} className="text-indigo-600" />
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
const ResultManagement: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [filteredResults, setFilteredResults] = useState<Result[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [showReportCard, setShowReportCard] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
  const [reportCardData, setReportCardData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Helper function to safely get department name
  const getDepartmentName = (departmentData: any): string => {
    if (!departmentData) return 'N/A';

    // If it's an object with a name property, extract the name
    if (typeof departmentData === 'object' && departmentData !== null && 'name' in departmentData) {
      return departmentData.name || 'N/A';
    }

    // If it's a string, return as is
    if (typeof departmentData === 'string') {
      return departmentData || 'N/A';
    }

    // Fallback - if it's an object but doesn't have name, return N/A
    if (typeof departmentData === 'object' && departmentData !== null) {
      return 'N/A';
    }

    // Fallback
    return 'N/A';
  };

  // Helper function to safely get course name
  const getCourseName = (courseData: any): string => {
    if (!courseData) return 'N/A';

    // If it's an object with a name property, extract the name
    if (typeof courseData === 'object' && courseData !== null && 'name' in courseData) {
      return courseData.name || 'N/A';
    }

    // If it's an object with course_name property, extract the course_name
    if (typeof courseData === 'object' && courseData !== null && 'course_name' in courseData) {
      return courseData.course_name || 'N/A';
    }

    // If it's a string, return as is
    if (typeof courseData === 'string') {
      return courseData || 'N/A';
    }

    // Fallback - if it's an object but doesn't have name or course_name, return N/A
    if (typeof courseData === 'object' && courseData !== null) {
      return 'N/A';
    }

    // Fallback
    return 'N/A';
  };

  useEffect(() => {
    // Fetch departments
    const fetchDepartments = async () => {
      try {
        const response = await academicsService.getDepartments();
        setDepartments(response.data);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    };

    fetchDepartments();
  }, []);

  useEffect(() => {
    // Fetch courses when department changes
    const fetchCourses = async () => {
      if (selectedDepartment) {
        try {
          const response = await academicsService.getCoursesByDepartment(selectedDepartment);
          setCourses(response.data);
        } catch (error) {
          console.error('Failed to fetch courses:', error);
        }
      } else {
        setCourses([]);
      }
    };

    fetchCourses();
  }, [selectedDepartment]);

  useEffect(() => {
    // Fetch results when department or course changes
    const fetchResults = async () => {
      if (selectedDepartment && selectedCourse) {
        setLoading(true);
        try {
          const response = await academicsService.getResultsByDepartmentCourse(selectedDepartment, selectedCourse);
          setResults(response.data);
          setFilteredResults(response.data);
        } catch (error) {
          console.error('Failed to fetch results:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setFilteredResults([]);
      }
    };

    fetchResults();
  }, [selectedDepartment, selectedCourse]);

  // Apply filters when search term or filters change
  useEffect(() => {
    let filtered = results;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Grade filter
    if (selectedGrade) {
      filtered = filtered.filter(result => result.grade === selectedGrade);
    }

    // Exam type filter
    if (selectedExamType) {
      filtered = filtered.filter(result => result.exam_type === selectedExamType);
    }

    setFilteredResults(filtered);
  }, [results, searchTerm, selectedGrade, selectedExamType]);

  // Calculate statistics
  const getStatistics = () => {
    const total = filteredResults.length;
    const gradeCounts = filteredResults.reduce((acc, result) => {
      acc[result.grade] = (acc[result.grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgPercentage = total > 0
      ? filteredResults.reduce((sum, result) => sum + result.percentage, 0) / total
      : 0;

    return { total, gradeCounts, avgPercentage };
  };

  const statistics = getStatistics();

  // Export functions
  const exportToCSV = () => {
    const headers = ['Student Name', 'Subject', 'Exam Type', 'Marks', 'Grade', 'Percentage', 'Exam Date', 'Semester', 'Department'];
    const csvContent = [
      headers.join(','),
      ...filteredResults.map(result => [
        result.student_name,
        result.subject,
        result.exam_type,
        result.marks,
        result.grade,
        result.percentage.toFixed(1),
        result.exam_date,
        result.semester,
        getDepartmentName(result.department)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportStudentReportToCSV = () => {
    // Group results by student_id to get unique students
    const studentMap = new Map<string, any>();

    filteredResults.forEach(result => {
      if (!studentMap.has(result.student_id)) {
        studentMap.set(result.student_id, {
          student_id: result.student_id,
          student_name: result.student_name,
          semester: result.semester,
          department: getDepartmentName(result.department)
        });
      }
    });

    const uniqueStudents = Array.from(studentMap.values());

    const headers = ['Student ID', 'Student Name', 'Semester', 'Department'];
    const csvContent = [
      headers.join(','),
      ...uniqueStudents.map(student => [
        student.student_id,
        student.student_name,
        student.semester,
        student.department
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Bulk operations
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResults(filteredResults.map(r => r.id));
    } else {
      setSelectedResults([]);
    }
  };

  const handleSelectResult = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedResults([...selectedResults, id]);
    } else {
      setSelectedResults(selectedResults.filter(r => r !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedResults.length} selected results?`)) return;

    try {
      setLoading(true);
      await Promise.all(selectedResults.map(id => academicsService.deleteResult(id)));
      // Refresh results
      if (selectedDepartment && selectedCourse) {
        const response = await academicsService.getResultsByDepartmentCourse(selectedDepartment, selectedCourse);
        setResults(response.data);
        setFilteredResults(response.data);
      }
      setSelectedResults([]);
    } catch (error) {
      console.error('Failed to delete results:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Advanced Result Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowReportCard(true)}
            disabled={filteredResults.length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Generate Report Card</span>
          </button>
          <button
            onClick={exportStudentReportToCSV}
            disabled={filteredResults.length === 0}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Generate Student Report</span>
          </button>
          <button
            onClick={exportToCSV}
            disabled={filteredResults.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
          {selectedResults.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Selected ({selectedResults.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Results</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Percentage</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.avgPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">F Grades</p>
              <p className="text-2xl font-bold text-red-600">{statistics.gradeCounts['F'] || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">A+ Grades</p>
              <p className="text-2xl font-bold text-green-600">{statistics.gradeCounts['A+'] || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Filters & Search</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select
              value={selectedDepartment ?? ''}
              onChange={(e) => setSelectedDepartment(e.target.value ? Number(e.target.value) : null)}
              className="w-full border p-2 rounded"
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Course</label>
            <select
              value={selectedCourse ?? ''}
              onChange={(e) => setSelectedCourse(e.target.value ? Number(e.target.value) : null)}
              className="w-full border p-2 rounded"
              disabled={!selectedDepartment}
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by student or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>

          {showFilters && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Grade</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  <option value="">All Grades</option>
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B">B</option>
                  <option value="B-">B-</option>
                  <option value="C+">C+</option>
                  <option value="C">C</option>
                  <option value="C-">C-</option>
                  <option value="D+">D+</option>
                  <option value="D">D</option>
                  <option value="F">F</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Exam Type</label>
                <select
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  <option value="">All Types</option>
                  <option value="Quiz 1">Quiz 1</option>
                  <option value="Quiz 2">Quiz 2</option>
                  <option value="Assignment 1">Assignment 1</option>
                  <option value="Assignment 2">Assignment 2</option>
                  <option value="Mid Term">Mid Term</option>
                  <option value="Final Exam">Final Exam</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Results ({filteredResults.length})
            </h3>
            {filteredResults.length > 0 && (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedResults.length === filteredResults.length && filteredResults.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Select All</span>
              </label>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedResults.length === filteredResults.length && filteredResults.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marks</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading results...
                    </div>
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    {selectedDepartment && selectedCourse ? 'No results found for the selected filters.' : 'Please select a department and course to view results.'}
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedResults.includes(result.id)}
                        onChange={(e) => handleSelectResult(result.id, e.target.checked)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{result.student_name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{result.subject}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {result.exam_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.marks}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        result.grade === 'F' ? 'bg-red-100 text-red-800' :
                        result.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                        result.grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.grade}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.percentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(result.exam_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={async () => {
                          if (window.confirm('Delete this result?')) {
                            try {
                              await academicsService.deleteResult(result.result_id);
                              // Refresh the data
                              if (selectedDepartment && selectedCourse) {
                                const response = await academicsService.getResultsByDepartmentCourse(selectedDepartment, selectedCourse);
                                setResults(response.data);
                              }
                            } catch (error) {
                              console.error('Failed to delete result:', error);
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-900 mr-3"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Card Modal */}
      {showReportCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Generate Student Report Card</h3>
                <button
                  onClick={() => {
                    setShowReportCard(false);
                    setSelectedStudentForReport(null);
                    setReportCardData(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {!selectedStudentForReport ? (
                <div>
                  <p className="text-gray-600 mb-4">Select a student to generate their report card:</p>
                  <div className="mb-4">
                    <SearchableStudentSelect
                      students={Array.from(new Set(filteredResults.map(r => r.student_name)))}
                      selectedStudent={null}
                      onStudentSelect={(studentName) => {
                        if (studentName) {
                          const studentResult = filteredResults.find(r => r.student_name === studentName);
                          setSelectedStudentForReport(studentResult);
                        }
                      }}
                      disabled={filteredResults.length === 0}
                    />
                  </div>
                  {filteredResults.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No students available. Please select a department and course first.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {loadingReport ? (
                    <div className="text-center py-8">
                      <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-gray-600">Generating report card...</p>
                    </div>
                  ) : reportCardData ? (
                    <ReportCard
                      student={reportCardData.student}
                      assignedCourses={reportCardData.assignedCourses}
                      results={reportCardData.results}
                      onClose={() => {
                        setShowReportCard(false);
                        setSelectedStudentForReport(null);
                        setReportCardData(null);
                      }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">Selected student: <strong>{selectedStudentForReport.student_name}</strong></p>
                      <button
                        onClick={async () => {
                          setLoadingReport(true);
                          try {
                            // Find student ID from results - this might need adjustment based on actual data structure
                            const studentResults = filteredResults.filter(r => r.student_name === selectedStudentForReport.student_name);
                            if (studentResults.length > 0) {
                              // Use student_id as string since it's the primary key
                              const studentId = studentResults[0].student_id;
                              const response = await academicsService.getStudentResults(studentId);
                              setReportCardData(response.data);
                            }
                          } catch (error) {
                            console.error('Failed to fetch student report data:', error);
                            alert('Failed to generate report card. Please try again.');
                          } finally {
                            setLoadingReport(false);
                          }
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                      >
                        Generate Report Card
                      </button>
                      <button
                        onClick={() => setSelectedStudentForReport(null)}
                        className="ml-4 text-gray-600 hover:text-gray-800"
                      >
                        Back to Student List
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultManagement;
