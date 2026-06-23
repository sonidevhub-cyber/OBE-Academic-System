import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { curriculumService, CurriculumVersion, CurriculumCourse } from '../../../api/curriculumService';
import { coordinatorService } from '../../../api/coordinatorService';
import obeService from '../../../api/obeService';
import VersionStatusBadge from '../../../components/obe/VersionStatusBadge';
import { ChevronLeft, Plus, CheckCircle, Copy, Book, Users, History, Save, Info, RefreshCw, User, Target, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CurriculumVersionDetailPageProps {
  id?: string;
  onClose?: () => void;
  onVersionCreated?: (id: number) => void;
}

type ActiveTab = 'courses' | 'obe' | 'history';

const CurriculumVersionDetailPage: React.FC<CurriculumVersionDetailPageProps> = ({ id: propId, onClose, onVersionCreated }) => {
  const { isSAC, currentUser } = useAuth();
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;

  const navigate = useNavigate();
  const location = useLocation();

  const [version, setVersion] = useState<CurriculumVersion | null>(null);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');

  // Lazy Branching state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchBatchId, setBranchBatchId] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

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
  
  // Clone modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState('');

  // OBE state
  const [selectedCourseForObe, setSelectedCourseForObe] = useState<any | null>(null);
  const [mappingMatrix, setMappingMatrix] = useState<any | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [isEditingObe, setIsEditingObe] = useState(false);
  const [tempMappings, setTempMappings] = useState<Record<string, number>>({});
  const [showCloModal, setShowCloModal] = useState(false);
  const [editingClo, setEditingClo] = useState<any | null>(null);
  const [cloFormData, setCloFormData] = useState({
    title: '',
    description: '',
    bloom_level: 'K2',
    kpi_target: 60,
    order_number: 1
  });

  const { idForRequests, isNew, isInvalidId } = useMemo(() => {
    if (!id) return { idForRequests: NaN, isNew: false, isInvalidId: true };
    if (id === 'new') return { idForRequests: NaN, isNew: true, isInvalidId: false };
    const n = Number(id);
    return { idForRequests: n, isNew: false, isInvalidId: Number.isNaN(n) };
  }, [id]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tab = queryParams.get('tab');
    if (tab === 'courses' || tab === 'history') setActiveTab(tab);
    // If SAC, make sure activeTab isn't 'obe'
    if (isSAC && activeTab === 'obe') {
      setActiveTab('courses');
    }
  }, [location.search, isSAC, activeTab]);

  useEffect(() => {
    if (isNew) {
      fetchInitialData();
      return;
    }

    if (!id || isInvalidId) {
      setLoading(false);
      return;
    }

    // Reset OBE state when switching versions
    setSelectedCourseForObe(null);
    setMappingMatrix(null);
    setIsEditingObe(false);

    fetchVersion();
    loadAllCourses();
  }, [idForRequests, isNew, isInvalidId]);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      // Fallback if not used in dashboard
      navigate(-1);
    }
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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [programsRes, batchesRes] = await Promise.all([
        coordinatorService.getPrograms(),
        coordinatorService.getBatches(),
      ]);

      const programsData = programsRes.data?.data || programsRes.data || [];
      const batchesData = batchesRes.data?.data || batchesRes.data || [];

      setPrograms(Array.isArray(programsData) ? programsData : []);
      setBatches(Array.isArray(batchesData) ? batchesData : []);
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
      
      if (onVersionCreated) {
        onVersionCreated(newVersion.id);
      } else {
        navigate(`/curriculum-versions/${newVersion.id}`);
      }
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
      
      if (onVersionCreated) {
        onVersionCreated(newVersion.id);
      } else {
        navigate(`/curriculum-versions/${newVersion.id}`);
      }
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

  const fetchMappingMatrix = async (courseId: string) => {
    if (!version) return;
    try {
      setLoadingMatrix(true);
      // Use GA Mapping Matrix instead of PI
      const data = await obeService.getMappingMatrix(courseId, version.id);
      setMappingMatrix(data);
      
      // Initialize temp mappings for GAs
      const initial: Record<string, number> = {};
      data.mappings?.forEach((m: any) => {
        // GA mapping key: cloId_gaId
        initial[`${m.clo_id || m.clo}_${m.ga_id || m.ga}`] = m.weight || 3;
      });
      setTempMappings(initial);
    } catch (error) {
      console.error('Error fetching GA mapping matrix:', error);
      toast.error('Failed to load GA mapping matrix');
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleSaveObeMappings = async () => {
    if (!selectedCourseForObe || !version) return;

    const action = async () => {
      try {
        setSubmitting(true);
        const mappingsList = Object.entries(tempMappings).map(([key, weight]) => {
          const [cloId, gaId] = key.split('_');
          return { clo_id: cloId, ga_id: gaId, weight };
        });
        
        await obeService.saveCLOGAMappings(selectedCourseForObe.course, version.id, mappingsList);
        toast.success('GA Mappings saved successfully');
        setIsEditingObe(false);
        fetchMappingMatrix(selectedCourseForObe.course);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to save mappings');
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  const handleSaveClo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForObe || !version) return;

    const action = async () => {
      try {
        setSubmitting(true);
        if (editingClo) {
          await obeService.updateCLO(editingClo.id, cloFormData);
          toast.success('CLO updated successfully');
        } else {
          await obeService.createCLO(selectedCourseForObe.course, version.id, cloFormData);
          toast.success('CLO created successfully');
        }
        setShowCloModal(false);
        setEditingClo(null);
        fetchMappingMatrix(selectedCourseForObe.course);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to save CLO');
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  const handleDeleteClo = async (cloId: any) => {
    if (!window.confirm('Are you sure you want to delete this CLO?')) return;
    
    const action = async () => {
      try {
        setSubmitting(true);
        await obeService.deleteCLO(cloId);
        toast.success('CLO deleted successfully');
        if (selectedCourseForObe) fetchMappingMatrix(selectedCourseForObe.course);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete CLO');
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  useEffect(() => {
    if (activeTab === 'obe' && selectedCourseForObe) {
      fetchMappingMatrix(selectedCourseForObe.course);
    }
  }, [activeTab, selectedCourseForObe]);

  const handleBranchAndExecute = async (batchId: string) => {
    if (!version) return;
    try {
      setSubmitting(true);
      const res = await curriculumService.branchVersion(version.id, batchId);
      const newVersion = res.data?.data || res.data;
      toast.success(`New version ${newVersion.version_no} created for the selected batch`);
      
      // Update local state to the new version
      setVersion(newVersion);
      if (onVersionCreated) onVersionCreated(newVersion.id);
      
      setShowBranchModal(false);
      
      // Execute the pending action on the new version
      if (pendingAction) {
        await pendingAction();
        setPendingAction(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to branch version');
    } finally {
      setSubmitting(false);
    }
  };

  const ensureEditable = async (action: () => Promise<void>) => {
    if (!version) return;
    
    // If it's a draft, it's safe to edit directly (no matter how many batches it has)
    if (version.status === 'draft') {
      await action();
      return;
    }

    // If it's finalized or archived, we need to branch
    setPendingAction(() => action);
    
    if (version.assigned_batches && version.assigned_batches.length > 1) {
      setShowBranchModal(true);
    } else if (version.assigned_batches && version.assigned_batches.length === 1) {
      // Just one batch but finalized, auto-branch
      handleBranchAndExecute(version.assigned_batches[0].id);
    } else {
      // Master version or no batches, ask to select a batch to branch for
      if (batches.length === 0) await fetchInitialData();
      setShowBranchModal(true);
    }
  };

  const handleAddCourse = async () => {
    if (!version) return;

    const action = async () => {
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

        await curriculumService.addCourseToVersion(version.id, courseIdToAdd, newCourse.semester_no);
        toast.success('Course added successfully!');
        setShowAddCourseModal(false);
        setNewCourse({ course: '', semester_no: 1 });
        fetchVersion();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to add course.');
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

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
                      (!formData.program ||
                      b.program === formData.program ||
                      b.program_id === formData.program) &&
                      !b.has_curriculum
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
    <div className="space-y-6">
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
              {version.program_name} - {version.assigned_batches && version.assigned_batches.length > 0 
                ? version.assigned_batches.map(b => b.name).join(', ') 
                : version.batch_name}
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
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Batches</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {version.assigned_batches && version.assigned_batches.length > 0 ? (
                  version.assigned_batches.map(b => (
                    <span key={b.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                      {b.name}
                    </span>
                  ))
                ) : (
                  <p className="font-semibold text-gray-900">{version.batch_name || 'No batches'}</p>
                )}
              </div>
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
            onClick={() => setActiveTab('obe')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'obe' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            OBE Mapping
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
              {version.status === 'draft' && (
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
                              <h4 className="font-bold text-gray-900 mb-2 group-hover:text-green-700 transition-colors">{vc.course_name}</h4>
                              {version.assigned_batches && version.assigned_batches.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {version.assigned_batches.map((batch: any) => (
                                    <span key={batch.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                      {batch.name}
                                    </span>
                                  ))}
                                </div>
                              )}
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

        {activeTab === 'obe' && !isSAC && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Target className="w-5 h-5 mr-2 text-indigo-600" />
                OBE Course Mapping (CLO-GA)
              </h3>
              {selectedCourseForObe && version.status === 'draft' && !isSAC && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditingClo(null);
                      setCloFormData({
                        title: '',
                        description: '',
                        bloom_level: 'K2',
                        kpi_target: 60,
                        order_number: (mappingMatrix?.clos?.length || 0) + 1
                      });
                      setShowCloModal(true);
                    }}
                    className="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add CLO
                  </button>
                  {isEditingObe ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingObe(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveObeMappings}
                        disabled={submitting}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-md"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Mappings
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingObe(true)}
                      className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-md"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Mappings
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-2">
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Select Course</h4>
                <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                  {courseEntries.flatMap(([_, courses]) => (courses as any[])).map((vc: any) => (
                    <button
                      key={vc.course}
                      onClick={() => {
                        setSelectedCourseForObe(vc);
                        setIsEditingObe(false);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-all border ${
                        selectedCourseForObe?.course === vc.course
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                          : 'bg-white border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <p className="text-xs font-bold text-indigo-600 uppercase">{vc.course_code}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{vc.course_name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-3 bg-gray-50 rounded-xl p-6 border border-gray-100 min-h-[400px]">
                {!selectedCourseForObe ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Target className="w-12 h-12 mb-2 opacity-20" />
                    <p>Select a course from the left to view OBE mappings</p>
                  </div>
                ) : loadingMatrix ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : mappingMatrix ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">CLO to GA Mapping Matrix</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden table-fixed">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase border-b border-r w-32 sticky left-0 bg-gray-50 z-10">CLOs \ GAs</th>
                              {mappingMatrix.gas?.map((ga: any) => (
                                <th 
                                  key={ga.id} 
                                  className="px-4 py-3 text-center text-xs font-black text-indigo-700 uppercase border-b border-r bg-indigo-50/50 min-w-[80px]"
                                >
                                  <div className="flex flex-col items-center">
                                    <span>GA-{ga.order_number}</span>
                                    <span className="text-[8px] text-gray-400 font-normal normal-case truncate max-w-[70px]">{ga.title || ga.description}</span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {mappingMatrix.clos?.map((clo: any) => (
                              <tr key={clo.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900 border-r border-b sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                  CLO-{clo.order_number}
                                </td>
                                {mappingMatrix.gas?.map((ga: any) => {
                                  const weight = tempMappings[`${clo.id}_${ga.id}`];
                                  return (
                                    <td key={`${clo.id}-${ga.id}`} className="px-2 py-3 text-center border-b border-r">
                                      {isEditingObe ? (
                                        <input
                                          type="checkbox"
                                          checked={!!weight}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            const newTemp = { ...tempMappings };
                                            if (!checked) delete newTemp[`${clo.id}_${ga.id}`];
                                            else newTemp[`${clo.id}_${ga.id}`] = 3; // Default weight 3
                                            setTempMappings(newTemp);
                                          }}
                                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                      ) : (
                                        weight ? (
                                          <div className="flex justify-center">
                                            <CheckCircle className="w-4 h-4 text-indigo-600" />
                                          </div>
                                        ) : (
                                          <span className="text-gray-200">-</span>
                                        )
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h5 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2 flex justify-between items-center">
                          CLO Descriptions
                        </h5>
                        <div className="space-y-3">
                          {mappingMatrix.clos?.map((clo: any) => (
                            <div key={clo.id} className="text-sm flex justify-between items-start group">
                              <div className="flex-1 pr-4">
                                <span className="font-bold text-indigo-600 mr-2">CLO-{clo.order_number}:</span>
                                <span className="text-gray-700">{clo.title}</span>
                              </div>
                              {version.status === 'draft' && !isSAC && (
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingClo(clo);
                                      setCloFormData({
                                        title: clo.title,
                                        description: clo.description,
                                        bloom_level: clo.bloom_level,
                                        kpi_target: clo.kpi_target,
                                        order_number: clo.order_number
                                      });
                                      setShowCloModal(true);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClo(clo.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <h5 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Graduate Attributes</h5>
                        <div className="space-y-3">
                          {mappingMatrix.gas?.map((ga: any) => (
                            <div key={ga.id} className="text-sm">
                              <span className="font-bold text-indigo-600 mr-2">GA-{ga.order_number}:</span>
                              <span className="text-gray-700">{ga.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-500">No mappings found for this course.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CLO Modal */}
        {showCloModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-indigo-600" />
                {editingClo ? 'Edit CLO' : 'Add New CLO'}
              </h2>
              <form onSubmit={handleSaveClo} className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No.</label>
                    <input
                      type="number"
                      value={cloFormData.order_number}
                      onChange={(e) => setCloFormData({ ...cloFormData, order_number: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bloom Level</label>
                    <select
                      value={cloFormData.bloom_level}
                      onChange={(e) => setCloFormData({ ...cloFormData, bloom_level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="K1">K1 - Remembering</option>
                      <option value="K2">K2 - Understanding</option>
                      <option value="K3">K3 - Applying</option>
                      <option value="K4">K4 - Analyzing</option>
                      <option value="K5">K5 - Evaluating</option>
                      <option value="K6">K6 - Creating</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CLO Title</label>
                  <input
                    type="text"
                    value={cloFormData.title}
                    onChange={(e) => setCloFormData({ ...cloFormData, title: e.target.value })}
                    placeholder="e.g. Design basic algorithms"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description (Optional)</label>
                  <textarea
                    value={cloFormData.description}
                    onChange={(e) => setCloFormData({ ...cloFormData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">KPI Target (%)</label>
                  <input
                    type="number"
                    value={cloFormData.kpi_target}
                    onChange={(e) => setCloFormData({ ...cloFormData, kpi_target: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCloModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md flex items-center justify-center"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Save CLO'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="text-center py-10 text-gray-400">Version history timeline coming soon...</div>
        )}

        {/* Lazy Branching Modal */}
        {showBranchModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Copy className="w-5 h-5 mr-2 text-purple-600" />
                Branch Version
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                This version is shared or finalized. To make changes, we need to create a new <b>Draft</b> version for a specific batch.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch to Branch For</label>
                  <select
                    value={branchBatchId}
                    onChange={(e) => setBranchBatchId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Choose a batch...</option>
                    {version?.assigned_batches?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                    <optgroup label="Other Batches">
                      {batches
                        .filter(b => !version?.assigned_batches?.some((ab: any) => ab.id === b.id))
                        .filter(b => b.program === version?.program || b.program_id === version?.program)
                        .filter(b => !b.has_curriculum)
                        .map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowBranchModal(false);
                      setPendingAction(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleBranchAndExecute(branchBatchId)}
                    disabled={submitting || !branchBatchId}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-md flex items-center justify-center"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Branch & Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumVersionDetailPage;