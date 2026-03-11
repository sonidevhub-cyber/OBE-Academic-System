import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { studentService, courseService, departmentService } from '../../api/apiService';
import StudentModal from '../../components/ui/modals/StudentModal';
import EnhancedStudentProfile from '../../components/ui/EnhancedStudentProfile';

// Custom scrollbar styling
const scrollbarStyle = `
  .custom-scrollbar {
    overflow: auto;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  department_id?: number;
  departmentId?: number;
  num_semesters?: number;
}

interface Student {
  student_id: number;
  id?: number;
  name: string;
  email: string;
  phone: string;
  department?: Department | null;
  semester?: { semester_id: number; name: string; semester_code: string } | null;
  batch?: string;
  father_guardian: string;
  image?: string;
  attendance_percentage: number;
  gpa: number;
  performance_notes?: string;
}

interface StudentManagementProps {
  activeTab: string;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ activeTab }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showStudentProfile, setShowStudentProfile] = useState<boolean>(false);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await studentService.getAllStudents();
      setStudents(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (error: any) {
      console.error('Failed to fetch departments:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
      fetchDepartments();
    }
  }, [activeTab, fetchStudents, fetchDepartments]);

  const handleDeleteStudent = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await studentService.deleteStudent(id);
        setStudents(prev => prev.filter(student => student.student_id !== id));
      } catch (error: any) {
        setError(error.message || 'Failed to delete student');
      }
    }
  }, []);

  const filteredStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    
    let filtered = students;
    
    if (selectedDepartment) {
      filtered = filtered.filter(student => {
        const deptId = student.department?.id || student.department?.department_id;
        return deptId === selectedDepartment;
      });
    }
    
    if (selectedSemester) {
      filtered = filtered.filter(student => {
        if (!student.semester) return false;
        const semesterName = student.semester.name;
        return semesterName === `Semester ${selectedSemester}` || 
               semesterName === `${selectedSemester}` ||
               student.semester.semester_id === selectedSemester;
      });
    }
    
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.department?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.semester?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [students, searchTerm, selectedDepartment, selectedSemester]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyle }} />
      <div className="min-h-screen w-full bg-[#E8EFF8] p-4 md:p-6 custom-scrollbar">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 space-y-4 lg:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">Students</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={selectedDepartment || ''}
            onChange={(e) => setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          <select
            value={selectedSemester || ''}
            onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Semesters</option>
            {(() => {
              const maxSemesters = selectedDepartment 
                ? departments.find(d => d.id === selectedDepartment)?.num_semesters || 8
                : 8;
              return Array.from({length: maxSemesters}, (_, i) => i + 1).map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ));
            })()}
          </select>
          <button
            onClick={() => {
              setEditingStudent(null);
              setShowStudentModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 whitespace-nowrap"
          >
            Add Student
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Students</p>
              <p className="text-3xl font-bold text-blue-900">{students.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Departments</p>
              <p className="text-3xl font-bold text-green-900">{departments.length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">
                {selectedDepartment || selectedSemester ? (
                  <>
                    {selectedDepartment && departments.find(d => d.id === selectedDepartment)?.code}
                    {selectedDepartment && selectedSemester && ' - '}
                    {selectedSemester && `Sem ${selectedSemester}`}
                  </>
                ) : 'Filtered Results'}
              </p>
              <p className="text-3xl font-bold text-purple-900">{filteredStudents.length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-lg border border-amber-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-1">Average GPA</p>
              <p className="text-3xl font-bold text-amber-900">
                {students.length > 0 ? (students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length).toFixed(1) : '0.0'}
              </p>
            </div>
            <div className="p-3 bg-amber-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {filteredStudents.length} Students
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Semester</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Performance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {student.image ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={student.image} alt={student.name} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">{student.name.charAt(0)}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{student.name}</div>
                          <div className="text-sm text-gray-500 truncate">ID: {student.student_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="truncate">{student.department?.name || 'Not assigned'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="truncate">{student.semester?.name || 'Not assigned'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 truncate">{student.email}</div>
                      <div className="text-sm text-gray-500 truncate">{student.phone}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">GPA: {student.gpa?.toFixed(2) || 'N/A'}</div>
                      <div className="text-sm text-gray-500">Att: {student.attendance_percentage?.toFixed(1) || 'N/A'}%</div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setViewingStudent(student);
                            setShowStudentProfile(true);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors duration-200 border border-emerald-200"
                          title="View student profile"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-xs font-medium">Profile</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setShowStudentModal(true);
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors duration-200 border border-blue-200"
                          title="Edit student details"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-xs font-medium">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student.student_id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors duration-200 border border-red-200"
                          title="Remove student"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-xs font-medium">Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredStudents.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No students found</p>
          </div>
        )}
      </div>

      {showStudentModal && (
        <StudentModal
          isOpen={showStudentModal}
          studentId={editingStudent ? editingStudent.student_id : undefined}
          onClose={() => {
            setShowStudentModal(false);
            setEditingStudent(null);
          }}
          onSuccess={() => {
            fetchStudents();
          }}
        />
      )}

      {showStudentProfile && viewingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-y-auto">
            <EnhancedStudentProfile
              studentId={viewingStudent.student_id}
              onClose={() => {
                setShowStudentProfile(false);
                setViewingStudent(null);
              }}
            />
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default React.memo(StudentManagement);