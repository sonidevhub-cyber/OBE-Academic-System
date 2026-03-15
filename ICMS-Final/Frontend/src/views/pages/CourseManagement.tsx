import React, { useState, useEffect, useCallback } from 'react';
import { courseService } from '../../api/apiService';
import obeService from '../../api/obeService';
import { useDepartment } from '../../context/DepartmentContext';

interface Course {
  course_id: number;
  name: string;
  code: string;
  description: string;
  semester_details?: {
    semester_id: number;
    name: string;
    semester_code: string;
    department: {
      id: number;
      name: string;
      code: string;
    };
  };
  credits: number;
}

interface Semester {
  semester_id: number;
  name: string;
  semester_code: string;
  department: {
    id: number;
    name: string;
    code: string;
  };
}

interface CourseFormData {
  name: string;
  code: string;
  description: string;
  department: string;
  semester: string;
  credits: number;
}

interface CLOInput {
  clo_number: number;
  description: string;
  bloom_level: string;
}

interface CourseManagementProps {
  activeTab: string;
}

const CourseManagement: React.FC<CourseManagementProps> = ({ activeTab }): React.JSX.Element => {
  const { departments, loading: departmentsLoading, error: departmentsError } = useDepartment();
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [formData, setFormData] = useState<CourseFormData>({
    name: '',
    code: '',
    description: '',
    department: '',
    semester: '',
    credits: 3,
  });
  const [cloInputs, setCloInputs] = useState<CLOInput[]>([
    { clo_number: 1, description: '', bloom_level: 'Remember' }
  ]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      // The courseService does not have getCoursesBySemester, so fallback to getAllCourses and filter client-side
      response = await courseService.getAllCourses();
      let coursesData = response.data;
      if (selectedSemester) {
        coursesData = coursesData.filter((course: Course) => course.semester_details?.semester_id === parseInt(selectedSemester));
      }
      setCourses(coursesData);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch courses');
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  const fetchSemesters = useCallback(async (): Promise<void> => {
    if (selectedDepartment) {
      try {
        const response = await fetch(`/api/departments/${selectedDepartment}/semesters`);
        let semestersData = await response.json();

        // For EE and Business departments, show only first 2 semesters
        const selectedDept = departments.find(dept => dept.department_id.toString() === selectedDepartment);
        if (selectedDept && (selectedDept.code.toLowerCase() === 'ee' || selectedDept.code.toLowerCase() === 'business')) {
          semestersData = semestersData.slice(0, 2);
        }

        setSemesters(semestersData);
      } catch (error: any) {
        console.error('Failed to fetch semesters:', error);
      }
    } else {
      setSemesters([]);
    }
  }, [selectedDepartment, departments]);

  // Create semester options 1-8 for display
  const semesterOptions = Array.from({ length: 8 }, (_, i) => ({
    value: (i + 1).toString(),
    label: `Semester ${i + 1}`
  }));

  useEffect(() => {
    if (activeTab === 'courses') {
      fetchCourses();
    }
  }, [activeTab, fetchCourses]);

  useEffect(() => {
    fetchSemesters();
  }, [selectedDepartment, departments]);


  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const courseData = {
        ...formData,
        department_id: parseInt(formData.department),
        semester: parseInt(formData.semester)
      };

      if (editingCourse) {
        await courseService.updateCourse(editingCourse.course_id, courseData);
      } else {
        const validCLOs = cloInputs.filter((clo) => clo.description.trim());
        if (validCLOs.length === 0) {
          setError('Please add at least one CLO description.');
          return;
        }

        const createdCourse = await courseService.createCourse(courseData);
        const courseId = createdCourse?.data?.course_id ?? createdCourse?.data?.id;

        if (courseId) {
          await Promise.all(
            validCLOs.map((clo) =>
              obeService.createCLO({
                course: courseId,
                clo_number: clo.clo_number,
                description: clo.description,
                bloom_level: clo.bloom_level
              })
            )
          );
        }
      }
      fetchCourses();
      setShowModal(false);
      setEditingCourse(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      department: '',
      semester: '',
      credits: 3,
    });
    setCloInputs([{ clo_number: 1, description: '', bloom_level: 'Remember' }]);
    } catch (error: any) {
      setError(error.message || 'Failed to save course');
      console.error('Failed to save course:', error);
    }
  }, [editingCourse, formData, fetchCourses]);

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await courseService.deleteCourse(id);
        setCourses(prev => prev.filter(course => course.course_id !== id));
      } catch (error: any) {
        setError(error.message || 'Failed to delete course');
        console.error('Failed to delete course:', error);
      }
    }
  }, []);

  const handleEdit = useCallback((course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description,
      department: course.semester_details?.department?.id.toString() || '',
      semester: course.semester_details?.semester_id.toString() || '',
      credits: course.credits,
    });
    setCloInputs([{ clo_number: 1, description: '', bloom_level: 'Remember' }]);
    setShowModal(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingCourse(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      department: '',
      semester: '',
      credits: 3,
    });
    setCloInputs([{ clo_number: 1, description: '', bloom_level: 'Remember' }]);
    setShowModal(true);
  }, []);

  const addCLO = () => {
    setCloInputs((prev) => [
      ...prev,
      { clo_number: prev.length + 1, description: '', bloom_level: 'Remember' }
    ]);
  };

  const updateCLO = (index: number, field: keyof CLOInput, value: string | number) => {
    setCloInputs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeCLO = (index: number) => {
    setCloInputs((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6" role="main" aria-labelledby="course-management-heading">
      <div className="mb-6">
        <h2 id="course-management-heading" className="text-2xl font-bold mb-2 text-gray-800">
          Course Management
        </h2>
        <p className="text-gray-600">Manage university courses and their details.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Courses</h3>
          <button
            onClick={handleAdd}
            className="bg-indigo-600 hover:bg-indigo-700 focus:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Add new course"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Course
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32" role="status" aria-live="polite">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="sr-only">Loading courses...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" role="table">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Semester
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {courses.map((course, index) => (
                  <tr key={course.course_id} className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-gray-50/30' : 'bg-white'}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {course.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {course.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.semester_details?.department?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.semester_details?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {course.credits}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(course)}
                          className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 focus:text-indigo-900 focus:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-lg"
                          aria-label={`Edit course ${course.name}`}
                          title="Edit Course"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(course.course_id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 focus:text-red-900 focus:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg"
                          aria-label={`Delete course ${course.name}`}
                          title="Delete Course"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {courses.length === 0 && !loading && (
          <div className="text-center py-12" role="status">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No courses found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new course.
            </p>
          </div>
        )}
      </div>

      {/* Course Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">
                    {editingCourse ? 'Edit Course' : 'Create Course + Define CLOs'}
                  </h3>
                  <p className="text-sm text-slate-200">
                    {editingCourse ? 'Update course details' : 'Set up course details and CLOs in one flow'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-200 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
                  <h4 className="text-sm uppercase tracking-wide text-slate-500 font-semibold mb-4">
                    Course Details
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Course Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Course Code
                        </label>
                        <input
                          type="text"
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Credits
                        </label>
                        <input
                          type="number"
                          value={formData.credits}
                          onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                          min="1"
                          max="6"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Department
                        </label>
                        <select
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.department_id} value={dept.department_id.toString()}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Semester
                        </label>
                        <select
                          value={formData.semester}
                          onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                          required
                        >
                          <option value="">Select Semester</option>
                          {semesters.map((sem) => (
                            <option key={sem.semester_id} value={sem.semester_id.toString()}>
                              {sem.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm uppercase tracking-wide text-slate-500 font-semibold">
                        CLOs (Course Learning Outcomes)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Add CLOs now so reporting works immediately.
                      </p>
                    </div>
                    {!editingCourse && (
                      <button
                        type="button"
                        onClick={addCLO}
                        className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        Add CLO
                      </button>
                    )}
                  </div>

                  {editingCourse ? (
                    <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 border border-slate-100">
                      CLOs can be managed from the OBE module for existing courses.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cloInputs.map((clo, index) => (
                        <div key={`clo-${index}`} className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-semibold text-slate-700">
                              CLO {clo.clo_number}
                            </div>
                            {cloInputs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCLO(index)}
                                className="text-xs text-rose-600 hover:text-rose-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                CLO Number
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={clo.clo_number}
                                onChange={(e) => updateCLO(index, 'clo_number', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                                required
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Bloom Level
                              </label>
                              <select
                                value={clo.bloom_level}
                                onChange={(e) => updateCLO(index, 'bloom_level', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                              >
                                <option value="Remember">Remember</option>
                                <option value="Understand">Understand</option>
                                <option value="Apply">Apply</option>
                                <option value="Analyze">Analyze</option>
                                <option value="Evaluate">Evaluate</option>
                                <option value="Create">Create</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              CLO Description
                            </label>
                            <textarea
                              value={clo.description}
                              onChange={(e) => updateCLO(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-800 focus:border-slate-800 bg-white"
                              rows={2}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500">
                  {editingCourse ? 'Course update only.' : 'CLOs will be created with this course.'}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {editingCourse ? 'Update Course' : 'Create Course'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseManagement;
