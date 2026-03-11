import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Department {
  id: number;
  name: string;
}

interface Semester {
  id: number;
  name: string;
}

interface Student {
  id: number;
  name: string;
  student_id: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

interface Result {
  id: number;
  subject: string;
  grade: string;
  gpa: number;
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  exam_date: string;
  exam_type: string;
}

interface ResultsModuleProps {
  token: string;
  onGenerateReport?: (studentId: number) => void;
}

const ResultsModule: React.FC<ResultsModuleProps> = ({ token, onGenerateReport }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/academics/departments/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async (departmentId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/academics/departments/${departmentId}/semesters/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSemesters(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch semesters:', error);
    }
  };

  const fetchStudents = async (departmentId: number, semesterId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/students/?department=${departmentId}&semester=${semesterId}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudents(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentResults = async (studentId: number) => {
    try {
      setResultsLoading(true);
      const response = await fetch(`http://localhost:8000/api/academics/students/${studentId}/results/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const results = Array.isArray(data.data) ? data.data : (data.results || []);
        setStudentResults(results);
      }
    } catch (error) {
      console.error('Failed to fetch student results:', error);
      setStudentResults([]);
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [token]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchSemesters(selectedDepartment);
      setSelectedSemester(null);
      setSelectedStudent(null);
      setStudentResults([]);
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment && selectedSemester) {
      fetchStudents(selectedDepartment, selectedSemester);
      setSelectedStudent(null);
      setStudentResults([]);
    }
  }, [selectedDepartment, selectedSemester]);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentResults(selectedStudent);
    }
  }, [selectedStudent]);

  const getStudentName = (student: Student): string => {
    if (student.user) {
      return `${student.user.first_name} ${student.user.last_name}`.trim();
    }
    return student.name || 'N/A';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Student Results Management</h2>

        {/* Selection Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Department
            </label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Choose a department...</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Semester
            </label>
            <select
              value={selectedSemester || ''}
              onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
              disabled={!selectedDepartment || !semesters.length}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedDepartment ? (semesters.length ? 'Choose a semester...' : 'No semesters available') : 'Select department first'}
              </option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Student
            </label>
            <select
              value={selectedStudent || ''}
              onChange={(e) => setSelectedStudent(Number(e.target.value) || null)}
              disabled={!selectedDepartment || !selectedSemester || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {loading ? 'Loading students...' : (selectedDepartment && selectedSemester) ? 'Choose a student...' : 'Select department and semester first'}
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {getStudentName(student)} ({student.student_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Display */}
        {selectedStudent && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Academic Results</h3>
              <button
                onClick={() => onGenerateReport?.(selectedStudent)}
                disabled={studentResults.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Generate Report Card</span>
              </button>
            </div>

            {resultsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading results...</p>
              </div>
            ) : studentResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GPA
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Marks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {studentResults.map((result, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            result.grade === 'A' || result.grade === 'A-' || result.grade === 'B+' || result.grade === 'B' 
                              ? 'bg-green-100 text-green-800' 
                              : result.grade === 'C' || result.grade === 'C-' || result.grade === 'D' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.grade || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.gpa || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.obtained_marks}/{result.total_marks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {result.percentage?.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-2">No results found for this student.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ResultsModule;