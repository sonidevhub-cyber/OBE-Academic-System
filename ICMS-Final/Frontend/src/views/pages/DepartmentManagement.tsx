import React, { useState, useEffect, useCallback } from 'react';
import { departmentService, courseService, semesterService } from '../../api/apiService';
import DepartmentModal from '../../components/ui/modals/DepartmentModal';
import StudentModal from '../../components/ui/modals/StudentModal';
import CourseModal from '../../components/ui/modals/CourseModal';
import { useAuth } from '../../context/AuthContext';

interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  num_semesters: number;
}

interface Course {
  course_id: number;
  name: string;
  code: string;
  description: string;
  credits: number;
  semester_details?: {
    semester_id: number;
    name: string;
    semester_code: string;
    program: string;
    capacity: number;
    department: number; // This is just the department ID, not a nested object
  };
}

interface DepartmentManagementProps {
  activeTab: string;
}

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ activeTab }) => {
  const { currentUser } = useAuth();
  // Always show add department button for now - simplified for testing
  const canModifyDepartment = true;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState<boolean>(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [preSelectedDepartment, setPreSelectedDepartment] = useState<number | undefined>(undefined);
  const [preSelectedSemester, setPreSelectedSemester] = useState<number | undefined>(undefined);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set());
  const [showCourseModal, setShowCourseModal] = useState<boolean>(false);
  const [selectedSemesterForCourse, setSelectedSemesterForCourse] = useState<{departmentId: number, semesterNumber: number} | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDepartments, setSelectedDepartments] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false);
  const [generatingCourses, setGeneratingCourses] = useState<boolean>(false);
  const [semesterFilter, setSemesterFilter] = useState<number | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<number | 'all'>('all');

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch departments');
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await courseService.getAllCourses();
      setCourses(response.data);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'departments') {
      fetchDepartments();
      fetchCourses();
    }
  }, [activeTab, fetchDepartments, fetchCourses]);

  const handleSubmit = async (formData: any) => {
    try {
      if (editingDepartment) {
        await departmentService.updateDepartment(editingDepartment.id, formData);
      } else {
        await departmentService.createDepartment(formData);
      }
      setShowDepartmentModal(false);
      setEditingDepartment(null);
      fetchDepartments();
    } catch (error: any) {
      console.error('Error saving department:', error);
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save department';
      setError(backendError);
    }
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setShowDepartmentModal(true);
  };

  const handleDeleteDepartment = async (departmentId: number) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await departmentService.deleteDepartment(departmentId);
        fetchDepartments();
      } catch (error: any) {
        console.error('Error deleting department:', error);
        setError(error.message || 'Failed to delete department');
      }
    }
  };

  const getCoursesForSemester = (semesterNumber: number, departmentId: number) => {
    return courses.filter(course =>
      course.semester_details?.name === `Semester ${semesterNumber}` &&
      course.semester_details?.department === departmentId
    );
  };

  const handleAddStudent = (departmentId: number, semesterNumber: number) => {
    setPreSelectedDepartment(departmentId);
    setPreSelectedSemester(semesterNumber);
    setShowStudentModal(true);
  };

  const getDepartmentStats = (department: Department) => {
    const departmentCourses = courses.filter(course =>
      course.semester_details?.department === department.id
    );

    const totalCourses = departmentCourses.length;
    const totalCredits = departmentCourses.reduce((sum, course) => sum + course.credits, 0);
    const semesterCount = department.num_semesters;

    return {
      totalCourses,
      totalCredits,
      semesterCount
    };
  };

  const toggleDepartmentExpansion = (departmentId: number) => {
    setExpandedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const handleAddCourse = (departmentId: number, semesterNumber: number) => {
    setSelectedSemesterForCourse({ departmentId, semesterNumber });
    setShowCourseModal(true);
  };

  const handleCourseSubmit = async (courseData: any) => {
    try {
      if (editingCourse) {
        await courseService.updateCourse(editingCourse.course_id, courseData);
      } else {
        await courseService.createCourse(courseData);
      }
      fetchCourses(); // Refresh courses
      setShowCourseModal(false);
      setSelectedSemesterForCourse(null);
      setEditingCourse(null);
    } catch (error: any) {
      console.error('Error saving course:', error);
      throw error;
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowCourseModal(true);
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        console.log('Attempting to delete course with ID:', courseId);
        await courseService.deleteCourse(courseId);
        console.log('Course deleted successfully, refreshing courses...');
        await fetchCourses();
        console.log('Courses refreshed successfully');
      } catch (error: any) {
        console.error('Error deleting course:', error);
        console.error('Error details:', error.response?.data || error.message);
        setError(error.message || 'Failed to delete course');
      }
    }
  };

  const handleDeleteSemester = async (semesterId: number, semesterName: string) => {
    if (window.confirm(`Are you sure you want to delete ${semesterName}? This will also delete all courses in this semester.`)) {
      try {
        await semesterService.deleteSemester(semesterId);
        fetchDepartments(); // Refresh to get updated semester data
        fetchCourses(); // Refresh courses as they might be affected
      } catch (error: any) {
        console.error('Error deleting semester:', error);
        setError(error.message || 'Failed to delete semester');
      }
    }
  };

  const generateDummyCourses = async (departmentId: number, semesterNumber: number) => {
    setGeneratingCourses(true);
    try {
      // Get department info for course codes
      const department = departments.find(d => d.id === departmentId);
      if (!department) return;

      // Course templates based on department type
      const courseTemplates = {
        'CS': [
          { name: 'Programming Fundamentals', code: 'CS101', credits: 3, description: 'Introduction to programming concepts' },
          { name: 'Data Structures', code: 'CS201', credits: 3, description: 'Basic data structures and algorithms' },
          { name: 'Database Systems', code: 'CS301', credits: 3, description: 'Database design and management' },
          { name: 'Software Engineering', code: 'CS401', credits: 3, description: 'Software development methodologies' },
          { name: 'Computer Networks', code: 'CS501', credits: 3, description: 'Network protocols and architecture' }
        ],
        'EE': [
          { name: 'Circuit Analysis', code: 'EE101', credits: 3, description: 'Basic electrical circuits' },
          { name: 'Electronics', code: 'EE201', credits: 3, description: 'Electronic devices and circuits' },
          { name: 'Power Systems', code: 'EE301', credits: 3, description: 'Electrical power generation and distribution' },
          { name: 'Control Systems', code: 'EE401', credits: 3, description: 'Automatic control systems' },
          { name: 'Digital Signal Processing', code: 'EE501', credits: 3, description: 'Signal processing techniques' }
        ],
        'ME': [
          { name: 'Engineering Drawing', code: 'ME101', credits: 2, description: 'Technical drawing and CAD' },
          { name: 'Thermodynamics', code: 'ME201', credits: 3, description: 'Heat and energy systems' },
          { name: 'Fluid Mechanics', code: 'ME301', credits: 3, description: 'Fluid dynamics and applications' },
          { name: 'Machine Design', code: 'ME401', credits: 3, description: 'Mechanical design principles' },
          { name: 'Manufacturing Processes', code: 'ME501', credits: 3, description: 'Industrial manufacturing techniques' }
        ],
        'CE': [
          { name: 'Engineering Mechanics', code: 'CE101', credits: 3, description: 'Statics and dynamics' },
          { name: 'Structural Analysis', code: 'CE201', credits: 3, description: 'Analysis of structures' },
          { name: 'Concrete Technology', code: 'CE301', credits: 3, description: 'Concrete materials and design' },
          { name: 'Transportation Engineering', code: 'CE401', credits: 3, description: 'Highway and traffic engineering' },
          { name: 'Environmental Engineering', code: 'CE501', credits: 3, description: 'Environmental systems' }
        ],
        'BA': [
          { name: 'Business Mathematics', code: 'BA101', credits: 3, description: 'Mathematical concepts in business' },
          { name: 'Financial Accounting', code: 'BA201', credits: 3, description: 'Accounting principles' },
          { name: 'Marketing Management', code: 'BA301', credits: 3, description: 'Marketing strategies' },
          { name: 'Human Resource Management', code: 'BA401', credits: 3, description: 'HR practices and policies' },
          { name: 'Business Ethics', code: 'BA501', credits: 3, description: 'Ethical business practices' }
        ]
      };

      // Get courses for this department type or use default
      const templates = courseTemplates[department.code as keyof typeof courseTemplates] || [
        { name: 'Introduction to Subject', code: `${department.code}101`, credits: 3, description: 'Basic concepts' },
        { name: 'Advanced Topics', code: `${department.code}201`, credits: 3, description: 'Advanced concepts' },
        { name: 'Specialized Course', code: `${department.code}301`, credits: 3, description: 'Specialized topics' },
        { name: 'Research Methods', code: `${department.code}401`, credits: 3, description: 'Research methodology' },
        { name: 'Capstone Project', code: `${department.code}501`, credits: 3, description: 'Final project' }
      ];

      // Create courses for this semester
      for (const template of templates) {
        const courseData = {
          name: template.name,
          code: template.code,
          description: template.description,
          credits: template.credits,
          department: departmentId,
          semester: semesterNumber
        };

        await courseService.createCourse(courseData);
      }

      fetchCourses(); // Refresh courses
    } catch (error: any) {
      console.error('Error generating dummy courses:', error);
      setError(error.message || 'Failed to generate dummy courses');
    } finally {
      setGeneratingCourses(false);
    }
  };

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartmentFilter = departmentFilter === 'all' || dept.id === departmentFilter;
    return matchesSearch && matchesDepartmentFilter;
  });

  const getFilteredSemesters = (departmentId: number, totalSemesters: number) => {
    const allSemesters = Array.from({ length: totalSemesters }, (_, i) => i + 1);
    if (semesterFilter === 'all') {
      return allSemesters;
    }
    return allSemesters.filter(sem => sem === semesterFilter);
  };

  const clearFilters = () => {
    setSemesterFilter('all');
    setDepartmentFilter('all');
    setSearchTerm('');
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (semesterFilter !== 'all') count++;
    if (departmentFilter !== 'all') count++;
    if (searchTerm.trim()) count++;
    return count;
  };

  const handleSelectDepartment = (departmentId: number) => {
    setSelectedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const handleSelectAllDepartments = () => {
    if (selectedDepartments.size === departments.length) {
      setSelectedDepartments(new Set());
    } else {
      setSelectedDepartments(new Set(departments.map(d => d.id)));
    }
  };

  const handleBulkGenerateCourses = async () => {
    if (selectedDepartments.size === 0) return;

    setGeneratingCourses(true);
    try {
      for (const departmentId of Array.from(selectedDepartments)) {
        const department = departments.find(d => d.id === departmentId);
        if (!department) continue;

        for (let semesterNumber = 1; semesterNumber <= department.num_semesters; semesterNumber++) {
          await generateDummyCourses(departmentId, semesterNumber);
        }
      }
      setSelectedDepartments(new Set());
      setShowBulkActions(false);
    } catch (error: any) {
      console.error('Error in bulk course generation:', error);
      setError(error.message || 'Failed to generate courses');
    } finally {
      setGeneratingCourses(false);
    }
  };

  if (activeTab !== 'departments') {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Department Management</h2>
            <p className="text-indigo-100">Organize and manage academic departments, semesters, and courses</p>
          </div>
          {canModifyDepartment && (
            <button
              onClick={() => setShowDepartmentModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-all flex items-center space-x-2 backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Department Filter */}
            <div className="min-w-[200px]">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            {/* Semester Filter */}
            <div className="min-w-[180px]">
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Semesters</option>
                {Array.from({ length: 8 }, (_, i) => i + 1).map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center space-x-3">
            {getActiveFiltersCount() > 0 && (
              <>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {getActiveFiltersCount()} filter{getActiveFiltersCount() > 1 ? 's' : ''} active
                </span>
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Clear all</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {!loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9z" />
              </svg>
              <span className="text-blue-800 font-medium">
                Showing {filteredDepartments.length} of {departments.length} departments
                {semesterFilter !== 'all' && ` • Filtered to Semester ${semesterFilter}`}
                {departmentFilter !== 'all' && ` • ${departments.find(d => d.id === departmentFilter)?.name || 'Selected Department'}`}
              </span>
            </div>
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading departments...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Add Department Card */}
          {canModifyDepartment && (
            <div
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-all duration-200 cursor-pointer group"
              onClick={() => setShowDepartmentModal(true)}
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:from-indigo-200 group-hover:to-purple-200 transition-colors">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Add New Department</h3>
                <p className="text-gray-600">Create a new academic department</p>
              </div>
            </div>
          )}

          {departments.map((dept) => {
            const stats = getDepartmentStats(dept);
            const isExpanded = expandedDepartments.has(dept.id);

            return (
              <div key={dept.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                {/* Department Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{dept.name}</h3>
                          <p className="text-indigo-600 font-medium">{dept.code}</p>
                        </div>
                      </div>

                      {dept.description && (
                        <p className="text-gray-600 mb-4">{dept.description}</p>
                      )}

                      {/* Department Statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Total Courses</p>
                              <p className="text-xl font-bold text-gray-900">{stats.totalCourses}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Semesters</p>
                              <p className="text-xl font-bold text-gray-900">{stats.semesterCount}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Total Credits</p>
                              <p className="text-xl font-bold text-gray-900">{stats.totalCredits}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-6">
                      <button
                        onClick={() => toggleDepartmentExpansion(dept.id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                      </button>

                      {canModifyDepartment && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditDepartment(dept)}
                            className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="Edit Department"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteDepartment(dept.id)}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete Department"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Display semesters based on department's num_semesters and filters */}
                {isExpanded && (
                  <div className="space-y-4">
                    {getFilteredSemesters(dept.id, dept.num_semesters).map((semesterNumber) => {
                      const semesterCourses = getCoursesForSemester(semesterNumber, dept.id);
                      const totalCredits = semesterCourses.reduce((sum, course) => sum + course.credits, 0);

                      return (
                        <div key={semesterNumber} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm font-bold">{semesterNumber}</span>
                              </div>
                              <div>
                                <h5 className="font-semibold text-gray-900">Semester {semesterNumber}</h5>
                                <p className="text-sm text-gray-500">{semesterCourses.length} courses • {totalCredits} credits</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
<button
                                onClick={() => handleAddCourse(dept.id, semesterNumber)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Add Course</span>
                              </button>
                              {canModifyDepartment && (
                                <button
                                  onClick={() => handleDeleteSemester(semesterNumber, `Semester ${semesterNumber}`)}
                                  className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                  title="Delete Semester"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {semesterCourses.length > 0 ? (
                            <div className="space-y-2">
                              {semesterCourses.map((course) => (
                                <div key={course.course_id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{course.name}</p>
                                        <p className="text-sm text-gray-500">{course.code}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {course.credits} credits
                                    </span>
                                    {canModifyDepartment && (
                                      <button
                                        onClick={() => handleDeleteCourse(course.course_id)}
                                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                        title="Delete Course"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <p className="text-gray-500 text-sm">No courses added yet</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showDepartmentModal && (
        <DepartmentModal
          isOpen={showDepartmentModal}
          onClose={() => {
            setShowDepartmentModal(false);
            setEditingDepartment(null);
          }}
          onSubmit={handleSubmit}
          editingDepartment={editingDepartment}
        />
      )}

      {showStudentModal && (
        <StudentModal
          isOpen={showStudentModal}
          onClose={() => setShowStudentModal(false)}
          onSuccess={() => {
            setShowStudentModal(false);
            setPreSelectedDepartment(undefined);
            setPreSelectedSemester(undefined);
          }}
          preSelectedDepartment={preSelectedDepartment}
          preSelectedSemester={preSelectedSemester}
        />
      )}

      {showCourseModal && selectedSemesterForCourse && (
        <CourseModal
          isOpen={showCourseModal}
          onClose={() => {
            setShowCourseModal(false);
            setSelectedSemesterForCourse(null);
          }}
          onSubmit={handleCourseSubmit}
          preSelectedDepartment={selectedSemesterForCourse?.departmentId}
          preSelectedSemester={selectedSemesterForCourse?.semesterNumber}
        />
      )}
    </div>
  );
};

export default React.memo(DepartmentManagement);
