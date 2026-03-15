import React, { useState, useEffect, useCallback } from 'react';
import { departmentService, courseService, semesterService } from '../../api/apiService';
import obeService from '../../api/obeService';
import DepartmentModal from '../../components/ui/modals/DepartmentModal';
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
  course_type?: string;
  parent_course?: number | null;
  parent_course_details?: {
    course_id: number;
    name: string;
    code: string;
    credits: number;
    course_type?: string;
  };
  semester_details?: {
    semester_id: number;
    name: string;
    semester_code: string;
    program: string;
    capacity: number;
    department: number; // This is just the department ID, not a nested object
  };
}

interface Semester {
  semester_id: number;
  id?: number;
  name: string;
  semester_code: string;
  capacity: number;
  department: number;
}

interface DepartmentManagementProps {
  activeTab: string;
}

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ activeTab }) => {
  const { currentUser, hasPermission } = useAuth();
  // Always show add department button for now - simplified for testing
  const canModifyDepartment = true;
  const canDefineCLO =
    currentUser?.rbac_role === 'SAC' ||
    currentUser?.rbac_role === 'JSC' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.is_superuser ||
    hasPermission('manage_clo');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDepartmentModal, setShowDepartmentModal] = useState<boolean>(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [showCourseModal, setShowCourseModal] = useState<boolean>(false);
  const [selectedSemesterForCourse, setSelectedSemesterForCourse] = useState<{departmentId: number, semesterNumber: number} | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'structure' | 'clo' | 'settings'>('structure');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [clos, setClos] = useState<any[]>([]);
  const [gaOptions, setGaOptions] = useState<any[]>([]);
  const [cloGaMappings, setCloGaMappings] = useState<any[]>([]);
  const [newMapping, setNewMapping] = useState<{ cloId: number; gaId: number; weightage: number }>({
    cloId: 0,
    gaId: 0,
    weightage: 1
  });
  const [showCloModal, setShowCloModal] = useState(false);
  const [editingClo, setEditingClo] = useState<any | null>(null);
  const [cloForm, setCloForm] = useState({ clo_number: 1, description: '', bloom_level: 'Remember' });
  const [cloGaSelections, setCloGaSelections] = useState<Array<{ gaId: number; weightage: number }>>([]);
  const [semesterEdits, setSemesterEdits] = useState<Record<number, number>>({});

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

  useEffect(() => {
    if (departments.length > 0 && selectedDepartmentId === null) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments, selectedDepartmentId]);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadSemesters(selectedDepartmentId);
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (selectedDepartmentId && semesters.length > 0 && selectedSemesterId === null) {
      const first = semesters.find((s) => s.department === selectedDepartmentId);
      setSelectedSemesterId(first?.semester_id ?? null);
    }
  }, [selectedDepartmentId, semesters, selectedSemesterId]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCLOs(selectedCourseId);
      loadCLOGAMappings(selectedCourseId);
    } else {
      setClos([]);
      setCloGaMappings([]);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    loadGraduateAttributes();
  }, []);

  const handleSubmit = async (formData: any) => {
    try {
      if (editingDepartment) {
        await departmentService.updateDepartment(editingDepartment.id, formData);
        if (selectedDepartmentId === editingDepartment.id) {
          loadSemesters(editingDepartment.id);
        }
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

  const getCourseDepartmentId = (course: Course) => {
    const dept = course.semester_details?.department;
    if (typeof dept === 'number') return dept;
    if (typeof (dept as any)?.department_id === 'number') return (dept as any).department_id;
    if (typeof (dept as any)?.id === 'number') return (dept as any).id;
    return null;
  };

  const getCourseSemesterId = (course: Course) => {
    const sem = course.semester_details;
    if (!sem) return null;
    if (typeof (sem as any)?.semester_id === 'number') return (sem as any).semester_id;
    if (typeof (sem as any)?.id === 'number') return (sem as any).id;
    return null;
  };

  const getCoursesForSemester = (semesterId: number, departmentId: number) => {
    return courses.filter((course) => {
      const courseSemesterId = getCourseSemesterId(course);
      const courseDeptId = getCourseDepartmentId(course);
      return courseSemesterId === semesterId && courseDeptId === departmentId;
    });
  };


  const handleAddCourse = (departmentId: number, semesterId: number) => {
    setSelectedSemesterForCourse({ departmentId, semesterNumber: semesterId });
    setShowCourseModal(true);
  };

  const handleCourseSubmit = async (courseData: any) => {
    try {
      if (editingCourse) {
        const response = await courseService.updateCourse(editingCourse.course_id, courseData);
        return response;
      } else {
        const response = await courseService.createCourse(courseData);
        return response;
      }
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

  const loadCLOs = async (courseId: number) => {
    try {
      const data = await obeService.getCourseOutcomes(courseId);
      setClos(Array.isArray(data) ? data : data?.results || []);
    } catch (error: any) {
      console.error('Error loading CLOs:', error);
      setError(error.message || 'Failed to load CLOs');
    }
  };

  const loadGraduateAttributes = async () => {
    try {
      const data = await obeService.getGraduateAttributes();
      setGaOptions(Array.isArray(data) ? data : data?.results || []);
    } catch (error: any) {
      console.error('Error loading graduate attributes:', error);
    }
  };

  const loadSemesters = async (departmentId: number) => {
    try {
      const response = await departmentService.getSemestersByDepartment(departmentId);
      const data = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const normalized = data.map((sem: any) => ({
        ...sem,
        semester_id: sem.semester_id ?? sem.id
      }));
      setSemesters(normalized);
      if (!selectedSemesterId) {
        setSelectedSemesterId(normalized[0]?.semester_id ?? null);
      }
    } catch (error: any) {
      console.error('Error loading semesters:', error);
    }
  };

  const loadCLOGAMappings = async (courseId: number) => {
    try {
      const data = await obeService.getCLOGAMappings(courseId);
      setCloGaMappings(Array.isArray(data) ? data : data?.results || []);
    } catch (error: any) {
      console.error('Error loading CLO-GA mappings:', error);
    }
  };

  const openCreateClo = () => {
    setEditingClo(null);
    setCloForm({ clo_number: 1, description: '', bloom_level: 'Remember' });
    setCloGaSelections([]);
    setShowCloModal(true);
  };

  const openEditClo = (clo: any) => {
    setEditingClo(clo);
    setCloForm({
      clo_number: clo.clo_number || 1,
      description: clo.description || '',
      bloom_level: clo.bloom_level || 'Remember'
    });
    const existingMappings = cloGaMappings.filter((m) => m.clo === clo.id);
    setCloGaSelections(
      existingMappings.map((m) => ({
        gaId: m.ga,
        weightage: m.weightage ?? 1
      }))
    );
    setShowCloModal(true);
  };

  const saveClo = async () => {
    if (!selectedCourseId) return;
    try {
      let cloId = editingClo?.id;
      if (editingClo) {
        const updated = await obeService.updateCLO(editingClo.id, {
          ...cloForm,
          course: selectedCourseId
        });
        cloId = updated?.id ?? cloId;
      } else {
        const created = await obeService.createCLO({
          ...cloForm,
          course: selectedCourseId
        });
        cloId = created?.id ?? cloId;
      }
      const mappings = cloGaSelections
        .filter((m) => m.gaId)
        .map((m) => ({
          clo: cloId,
          ga: m.gaId,
          weightage: m.weightage || 1
        }));
      if (cloId && mappings.length > 0) {
        await obeService.bulkCreateCLOGAMappings({ mappings });
        loadCLOGAMappings(selectedCourseId);
      }
      setShowCloModal(false);
      setEditingClo(null);
      loadCLOs(selectedCourseId);
    } catch (error: any) {
      setError(error.message || 'Failed to save CLO');
    }
  };

  const deleteClo = async (cloId: number) => {
    if (!window.confirm('Delete this CLO?')) return;
    try {
      await obeService.deleteCLO(cloId);
      if (selectedCourseId) {
        loadCLOs(selectedCourseId);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete CLO');
    }
  };

  const handleSemesterCapacityChange = (semesterId: number, value: number) => {
    setSemesterEdits((prev) => ({ ...prev, [semesterId]: value }));
  };

  const saveSemesterCapacity = async (semesterId: number) => {
    const capacity = semesterEdits[semesterId];
    if (capacity === undefined) return;
    try {
      await semesterService.updateSemester(semesterId, { capacity });
      if (selectedDepartmentId) {
        loadSemesters(selectedDepartmentId);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update semester capacity');
    }
  };

  const deleteSemester = async (semesterId: number) => {
    const hasCourses =
      selectedDepartmentId &&
      getCoursesForSemester(semesterId, selectedDepartmentId).length > 0;
    if (hasCourses) return;
    if (!window.confirm('Delete this semester?')) return;
    try {
      await semesterService.deleteSemester(semesterId);
      if (selectedDepartmentId) {
        loadSemesters(selectedDepartmentId);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete semester');
    }
  };

  const addCloGaMapping = async () => {
    if (!newMapping.cloId || !newMapping.gaId) return;
    try {
      await obeService.bulkCreateCLOGAMappings({
        mappings: [
          {
            clo: newMapping.cloId,
            ga: newMapping.gaId,
            weightage: newMapping.weightage || 1
          }
        ]
      });
      if (selectedCourseId) {
        loadCLOGAMappings(selectedCourseId);
      }
      setNewMapping({ cloId: 0, gaId: 0, weightage: 1 });
    } catch (error: any) {
      setError(error.message || 'Failed to add CLO-GA mapping');
    }
  };

  const deleteCloGaMapping = async (mappingId: number) => {
    if (!window.confirm('Delete this CLO-GA mapping?')) return;
    try {
      await obeService.deleteCLOGAMapping(mappingId);
      if (selectedCourseId) {
        loadCLOGAMappings(selectedCourseId);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete CLO-GA mapping');
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
          <h2 className="text-3xl font-bold mb-2">Academic Units</h2>
          <p className="text-indigo-100">Manage departments, semesters, courses, and outcomes</p>
        </div>
        {canModifyDepartment && (
          <button
            onClick={() => setShowDepartmentModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-all backdrop-blur-sm"
          >
            <span>Add Department</span>
          </button>
        )}
      </div>
      </div>

      {/* Sub Tabs */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center space-x-6 border-b border-gray-200">
          {[
            { id: 'structure', label: 'Structure' },
            { id: 'clo', label: 'CLO Management' },
            { id: 'settings', label: 'Settings' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as 'structure' | 'clo' | 'settings')}
              className={`py-2 px-1 border-b-2 text-sm font-semibold ${
                activeSubTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === 'structure' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {activeSubTab === 'structure' && loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading departments...</p>
          </div>
        </div>
      ) : activeSubTab === 'structure' ? (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Departments</h3>
              <div className="space-y-2">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => {
                      setSelectedDepartmentId(dept.id);
                      setSelectedSemesterId(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border ${
                      selectedDepartmentId === dept.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{dept.name}</div>
                    <div className="text-xs text-gray-500">{dept.code}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Semester Flow</h3>
                  <p className="text-sm text-gray-500">Select a semester to view courses</p>
                </div>
                {selectedDepartmentId && selectedSemesterId && (
                  <button
                    onClick={() => handleAddCourse(selectedDepartmentId, selectedSemesterId)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Add Course
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {selectedDepartmentId &&
                  semesters
                    .filter((s) => s.department === selectedDepartmentId)
                    .map((sem) => (
                    <button
                      key={sem.semester_id}
                      onClick={() => setSelectedSemesterId(sem.semester_id)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        selectedSemesterId === sem.semester_id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sem.name}
                    </button>
                  ))}
              </div>

              <div className="overflow-x-auto">
                {selectedDepartmentId && selectedSemesterId ? (
                  (() => {
                    const semesterCourses = getCoursesForSemester(selectedSemesterId, selectedDepartmentId);
                    const lectureCourses = semesterCourses.filter((course) => (course.course_type || 'LECTURE') === 'LECTURE');
                    const labCourses = semesterCourses.filter((course) => (course.course_type || 'LECTURE') === 'LAB');

                    const renderTable = (items: Course[], label: string) => (
                      <div className="mb-6 last:mb-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{label}</h4>
                          <span className="text-xs text-gray-500">{items.length} course{items.length === 1 ? '' : 's'}</span>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((course) => (
                              <tr key={course.course_id}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {course.name}
                                  {course.course_type === 'LAB' && course.parent_course_details && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      (Lab of {course.parent_course_details.code})
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{course.code}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{course.credits}</td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleEditCourse(course)}
                                      className="text-indigo-600 hover:text-indigo-800"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCourse(course.course_id)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {items.length === 0 && (
                          <div className="text-center text-sm text-gray-500 py-6">No courses in this category.</div>
                        )}
                      </div>
                    );

                    if (semesterCourses.length === 0) {
                      return <div className="text-center text-sm text-gray-500 py-6">No courses yet.</div>;
                    }

                    return (
                      <div className="space-y-8">
                        {renderTable(lectureCourses, 'Theory Courses')}
                        {renderTable(labCourses, 'Lab Courses')}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {activeSubTab === 'clo' && (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {!canDefineCLO && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              CLO management is restricted to SAC or authorized JSC users.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDepartmentId ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedDepartmentId(value);
                  setSelectedSemesterId(null);
                  setSelectedCourseId(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={selectedSemesterId ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedSemesterId(value);
                  setSelectedCourseId(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Semester</option>
                {selectedDepartmentId &&
                  semesters
                    .filter((s) => s.department === selectedDepartmentId)
                    .map((sem) => (
                      <option key={sem.semester_id} value={sem.semester_id}>
                        {sem.name}
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Course</option>
                {selectedDepartmentId && selectedSemesterId &&
                  getCoursesForSemester(selectedSemesterId, selectedDepartmentId).map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">CLOs</h3>
              <p className="text-sm text-gray-500">Create, update, or remove CLOs for the selected course.</p>
            </div>
            <button
              onClick={openCreateClo}
              disabled={!selectedCourseId || !canDefineCLO}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-300"
            >
              Add CLO
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CLO #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bloom Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clos.map((clo) => (
                  <tr key={clo.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">CLO {clo.clo_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{clo.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{clo.bloom_level}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => openEditClo(clo)}
                          className={`text-indigo-600 hover:text-indigo-800 ${!canDefineCLO ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteClo(clo.id)}
                          className={`text-red-600 hover:text-red-800 ${!canDefineCLO ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedCourseId && clos.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-6">No CLOs found for this course.</div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CLO-GA Mapping</h3>
                <p className="text-sm text-gray-500">Map CLOs to Graduate Attributes with weightage.</p>
              </div>
            </div>

            {!canDefineCLO && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 mb-4">
                CLO-GA mapping is restricted to SAC or authorized JSC users.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CLO</label>
                <select
                  value={newMapping.cloId}
                  onChange={(e) => setNewMapping({ ...newMapping, cloId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!canDefineCLO || !selectedCourseId}
                >
                  <option value={0}>Select CLO</option>
                  {clos.map((clo) => (
                    <option key={`clo-map-${clo.id}`} value={clo.id}>
                      CLO {clo.clo_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Graduate Attribute</label>
                <select
                  value={newMapping.gaId}
                  onChange={(e) => setNewMapping({ ...newMapping, gaId: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!canDefineCLO || !selectedCourseId}
                >
                  <option value={0}>Select GA</option>
                  {gaOptions.map((ga) => (
                    <option key={`ga-map-${ga.id}`} value={ga.id}>
                      {ga.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Weightage</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={newMapping.weightage}
                  onChange={(e) => setNewMapping({ ...newMapping, weightage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!canDefineCLO || !selectedCourseId}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addCloGaMapping}
                  disabled={!canDefineCLO || !selectedCourseId}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-300"
                >
                  Add Mapping
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CLO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GA</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weightage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cloGaMappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(() => {
                          const clo = clos.find((c) => c.id === mapping.clo);
                          return clo ? `CLO ${clo.clo_number}` : `CLO ${mapping.clo}`;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(() => {
                          const ga = gaOptions.find((g) => g.id === mapping.ga);
                          return ga ? `${ga.code} - ${ga.description}` : mapping.ga;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{mapping.weightage}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => deleteCloGaMapping(mapping.id)}
                          className={`text-red-600 hover:text-red-800 ${!canDefineCLO ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedCourseId && cloGaMappings.length === 0 && (
                <div className="text-center text-sm text-gray-500 py-6">No mappings yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Department Actions</h3>
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                    <div>
                      <div className="font-medium text-gray-800">{dept.name}</div>
                      <div className="text-xs text-gray-500">{dept.code}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditDepartment(dept)}
                        className="px-3 py-1.5 text-sm border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(dept.id)}
                        className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Semester Settings</h3>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select
                  value={selectedDepartmentId ?? ''}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSelectedDepartmentId(value);
                    setSelectedSemesterId(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {selectedDepartmentId &&
                  semesters
                    .filter((s) => s.department === selectedDepartmentId)
                    .map((sem) => {
                      const hasCourses =
                        !!selectedDepartmentId &&
                        getCoursesForSemester(sem.semester_id, selectedDepartmentId).length > 0;
                      return (
                        <div key={sem.semester_id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                          <div>
                            <div className="font-medium text-gray-800">{sem.name}</div>
                            <div className="text-xs text-gray-500">{sem.semester_code}</div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="number"
                              min="1"
                              value={semesterEdits[sem.semester_id] ?? sem.capacity}
                              onChange={(e) => handleSemesterCapacityChange(sem.semester_id, Number(e.target.value))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                            />
                            <button
                              onClick={() => saveSemesterCapacity(sem.semester_id)}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => deleteSemester(sem.semester_id)}
                              disabled={hasCourses}
                              className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>
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

      {showCourseModal && selectedSemesterForCourse && (
        <CourseModal
          isOpen={showCourseModal}
          onClose={() => {
            setShowCourseModal(false);
            setSelectedSemesterForCourse(null);
            fetchCourses();
            setEditingCourse(null);
          }}
          onSubmit={handleCourseSubmit}
          preSelectedDepartment={selectedSemesterForCourse?.departmentId}
          preSelectedSemester={selectedSemesterForCourse?.semesterNumber}
          canDefineCLO={canDefineCLO}
        />
      )}

      {showCloModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingClo ? 'Edit CLO' : 'Add CLO'}</h3>
              <button onClick={() => setShowCloModal(false)} className="text-gray-400 hover:text-gray-600">x</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CLO Number</label>
                <input
                  type="number"
                  min="1"
                  value={cloForm.clo_number}
                  onChange={(e) => setCloForm({ ...cloForm, clo_number: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bloom Level</label>
                <select
                  value={cloForm.bloom_level}
                  onChange={(e) => setCloForm({ ...cloForm, bloom_level: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Remember">Remember</option>
                  <option value="Understand">Understand</option>
                  <option value="Apply">Apply</option>
                  <option value="Analyze">Analyze</option>
                  <option value="Evaluate">Evaluate</option>
                  <option value="Create">Create</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={cloForm.description}
                  onChange={(e) => setCloForm({ ...cloForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Graduate Attributes</label>
                  <button
                    type="button"
                    onClick={() => setCloGaSelections((prev) => [...prev, { gaId: 0, weightage: 1 }])}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Add GA
                  </button>
                </div>
                <div className="space-y-3">
                  {cloGaSelections.map((sel, idx) => (
                    <div key={`ga-sel-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <select
                        value={sel.gaId}
                        onChange={(e) => {
                          const gaId = Number(e.target.value);
                          setCloGaSelections((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], gaId };
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value={0}>Select GA</option>
                        {gaOptions.map((ga) => (
                          <option key={`ga-opt-${ga.id}`} value={ga.id}>
                            {ga.code} - {ga.description}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={sel.weightage}
                        onChange={(e) => {
                          const weightage = Number(e.target.value);
                          setCloGaSelections((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], weightage };
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCloGaSelections((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-sm text-red-600 hover:text-red-800 justify-self-start"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {cloGaSelections.length === 0 && (
                    <div className="text-sm text-gray-500">No GA mappings added.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCloModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveClo}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(DepartmentManagement);
