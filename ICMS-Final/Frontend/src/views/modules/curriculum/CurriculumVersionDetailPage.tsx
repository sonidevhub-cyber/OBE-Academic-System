import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { curriculumService, CurriculumVersion, CurriculumCourse } from '../../../api/curriculumService';
import { coordinatorService } from '../../../api/coordinatorService';
import VersionStatusBadge from '../../../components/obe/VersionStatusBadge';
import { ChevronLeft, Plus, CheckCircle, Copy, Book, Users, History, Save, Info, RefreshCw, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CurriculumVersionDetailPageProps {
  id?: string;
  onClose?: () => void;
  onVersionCreated?: (id: number) => void;
}

type ActiveTab = 'courses' | 'allocations' | 'history';

const CurriculumVersionDetailPage: React.FC<CurriculumVersionDetailPageProps> = ({ id: propId, onClose, onVersionCreated }) => {
  const { isSAC } = useAuth();
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;

  const navigate = useNavigate();
  const location = useLocation();

  const [version, setVersion] = useState<CurriculumVersion | null>(null);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');

  // Create/Add Course state
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState<{ course: string; semester_no: number }>({
    course: '',
    semester_no: 1,
  });
  const [addCourseMode, setAddCourseMode] = useState<'existing' | 'new'>('existing'); // 'existing' or 'new'
  const [newCourseData, setNewCourseData] = useState({
    name: '',
    code: '',
    credit_hours: 3,
    course_type: 'LECTURE',
    parent_course_id: '',
  });

  // Create Version state
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    program: '',
    batch: '',
    cloned_from: '',
  });

  // Allocations state
  const [instructors, setInstructors] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const { idForRequests, isNew, isInvalidId } = useMemo(() => {
    if (!id) return { idForRequests: NaN, isNew: false, isInvalidId: true };
    if (id === 'new') return { idForRequests: NaN, isNew: true, isInvalidId: false };
    const n = Number(id);
    return { idForRequests: n, isNew: false, isInvalidId: Number.isNaN(n) };
  }, [id]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tab = queryParams.get('tab');
    if (tab === 'allocations' || tab === 'courses' || tab === 'history') setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    if (isNew) {
      fetchInitialData();
      return;
    }

    if (!id || isInvalidId) {
      setLoading(false);
      return;
    }

    fetchVersion();
    loadInstructors();
    loadAllCourses();
  }, [idForRequests, isNew, isInvalidId]);

  const handleBack = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  const loadAllCourses = async () => {
    try {
      const res = await curriculumService.getAllCourses();
      const data = res.data?.data || res.data || [];
      setAllCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading all courses:', err);
    }
  };

  const loadInstructors = async () => {
    try {
      const res = await coordinatorService.getInstructors();
      const data = res.data?.data || res.data || [];
      setInstructors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading instructors:', err);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [programsRes, batchesRes, instructorsRes] = await Promise.all([
        coordinatorService.getPrograms(),
        coordinatorService.getBatches(),
        coordinatorService.getInstructors(),
      ]);

      const programsData = programsRes.data?.data || programsRes.data || [];
      const batchesData = batchesRes.data?.data || batchesRes.data || [];
      const instructorsData = instructorsRes.data?.data || instructorsRes.data || [];

      setPrograms(Array.isArray(programsData) ? programsData : []);
      setBatches(Array.isArray(batchesData) ? batchesData : []);
      setInstructors(Array.isArray(instructorsData) ? instructorsData : []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load programs or batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersion = async () => {
    try {
      setLoading(true);

      const versionId = idForRequests;
      if (Number.isNaN(versionId)) {
        setLoading(false);
        return;
      }

      const response = await curriculumService.getVersion(versionId);
      const data = response.data?.data || response.data;
      setVersion(data);

      // Pre-fill allocations from version courses
      if (data?.courses_by_semester) {
        const initial: Record<string, string> = {};
      Object.values(data.courses_by_semester).forEach((semesterCourses: any) => {
          (semesterCourses as any[]).forEach((vc: any) => {
            if (vc?.course && vc?.allocation?.teacher_id) {
              initial[String(vc.course)] = String(vc.allocation.teacher_id);
            }
          });
        });
        setAllocations(initial);
      } else {
        setAllocations({});
      }
    } catch (error) {
      console.error('Error fetching version detail:', error);
      toast.error('Failed to load version details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.program || !formData.batch) {
      toast.error('Please select program and batch');
      return;
    }

    try {
      setSubmitting(true);
      const response = await curriculumService.createCurriculumVersion(formData);
      const newVersion = response.data?.data || response.data;
      toast.success('Curriculum version created!');
      navigate(`/curriculum-versions/${newVersion.id}`);
    } catch (error: any) {
      console.error('Error creating version:', error);
      toast.error(error.response?.data?.message || 'Failed to create version');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClone = async (targetBatchId: string) => {
    if (!version || !targetBatchId) {
      toast.error('Please select a target batch');
      return;
    }

    try {
      setSubmitting(true);
      const res = await curriculumService.cloneVersion(version.id, targetBatchId);
      const newVersion = res.data?.data || res.data;
      toast.success('Curriculum cloned successfully!');
      navigate(`/curriculum-versions/${newVersion.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Clone failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncCourses = async () => {
    if (!version) return;
    try {
      setSyncing(true);
      await curriculumService.syncVersionCourses(version.id);
      toast.success('Courses synced from program!');
      fetchVersion();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleFinalize = async () => {
    if (!version) return;
    try {
      setSubmitting(true);
      await curriculumService.finalizeVersion(version.id);
      toast.success('Curriculum version finalized!');
      fetchVersion();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Finalization failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAllocations = async () => {
    if (!version) return;

    const allocationList = Object.entries(allocations)
      .filter(([_, teacherId]) => teacherId && teacherId !== '')
      .map(([courseId, teacherId]) => ({
        course: courseId,
        teacher: teacherId,
      }));

    if (allocationList.length === 0) {
      toast.error('Please select at least one instructor to allocate');
      return;
    }

    try {
      setSubmitting(true);
      await coordinatorService.bulkAllocate({
        curriculum_version: version.id,
        allocations: allocationList,
      });
      toast.success('Allocations saved successfully');
      fetchVersion();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to save allocations';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCourse = async () => {
    if (!version) return;

    try {
      setSubmitting(true);
      let courseIdToAdd: string | number;

      if (addCourseMode === 'existing') {
        if (!newCourse.course || newCourse.course === 'null' || newCourse.course === 'undefined') {
          toast.error('Please select a valid course.');
          return;
        }
        courseIdToAdd = newCourse.course;
      } else {
        // Create New Course
        if (!newCourseData.name || !newCourseData.code || !newCourseData.credit_hours) {
          toast.error('Please fill all fields for the new course.');
          return;
        }

        if (!version?.program) {
          toast.error('Program information missing from version');
          return;
        }

        const createCourseResponse = await curriculumService.createCourse({
          name: newCourseData.name,
          code: newCourseData.code,
          credit_hours: newCourseData.credit_hours,
          course_type: newCourseData.course_type,
          program_id: version.program,
          semester_no: newCourse.semester_no,
          parent_course: newCourseData.parent_course_id || undefined,
        });
        const createdCourse = createCourseResponse.data?.data || createCourseResponse.data;
        courseIdToAdd = createdCourse.id;
        toast.success('New course created successfully!');
      }

      if (!newCourse.semester_no) {
        toast.error('Please select a semester.');
        return;
      }

      await curriculumService.addCourseToVersion(version.id, courseIdToAdd, newCourse.semester_no);
      toast.success('Course added successfully!');
      setShowAddCourseModal(false);
      setNewCourse({ course: '', semester_no: 1 });
      setNewCourseData({ name: '', code: '', credit_hours: 3, course_type: 'LECTURE', parent_course_id: '' }); // Reset new course form
      setAddCourseMode('existing'); // Reset to existing course tab
      fetchVersion();
    } catch (err: any) {
      console.error('Error adding course:', err);
      toast.error(err.response?.data?.message || 'Failed to add course.');
    } finally {
      setSubmitting(false);
    }
  };

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState('');

  // Loading state
  if (loading && !version && !isNew) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-2">
          <button onClick={handleBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Create New Curriculum Version</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleCreateVersion} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Program</label>
              <select
                value={formData.program}
                onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                required
              >
                <option value="">Choose a program...</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Batch</label>
              <select
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                required
              >
                <option value="">Choose a batch...</option>
                {batches
                  .filter(
                    (b) =>
                      !formData.program ||
                      b.program === formData.program ||
                      b.program_id === formData.program
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-700">
                A new version will be created in <b>Draft</b> status. You can then add courses and later activate it for teacher allocations.
              </p>
            </div>

            <div className="pt-4 flex space-x-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Create Curriculum Version
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-500 text-xl font-semibold">Version not found</div>
        <button onClick={handleBack} className="text-blue-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const courseEntries = version.courses_by_semester
    ? Object.entries(version.courses_by_semester).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={handleBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">Version Details: {version.version_no}</h1>
              <VersionStatusBadge status={version.status} />
            </div>
            <p className="text-sm text-gray-500">
              {version.program_name} - {version.batch_name}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {version.status === 'draft' && !isSAC && (
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSyncCourses}
                disabled={syncing}
                className="flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync from Program
              </button>
              <button
                onClick={handleFinalize}
                disabled={submitting}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Finalize Version
              </button>
            </div>
          )}
          {version.status !== 'draft' && version.activated_at && (
            <div className="flex items-center text-sm text-gray-500">
              <CheckCircle className="w-4 h-4 mr-2" />
              Finalized: {new Date(version.activated_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Program</p>
              <p className="font-semibold text-gray-900">{version.program_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Batch</p>
              <p className="font-semibold text-gray-900">{version.batch_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Courses</p>
              <p className="font-semibold text-gray-900">{version.total_courses}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Created By</p>
              <p className="text-gray-900">{version.created_by_name}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center space-y-3">
          <button
            onClick={() => {
              if (batches.length === 0) fetchInitialData();
              setShowCloneModal(true);
            }}
            className="flex items-center justify-center w-full px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Copy className="w-4 h-4 mr-2" />
            Clone for New Batch
          </button>
        </div>
      </div>

      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Copy className="w-5 h-5 mr-2 text-purple-600" />
              Clone Curriculum Version
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              This will create a new draft version for a different batch by copying all courses and teacher allocations from this version.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Batch</label>
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">Select a batch...</option>
                  {batches
                    .filter((b) => b.program === version.program || b.program_id === version.program)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowCloneModal(false);
                    setTargetBatchId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleClone(targetBatchId);
                    setShowCloneModal(false);
                  }}
                  disabled={submitting || !targetBatchId}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 shadow-md flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Confirm Clone'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'courses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Book className="w-4 h-4 inline mr-2" />
          Courses
        </button>
        {!isSAC && (
          <button
            onClick={() => setActiveTab('allocations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'allocations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Allocations
          </button>
        )}
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <History className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Add Course Modal (simple single-course add) */}
      {showAddCourseModal && version.status === 'draft' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-blue-600" />
              Add Course to Semester {newCourse.semester_no}
            </h2>

            <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addCourseMode === 'existing' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => {
                  setAddCourseMode('existing');
                  setNewCourse({ ...newCourse, course: '' });
                }}
              >
                Existing Course
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  addCourseMode === 'new' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => {
                  setAddCourseMode('new');
                  setNewCourseData({ name: '', code: '', credit_hours: 3, course_type: 'LECTURE', parent_course_id: '' });
                }}
              >
                Create New
              </button>
            </div>

            <div className="space-y-4">
              {addCourseMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <select
                    value={newCourse.course}
                    onChange={(e) => setNewCourse({ ...newCourse, course: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select a course...</option>
                    {allCourses
                      .filter(c => c.semester_number === newCourse.semester_no)
                      .map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name} ({course.code})
                        </option>
                      ))
                    }
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Type</label>
                    <select
                      value={newCourseData.course_type}
                      onChange={(e) => {
                        const type = e.target.value;
                        setNewCourseData({ 
                          ...newCourseData, 
                          course_type: type,
                          // Reset parent if switching to LECTURE
                          parent_course_id: type === 'LECTURE' ? '' : newCourseData.parent_course_id 
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="LECTURE">Theory (Lecture)</option>
                      <option value="LAB">Practical (Lab)</option>
                    </select>
                  </div>

                  {newCourseData.course_type === 'LAB' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parent Theory Course</label>
                      <select
                        value={newCourseData.parent_course_id}
                        onChange={(e) => {
                          const parentId = e.target.value;
                          const parentCourse = allCourses.find(c => c.id === parentId);
                          if (parentCourse) {
                            setNewCourseData({
                              ...newCourseData,
                              parent_course_id: parentId,
                              name: `${parentCourse.name} Lab`,
                              code: `${parentCourse.code}L`
                            });
                          } else {
                            setNewCourseData({ ...newCourseData, parent_course_id: parentId });
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select Theory Course...</option>
                        {allCourses
                          .filter(c => 
                            c.course_type === 'LECTURE' && 
                            c.semester_number === newCourse.semester_no &&
                            !allCourses.some(lab => lab.parent_course === c.id || lab.parent_course_id === c.id)
                          )
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                    <input
                      type="text"
                      value={newCourseData.name}
                      onChange={(e) => setNewCourseData({ ...newCourseData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g., Data Structures"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Course Code</label>
                      <input
                        type="text"
                        value={newCourseData.code}
                        onChange={(e) => setNewCourseData({ ...newCourseData, code: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g., CS201"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Hours</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={newCourseData.credit_hours}
                        onChange={(e) =>
                          setNewCourseData({ ...newCourseData, credit_hours: parseInt(e.target.value || '1', 10) })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester Number</label>
                <input
                  type="number"
                  min="1"
                  max={version.program_total_semesters || 8}
                  value={newCourse.semester_no}
                  onChange={(e) => {
                    const val = parseInt(e.target.value || '1', 10);
                    const max = version.program_total_semesters || 8;
                    const finalVal = val > max ? max : val;
                    setNewCourse({ ...newCourse, semester_no: finalVal });
                    // Reset parent course selection as semester changed
                    setNewCourseData(prev => ({ ...prev, parent_course_id: '', name: '', code: '' }));
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {version.program_total_semesters && (
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">
                    Max semesters for this program: {version.program_total_semesters}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddCourseModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCourse}
                  disabled={
                    submitting ||
                    (addCourseMode === 'existing' && !newCourse.course) ||
                    (addCourseMode === 'new' &&
                      (!newCourseData.name || !newCourseData.code || !newCourseData.credit_hours))
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 shadow-md flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Add to Version'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
        {activeTab === 'courses' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Course Listing</h2>
              {version.status === 'draft' && !isSAC && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddCourseModal(true)}
                    className="flex items-center px-4 py-2 border border-dashed border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Course
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-8">
              {courseEntries.length > 0 ? (
                courseEntries.map(([semester, courses]) => (
                  <div key={semester}>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize border-b pb-2 flex items-center">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs mr-3">
                        {(courses as any[]).length} Courses
                      </span>
                      {semester.replace('_', ' ')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {(courses as any[]).map((vc: any, index: number) => (
                        <div
                          key={vc.id || vc.course || `vc-${index}`}
                          className="p-4 border border-gray-100 rounded-lg bg-gray-50 hover:shadow-md transition-shadow group relative"
                        >
                          {vc.course_code && vc.course_name ? (
                            <>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-tighter">{vc.course_code}</span>
                                <span className="text-xs text-gray-500 font-medium">{vc.credit_hours} Cr. Hr.</span>
                              </div>
                              <h4 className="font-bold text-gray-900 mb-3 group-hover:text-green-700 transition-colors">{vc.course_name}</h4>
                              <div className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-md border border-gray-100">
                                <Users className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                <span className="truncate">
                                  {vc.allocation?.teacher_name || <span className="text-orange-500 italic">No teacher allocated</span>}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-red-500 text-sm font-semibold">Invalid Course Data</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 flex flex-col items-center justify-center">
                  <Book className="w-16 h-16 text-gray-200 mb-4" />
                  <p className="text-gray-500 text-lg">No courses added to this version yet.</p>
                  {!isSAC && (
                    <button
                      onClick={handleSyncCourses}
                      className="mt-4 text-green-600 font-bold hover:underline flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync from Program now
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'allocations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                Teacher Allocations
              </h3>
              <button
                onClick={handleSaveAllocations}
                disabled={submitting}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400"
              >
                {submitting ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save All Allocations
              </button>
            </div>

            <div className="overflow-hidden bg-white border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Semester</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Instructor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {courseEntries.map(([semester, courses]) => (
                    <React.Fragment key={semester}>
                      {(courses as any[]).map((vc: any, idx: number) => (
                        <tr key={vc.id || vc.course || `${semester}-${idx}`} className="hover:bg-gray-50 transition-colors">
                          {idx === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-100" rowSpan={(courses as any[]).length}>
                              {semester.replace('_', ' ')}
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{vc.course_name}</div>
                            <div className="text-xs text-gray-500">
                              {vc.course_code} • {vc.credit_hours} Cr.
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={allocations[String(vc.course)] || ''}
                              onChange={(e) => setAllocations({ ...allocations, [String(vc.course)]: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                            >
                              <option value="">Assign Teacher...</option>
                              {instructors.map((inst) => (
                                <option key={inst.id} value={inst.user}>
                                  {inst.name} ({inst.email})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {allocations[String(vc.course)] ? (
                              <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">Allocated</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="text-center py-10 text-gray-400">Version history timeline coming soon...</div>
        )}
      </div>
    </div>
  );
};

export default CurriculumVersionDetailPage;