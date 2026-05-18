import React, { useState, useEffect } from 'react';
import { departmentService, courseService } from '../../../api/apiService';
import { obeService } from '../../../api/obeService';
import { toast } from 'react-toastify';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (courseData: any) => Promise<any>;
  editingCourse?: any;
  preSelectedDepartment?: number;
  preSelectedSemester?: number;
  canDefineCLO?: boolean;
  programId?: number;
  batchId?: number;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Semester {
  id: number;
  name: string;
  semester_code: string;
  department: number;
}

interface CourseOption {
  course_id: number;
  name: string;
  code: string;
  course_type?: string;
}

interface CLOInput {
  clo_number: number;
  description: string;
  bloom_level: string;
}

interface GAOption {
  id: string;
  title?: string;
  code?: string;
  description?: string;
}


interface MappingInput {
  clo_number: number;
  ga_id: number;
  weightage: number;
}

const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingCourse,
  preSelectedDepartment,
  preSelectedSemester,
  canDefineCLO = false,
  programId,
  batchId
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'clos' | 'mapping'>('details');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    credits: 3,
    course_type: 'LECTURE',
    parent_course: '',
    department: preSelectedDepartment || '',
    semester: preSelectedSemester || ''
  });
  const [cloInputs, setCloInputs] = useState<CLOInput[]>([
    { clo_number: 1, description: '', bloom_level: 'Remember' }
  ]);
  const [gaOptions, setGaOptions] = useState<GAOption[]>([]);
  const [mappingInputs, setMappingInputs] = useState<MappingInput[]>([]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [parentCourseOptions, setParentCourseOptions] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      if (preSelectedDepartment) {
        fetchSemesters(preSelectedDepartment);
      }
      if (canDefineCLO && programId) {
        loadGraduateAttributes();
      }
    }
  }, [isOpen, preSelectedDepartment, programId, canDefineCLO]);

  useEffect(() => {
    if (editingCourse) {
      setFormData({
        name: editingCourse.name || '',
        code: editingCourse.code || '',
        description: editingCourse.description || '',
        credits: editingCourse.credits || 3,
        course_type: editingCourse.course_type || 'LECTURE',
        parent_course:
          editingCourse.parent_course ||
          editingCourse.parent_course_details?.course_id ||
          '',
        department: editingCourse.semester_details?.department?.department_id || '',
        semester: editingCourse.semester_details?.semester_id || ''
      });
      setActiveTab('details');
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        credits: 3,
        course_type: 'LECTURE',
        parent_course: '',
        department: preSelectedDepartment || '',
        semester: preSelectedSemester || ''
      });
      setCloInputs([{ clo_number: 1, description: '', bloom_level: 'Remember' }]);
      setMappingInputs([]);
      setActiveTab('details');
    }
  }, [editingCourse, preSelectedDepartment, preSelectedSemester]);

  useEffect(() => {
    if (isOpen && formData.semester) {
      fetchParentCourses(Number(formData.semester));
    }
  }, [isOpen, formData.semester]);

  const fetchDepartments = async () => {
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (error: any) {
      setError('Failed to fetch departments');
      console.error('Error fetching departments:', error);
    }
  };

  const fetchSemesters = async (departmentId: number) => {
    try {
      const response = await departmentService.getSemestersByDepartment(departmentId);
      setSemesters(response.data);
    } catch (error: any) {
      setError('Failed to fetch semesters');
      console.error('Error fetching semesters:', error);
    }
  };

  const fetchParentCourses = async (semesterId: number) => {
    try {
      const response = await courseService.getCoursesBySemester(semesterId);
      const courses = Array.isArray(response.data) ? response.data : response.data?.results || [];
      const filtered = courses
        .filter((course: any) => (course.course_type || 'LECTURE') === 'LECTURE')
        .filter((course: any) => !editingCourse || course.course_id !== editingCourse.course_id)
        .map((course: any) => ({
          course_id: course.course_id,
          name: course.name,
          code: course.code,
          course_type: course.course_type
        }));
      setParentCourseOptions(filtered);
    } catch (error: any) {
      console.error('Error fetching parent courses:', error);
      setParentCourseOptions([]);
    }
  };

  const loadGraduateAttributes = async () => {
    if (!programId) return;
    try {
      const response = await obeService.getGAs(programId.toString());
      setGaOptions(response.data.map(ga => ({ id: ga.id, title: ga.title })));
    } catch (error: any) {
      console.error('Error loading graduate attributes:', error);
      toast.error(error.response?.data?.detail || 'Failed to load GAs');
    }
  };

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

  const addMapping = () => {
    setMappingInputs((prev) => [
      ...prev,
      {
        clo_number: cloInputs[0]?.clo_number || 1,
        ga_id: Number(gaOptions[0]?.id || 0) as number,
        weightage: 1
      }
    ]);
  };

  const updateMapping = (index: number, field: keyof MappingInput, value: string | number) => {
    setMappingInputs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeMapping = (index: number) => {
    setMappingInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'department') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        semester: '' // Reset semester when department changes
      }));
      if (value) {
        fetchSemesters(Number(value));
      } else {
        setSemesters([]);
      }
      setParentCourseOptions([]);
    } else if (name === 'semester') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        parent_course: prev.course_type === 'LAB' ? '' : prev.parent_course
      }));
      if (value) {
        fetchParentCourses(Number(value));
      } else {
        setParentCourseOptions([]);
      }
    } else if (name === 'course_type') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        parent_course: value === 'LAB' ? prev.parent_course : ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (canDefineCLO && (!programId || !batchId)) {
      setError('Program and Batch must be selected to define CLOs.');
      setLoading(false);
      return;
    }

    try {
      const courseData = {
        ...formData,
        credits: Number(formData.credits),
        department: Number(formData.department),
        semester: Number(formData.semester),
        parent_course: formData.course_type === 'LAB' && formData.parent_course ? Number(formData.parent_course) : null
      };

      const response = await onSubmit(courseData);
      const courseId = response?.data?.course_id || response?.data?.id || response?.course_id || response?.id;

      if (courseId && !editingCourse && canDefineCLO && batchId) {
        const validCLOs = cloInputs.filter((clo) => clo.description.trim());
        if (validCLOs.length > 0) {
          const createdCLOResponses = await Promise.all(
            validCLOs.map((clo) =>
              obeService.createCLO(courseId.toString(), batchId.toString(), {
                description: clo.description,
                order_number: clo.clo_number
              })
            )
          );

          const cloIdByNumber = new Map<number, number>();
          createdCLOResponses.forEach((res: any) => {
            const cloData = res.data;
            if (cloData?.order_number && cloData?.id) {
              cloIdByNumber.set(cloData.order_number, cloData.id);
            }
          });

          const validMappings = mappingInputs
            .filter((m) => m.ga_id && cloIdByNumber.has(m.clo_number))
            .map((m) => ({
              clo_id: (cloIdByNumber.get(m.clo_number) as number).toString(),
              ga_id: Number(m.ga_id).toString(),
              weight: Number(m.weightage || 1)
            }));

          if (validMappings.length > 0) {
            await obeService.saveCLOGAMatrix(courseId.toString(), batchId.toString(), validMappings);
          }
        }
      }

      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save course';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingCourse ? 'Edit Course' : 'Add Course with CLOs'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-6">
              {[
                { id: 'details', label: 'Course Details' },
                { id: 'clos', label: 'Define CLOs' },
                { id: 'mapping', label: 'CLO-GA Mapping' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'details' | 'clos' | 'mapping')}
                  className={`py-2 px-1 border-b-2 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter course name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., CS101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Credits *
                  </label>
                  <input
                    type="number"
                    name="credits"
                    value={formData.credits}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Type *
                  </label>
                  <select
                    name="course_type"
                    value={formData.course_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="LECTURE">Lecture</option>
                    <option value="LAB">Lab</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester *
                  </label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.department}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {formData.department ? 'Select Semester' : 'Select Department First'}
                    </option>
                    {semesters.map((sem) => (
                      <option key={sem.id} value={sem.id}>
                        {sem.name} ({sem.semester_code})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.course_type === 'LAB' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent (Theory) Course *
                    </label>
                    <select
                      name="parent_course"
                      value={formData.parent_course}
                      onChange={handleInputChange}
                      required
                      disabled={!formData.semester}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {formData.semester ? 'Select Parent Course' : 'Select Semester First'}
                      </option>
                      {parentCourseOptions.map((course) => (
                        <option key={course.course_id} value={course.course_id}>
                          {course.code} - {course.name}
                        </option>
                      ))}
                    </select>
                    {formData.semester && parentCourseOptions.length === 0 && (
                      <p className="text-xs text-amber-700 mt-2">
                        No lecture courses found in this semester. Please add the theory course first.
                      </p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter course description (optional)"
                  />
                </div>
              </div>
            )}

            {activeTab === 'clos' && (
              <div className="space-y-4">
                {!canDefineCLO && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    CLO definition is restricted to SAC or authorized JSC users.
                  </div>
                )}
                {canDefineCLO && (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Define CLOs</h3>
                      <button
                        type="button"
                        onClick={addCLO}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Add CLO
                      </button>
                    </div>
                    <div className="space-y-3">
                      {cloInputs.map((clo, index) => (
                        <div key={`clo-${index}`} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-medium text-gray-800">CLO {clo.clo_number}</div>
                            {cloInputs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCLO(index)}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                CLO Number
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={clo.clo_number}
                                onChange={(e) => updateCLO(index, 'clo_number', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Bloom Level
                              </label>
                              <select
                                value={clo.bloom_level}
                                onChange={(e) => updateCLO(index, 'bloom_level', e.target.value)}
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
                          </div>
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              CLO Description
                            </label>
                            <textarea
                              value={clo.description}
                              onChange={(e) => updateCLO(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              rows={2}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'mapping' && (
              <div className="space-y-4">
                {!canDefineCLO && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    CLO-GA mapping is restricted to SAC or authorized JSC users.
                  </div>
                )}
                {canDefineCLO && (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">CLO-GA Mapping</h3>
                      <button
                        type="button"
                        onClick={addMapping}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Add Mapping
                      </button>
                    </div>

                    {gaOptions.length === 0 ? (
                      <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        No Graduate Attributes found. Please add GAs first.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {mappingInputs.map((mapping, index) => (
                          <div key={`mapping-${index}`} className="border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  CLO Number
                                </label>
                                <select
                                  value={mapping.clo_number}
                                  onChange={(e) => updateMapping(index, 'clo_number', Number(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  {cloInputs.map((clo) => (
                                    <option key={`clo-opt-${clo.clo_number}`} value={clo.clo_number}>
                                      CLO {clo.clo_number}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Graduate Attribute
                                </label>
                                <select
                                  value={mapping.ga_id}
                                  onChange={(e) => updateMapping(index, 'ga_id', Number(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  {gaOptions.map((ga) => (
                                    <option key={`ga-opt-${ga.id}`} value={ga.id}>
                                      {ga.code}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Weightage
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.1"
                                  value={mapping.weightage}
                                  onChange={(e) => updateMapping(index, 'weightage', Number(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeMapping(index)}
                                className="text-sm text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        {mappingInputs.length === 0 && (
                          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                            No mappings added yet.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{editingCourse ? 'Update Course' : 'Add Course'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseModal;