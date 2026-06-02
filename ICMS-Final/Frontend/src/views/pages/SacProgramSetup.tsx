import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  CalendarRange, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Users,
  ArrowRightCircle,
  Calendar,
  Search,
  X,
  GraduationCap,
  ClipboardList
} from 'lucide-react';
import academicStructureService, { Program, Course, Semester } from '../../api/academicStructureService';
import batchService, { Batch, BatchCreateData } from '../../api/batchService';
import { curriculumService } from '../../api/curriculumService';
import { studentService } from '../../api/apiService';
import { toast } from 'react-toastify';

// Define the interface for a student in this context
interface Student {
  student_id: string;
  registration_number: string;
  custom_id?: string;
  name: string;
  user_email: string;
  phone: string;
  semester?: { name: string };
}

interface SacProgramSetupProps {
  onManagePromotion?: (programId: string, batchId: string) => void;
}

const SacProgramSetup: React.FC<SacProgramSetupProps> = ({ onManagePromotion }) => {
  // State
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alumniBatches, setAlumniBatches] = useState<Batch[]>([]);
  const [masterCurricula, setMasterCurricula] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'batches' | 'alumni'>('batches');
  
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState<Batch | null>(null);
  const [batchStudents, setBatchStudents] = useState<Student[]>([]);
  const [batchStudentsLoading, setBatchStudentsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [graduatingBatch, setGraduatingBatch] = useState<Batch | null>(null);
  const [isGraduating, setIsGraduating] = useState(false);

  // Form States
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [programForm, setProgramForm] = useState({
    name: '',
    code: '',
    description: '',
    total_semesters: 8
  });

  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchForm, setBatchForm] = useState<BatchCreateData>({
    name: '',
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 4,
    session_type: 'fall',
    curriculum_version_id: undefined,
  });
  

  // Fetch Programs
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await academicStructureService.getPrograms();
      setPrograms(response.data);

      let currentProgram = selectedProgram;
      // If nothing selected yet, select first program.
      if (response.data.length > 0 && !selectedProgram) {
        currentProgram = response.data[0];
        setSelectedProgram(currentProgram);
      }

      // IMPORTANT:
      // Program objects coming from getPrograms() may not include `semesters`.
      // Always refresh currentProgram from detail endpoint so UI shows semesters immediately.
      if (currentProgram?.id) {
        const detailRes = await academicStructureService.getProgramDetail(currentProgram.id);
        setSelectedProgram(detailRes.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [selectedProgram?.id]); // Depend on id instead of whole object

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Courses or Batches based on active tab
  const fetchContent = useCallback(async () => {
    if (!selectedProgram) return;
    setContentLoading(true);
    try {
      if (activeTab === 'batches') {
        const response = await batchService.getBatches(selectedProgram.id);
        // Only show active batches in Batches tab
        setBatches(response.data.filter(b => b.status === 'active'));
      } else {
        const response = await batchService.getBatches(selectedProgram.id);
        // Show graduated batches in Alumni tab
        setAlumniBatches(response.data.filter(b => b.status === 'graduated'));
      }
    } catch (err: any) {
      setError(`Failed to load ${activeTab}`);
    } finally {
      setContentLoading(false);
    }
  }, [selectedProgram, selectedSemester, activeTab]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const fetchMasterCurricula = useCallback(async () => {
    if (!selectedProgram) return;
    try {
      const res = await curriculumService.getMasterCurricula(selectedProgram.id);
      const data = res.data?.data || res.data || [];
      setMasterCurricula(data);
    } catch (error) {
      console.error("Error fetching master curricula:", error);
      toast.error("Could not load master curricula.");
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedProgram) {
      fetchMasterCurricula();
    }
  }, [selectedProgram, fetchMasterCurricula]);

  const fetchBatchStudents = useCallback(async (batch: Batch) => {
    setSelectedBatchForStudents(batch);
    setBatchStudentsLoading(true);
    try {
      // If batch is graduated, only fetch alumni. If active, only fetch students.
      const roleFilter = batch.status === 'graduated' ? 'alumni' : 'student';
      const response = await studentService.getAllStudents({ 
        batch: batch.id,
        role: roleFilter 
      } as any);
      setBatchStudents(response.data);
    } catch (err) {
      setError('Failed to load batch students');
    } finally {
      setBatchStudentsLoading(false);
    }
  }, []);

  // Handlers
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await academicStructureService.createProgram(programForm);
      setSuccess('Program created successfully!');
      setShowProgramForm(false);
      setProgramForm({ name: '', code: '', description: '', total_semesters: 8 });
      fetchData();
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.code ? `Code: ${data.code[0]}` : data?.detail || 'Failed to create program');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    if (batchForm.end_year <= batchForm.start_year) {
      setError('End year must be greater than start year');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: batchForm.name,
        start_year: batchForm.start_year,
        end_year: batchForm.end_year,
        session_type: batchForm.session_type,
      };

      if (batchForm.curriculum_version_id) {
        payload.curriculum_version_id = batchForm.curriculum_version_id;
      }
      await batchService.createBatch(selectedProgram.id, payload);
      setSuccess('Batch created successfully');
      setShowBatchForm(false);
      setBatchForm({
        name: '',
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 4,
        session_type: 'fall',
        curriculum_version_id: undefined,
      });
      fetchContent();
    } catch (err: any) {
      setError(err.response?.data?.name?.[0] || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceSemester = async (batch: Batch) => {
    if (!selectedProgram) return;
    if (batch.current_semester >= selectedProgram.total_semesters) {
      setError('Already at final semester');
      return;
    }
    if (!window.confirm(`Move ${batch.name} to Semester ${batch.current_semester + 1}?`)) return;
    
    try {
      await batchService.advanceSemester(selectedProgram.id, batch.id);
      setSuccess(`${batch.name} advanced successfully`);
      fetchContent();
    } catch (err: any) {
      setError('Failed to advance semester');
    }
  };

  const handleGraduateBatch = async () => {
    if (!selectedProgram || !graduatingBatch) return;
    
    setIsGraduating(true);
    try {
      const res = await batchService.graduateBatch(selectedProgram.id, graduatingBatch.id);
      toast.success(`${res.data.batch_name} graduated! ${res.data.alumni_count} students are now Alumni.`);
      setGraduatingBatch(null);
      fetchContent();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to graduate batch';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGraduating(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!selectedProgram || !window.confirm('Deactivate this batch?')) return;
    try {
      await batchService.deleteBatch(selectedProgram.id, id);
      setSuccess('Batch deactivated');
      fetchContent();
    } catch (err) {
      setError('Failed to deactivate batch');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end border-b pb-4 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Academic Structure</h1>
          <p className="text-gray-500 mt-1">Manage programs, semesters, courses, and batches.</p>
        </div>
        {!showProgramForm && (
          <button 
            onClick={() => setShowProgramForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Program</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 shadow-sm"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400">×</button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Program Creation Form */}
      {showProgramForm && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Create New Program</h2>
            <button onClick={() => setShowProgramForm(false)} className="text-gray-400 text-2xl">&times;</button>
          </div>
          <form onSubmit={handleCreateProgram} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Program Name</label>
              <input required value={programForm.name} onChange={e => setProgramForm({...programForm, name: e.target.value})}
                placeholder="e.g. BS Computer Science" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Program Code</label>
              <input required value={programForm.code} onChange={e => setProgramForm({...programForm, code: e.target.value})}
                placeholder="e.g. BSCS" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Description</label>
              <textarea value={programForm.description} onChange={e => setProgramForm({...programForm, description: e.target.value})}
                rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Total Semesters</label>
              <input type="number" min="1" max="12" required value={programForm.total_semesters}
                onChange={e => setProgramForm({...programForm, total_semesters: parseInt(e.target.value)})}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setShowProgramForm(false)} className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Create Program</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Active Programs</h3>
            </div>
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : (
                programs.map((p, idx) => (
                  <button key={p.id || idx} onClick={() => { setSelectedProgram(p); setSelectedSemester(null); }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedProgram?.id === p.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-sm">{p.code}</p>
                      <p className="text-xs opacity-70 truncate max-w-[150px]">{p.name}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedProgram?.id === p.id ? 'rotate-90' : ''}`} />
                  </button>
                ))
              )}
            </div>
          </div>


        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {selectedProgram ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button onClick={() => setActiveTab('batches')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'batches' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Users className="w-4 h-4" /> Batches
                </button>
                <button onClick={() => setActiveTab('alumni')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'alumni' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <GraduationCap className="w-4 h-4" /> Alumni
                </button>
              </div>

              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {activeTab === 'batches' 
                        ? `${selectedProgram.code} Batches`
                        : `${selectedProgram.code} Alumni Records`
                    }
                  </h2>
                  <p className="text-sm text-gray-500">
                    {activeTab === 'batches'
                        ? `${batches.length} active batches`
                        : `${alumniBatches.length} graduated batches`
                    }
                  </p>
                </div>
                {activeTab !== 'alumni' && (
                  <button 
                    onClick={() => setShowBatchForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Add Batch</span>
                  </button>
                )}
              </div>

              {/* Content Forms & Lists */}
              <div className="p-0">
                {/* Batch Form */}
                <AnimatePresence>
                  {showBatchForm && activeTab === 'batches' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="p-6 bg-indigo-50/50 border-b border-indigo-100"
                    >
                      <form onSubmit={handleCreateBatch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</label>
                          <input required value={batchForm.name} onChange={e => setBatchForm({...batchForm, name: e.target.value})}
                            placeholder="e.g. BSCS-2022" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Year</label>
                          <input type="number" required value={batchForm.start_year} onChange={e => setBatchForm({...batchForm, start_year: parseInt(e.target.value)})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Year</label>
                          <input type="number" required value={batchForm.end_year} onChange={e => setBatchForm({...batchForm, end_year: parseInt(e.target.value)})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Session Type</label>
                          <select 
                            required 
                            value={batchForm.session_type} 
                            onChange={e => setBatchForm({...batchForm, session_type: e.target.value as 'fall' | 'spring'})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none"
                          >
                            <option value="fall">Fall</option>
                            <option value="spring">Spring</option>
                          </select>
                          <p className="mt-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                            {batchForm.session_type === 'fall' ? 'Starts at Semester 1 (Odd)' : 'Starts at Semester 2 (Even)'}
                          </p>
                        </div>
                        <div className="space-y-1 md:col-span-3">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Master Curriculum</label>
                          <select
                            value={batchForm.curriculum_version_id || ''}
                            onChange={e => setBatchForm({...batchForm, curriculum_version_id: e.target.value || undefined})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none"
                          >
                            <option value="">Do Not Use Master Curriculum</option>
                            {masterCurricula.map(cv => (
                              <option key={cv.id} value={cv.id}>
                                {cv.version_no}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                          <button type="button" onClick={() => setShowBatchForm(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                          <button type="submit" disabled={submitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                            Create Batch
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {contentLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-200" />
                    <p className="text-gray-400 text-sm animate-pulse">Loading {activeTab}...</p>
                  </div>
                ) : activeTab === 'batches' ? (
                  batches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Users className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 text-sm">No active batches created yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Duration</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Curriculum</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Semester</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {batches.map(b => (
                            <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-indigo-50 rounded-lg"><Users className="w-4 h-4 text-indigo-600" /></div>
                                  <span className="font-bold text-gray-900">{b.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600 font-medium">{b.start_year} - {b.end_year}</td>
                              <td className="px-6 py-5 text-center">
                                {b.curriculum_version_no ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                    {b.curriculum_version_no}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">No Version</span>
                                )}
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                  Semester {b.current_semester}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-center">
                                {b.is_active ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-400 border border-gray-100">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex justify-end gap-2 transition-opacity">
                                  <button onClick={() => fetchBatchStudents(b)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="View Students">
                                    <Search className="w-4 h-4" />
                                  </button>
                                  {b.status === 'active' && b.is_active && (
                                    <>
                                      {selectedProgram && b.current_semester < selectedProgram.total_semesters && (
                                        onManagePromotion ? (
                                          <button
                                            onClick={() => onManagePromotion(selectedProgram.id, b.id)}
                                            title="Manage Promotion"
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold"
                                          >
                                            <ClipboardList className="w-3.5 h-3.5" />
                                            <span>Manage Promotion</span>
                                          </button>
                                        ) : (
                                          <Link
                                            to={`/sac/programs/${selectedProgram.id}/batches/${b.id}/promotion`}
                                            title="Manage Promotion"
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold"
                                          >
                                            <ClipboardList className="w-3.5 h-3.5" />
                                            <span>Manage Promotion</span>
                                          </Link>
                                        )
                                      )}
                                      {selectedProgram && b.current_semester === selectedProgram.total_semesters && (
                                        <button 
                                          onClick={() => setGraduatingBatch(b)}
                                          title="Graduate Batch"
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold"
                                        >
                                          <GraduationCap className="w-3.5 h-3.5" />
                                          <span>Graduate</span>
                                        </button>
                                      )}
                                      <button onClick={() => handleDeleteBatch(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  alumniBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <GraduationCap className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 text-sm">No graduated batches found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Duration</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Graduated On</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Total Alumni</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {alumniBatches.map(b => (
                            <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-amber-50 rounded-lg"><GraduationCap className="w-4 h-4 text-amber-600" /></div>
                                  <span className="font-bold text-gray-900">{b.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center text-sm text-gray-600 font-medium">{b.start_year} - {b.end_year}</td>
                              <td className="px-6 py-5 text-center text-sm text-gray-500">
                                {b.graduated_at ? new Date(b.graduated_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className="font-bold text-gray-900">{b.student_count}</span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex justify-end gap-2 transition-opacity">
                                  <button 
                                    onClick={() => fetchBatchStudents(b)} 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all text-xs font-bold"
                                    title="View Alumni"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>View Alumni</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-40 gap-4 text-center px-10">
              <div className="p-4 bg-indigo-50 rounded-full"><BookOpen className="w-10 h-10 text-indigo-300" /></div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Select a Program</h3>
                <p className="text-gray-400 mt-2 max-w-sm">Choose an academic program from the left sidebar to manage its structure.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Graduate Batch Modal */}
      {graduatingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                Graduate Batch
              </h2>
              <button onClick={() => setGraduatingBatch(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Are you sure you want to graduate <span className="font-bold text-gray-900">{graduatingBatch.name}</span>?
              </p>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-800 font-medium">
                  {graduatingBatch.student_count} students will become Alumni.
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setGraduatingBatch(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGraduateBatch}
                  disabled={isGraduating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold disabled:opacity-50"
                >
                  {isGraduating ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                  <span>Graduate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Students Modal */}
      <AnimatePresence>
        {selectedBatchForStudents && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    {selectedBatchForStudents.status === 'graduated' ? `Alumni of ${selectedBatchForStudents.name}` : `Students in ${selectedBatchForStudents.name}`}
                  </h2>
                  <p className="text-sm text-gray-500">Total {batchStudents.length} {selectedBatchForStudents.status === 'graduated' ? 'alumni' : 'students'} found</p>
                </div>
                <button onClick={() => setSelectedBatchForStudents(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {batchStudentsLoading ? (
                  <div className="py-20 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-gray-400">Loading student list...</p>
                  </div>
                ) : batchStudents.length === 0 ? (
                  <div className="py-20 text-center text-gray-400 italic">No students found in this batch.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Semester</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batchStudents.map(s => (
                        <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                            {s.registration_number || s.custom_id || s.student_id}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{s.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{s.user_email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${selectedBatchForStudents.status === 'graduated' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                              {selectedBatchForStudents.status === 'graduated' ? 'Alumni' : (s.semester?.name || `Semester ${selectedBatchForStudents.current_semester}`)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end">
                <button onClick={() => setSelectedBatchForStudents(null)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SacProgramSetup;