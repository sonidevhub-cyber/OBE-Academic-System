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
  BookMarked,
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alumniBatches, setAlumniBatches] = useState<Batch[]>([]);
  
  const [activeTab, setActiveTab] = useState<'courses' | 'batches' | 'alumni'>('courses');
  
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

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState({
    name: '',
    code: '',
    course_type: 'theory' as 'theory' | 'lab',
    credit_hours: 3,
    semester_id: ''
  });

  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchCreateData>({ 
    name: '', 
    start_year: new Date().getFullYear(), 
    end_year: new Date().getFullYear() + 4,
    session_type: 'fall'
  });

  // Fetch Programs
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const response = await academicStructureService.getPrograms();
      setPrograms(response.data);

      // If nothing selected yet, select first program.
      if (response.data.length > 0 && !selectedProgram) {
        setSelectedProgram(response.data[0]);
      }

      // IMPORTANT:
      // Program objects coming from getPrograms() may not include `semesters`.
      // Always refresh selectedProgram from detail endpoint so UI shows semesters immediately.
      if (selectedProgram?.id) {
        const detailRes = await academicStructureService.getProgramDetail(selectedProgram.id);
        setSelectedProgram(detailRes.data);
      }

      // NOTE: program IDs are backend UUIDs. UI should never display them raw.
      // If you see random-looking IDs in the UI, it is because somewhere prints `program.id`.
      // (This component only displays code/name, so no change needed here.)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Courses or Batches based on active tab
  const fetchContent = useCallback(async () => {
    if (!selectedProgram) return;
    setContentLoading(true);
    try {
      if (activeTab === 'courses') {
        const response = await academicStructureService.getCourses(
          selectedProgram.id, 
          selectedSemester?.id
        );
        setCourses(response.data);
      } else if (activeTab === 'batches') {
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

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...courseForm,
        program_id: selectedProgram.id
      };

      if (editingCourse) {
        await academicStructureService.updateCourse(editingCourse.id, payload);
        setSuccess('Course updated successfully');
      } else {
        await academicStructureService.createCourse(payload);
        setSuccess('Course added successfully');
      }
      setShowCourseForm(false);
      setEditingCourse(null);
      setCourseForm({ name: '', code: '', course_type: 'theory', credit_hours: 3, semester_id: '' });
      fetchContent();
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.code ? `Course Code: ${data.code[0]}` : data?.semester_id ? data.semester_id[0] : data?.detail || 'Failed to save course');
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
      await batchService.createBatch(selectedProgram.id, batchForm);
      setSuccess('Batch created successfully');
      setShowBatchForm(false);
      setBatchForm({
        name: '',
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 4,
        session_type: 'fall'
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

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await academicStructureService.deleteCourse(id);
      setSuccess('Course deleted');
      fetchContent();
    } catch (err) {
      setError('Failed to delete course');
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

          {selectedProgram && activeTab === 'courses' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-indigo-600" /> Semesters</h3>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1">
                <button onClick={() => setSelectedSemester(null)}
                  className={`p-2 text-xs font-semibold rounded-lg transition-all ${selectedSemester === null ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >All Semesters</button>
                {selectedProgram.semesters?.map((s, idx) => (
                  <button key={s.id || idx} onClick={() => setSelectedSemester(s)}
                    className={`p-2 text-xs font-semibold rounded-lg transition-all ${selectedSemester?.id === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >{s.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {selectedProgram ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                <button onClick={() => setActiveTab('courses')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'courses' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <BookMarked className="w-4 h-4" /> Course Catalog
                </button>
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
                    {activeTab === 'courses' 
                      ? (selectedSemester ? `${selectedProgram.code} - ${selectedSemester.name}` : `${selectedProgram.code} Courses`)
                      : activeTab === 'batches' 
                        ? `${selectedProgram.code} Batches`
                        : `${selectedProgram.code} Alumni Records`
                    }
                  </h2>
                  <p className="text-sm text-gray-500">
                    {activeTab === 'courses' 
                      ? `${courses.length} courses found` 
                      : activeTab === 'batches'
                        ? `${batches.length} active batches`
                        : `${alumniBatches.length} graduated batches`
                    }
                  </p>
                </div>
                {activeTab !== 'alumni' && (
                  <button 
                    onClick={() => activeTab === 'courses' ? setShowCourseForm(true) : setShowBatchForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{activeTab === 'courses' ? 'Add Course' : 'Add Batch'}</span>
                  </button>
                )}
              </div>

              {/* Content Forms & Lists */}
              <div className="p-0">
                {/* Course Form */}
                <AnimatePresence>
                  {showCourseForm && activeTab === 'courses' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="p-6 bg-indigo-50/50 border-b border-indigo-100"
                    >
                      <form onSubmit={handleSaveCourse} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course Code</label>
                          <input required value={courseForm.code} onChange={e => setCourseForm({...courseForm, code: e.target.value})}
                            placeholder="e.g. CS-201" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course Title</label>
                          <input required value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})}
                            placeholder="e.g. Data Structures" className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                          <select value={courseForm.course_type} onChange={e => setCourseForm({...courseForm, course_type: e.target.value as any})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none"
                          >
                            <option value="theory">Theory</option>
                            <option value="lab">Lab</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credit Hours</label>
                          <input type="number" min="1" max="6" value={courseForm.credit_hours}
                            onChange={e => setCourseForm({...courseForm, credit_hours: parseInt(e.target.value)})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Semester</label>
                          <select required value={courseForm.semester_id} onChange={e => setCourseForm({...courseForm, semester_id: e.target.value})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 outline-none"
                          >
                            <option value="">Select Semester</option>
                            {selectedProgram.semesters?.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                          <button type="button" onClick={() => setShowCourseForm(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                          <button type="submit" disabled={submitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                            {editingCourse ? 'Update Course' : 'Add Course'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                ) : activeTab === 'courses' ? (
                  courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <BookMarked className="w-8 h-8 text-gray-200" />
                      <p className="text-gray-400 text-sm">No courses yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Cr. Hrs</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Semester</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {courses.map(c => (
                            <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4 font-mono text-sm text-indigo-600 font-bold">{c.code}</td>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.name}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.course_type === 'theory' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                  {c.course_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-sm text-gray-600">{c.credit_hours}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">Sem {c.semester_number}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1 transition-opacity">
                                  <button onClick={() => { setEditingCourse(c); setCourseForm({ name: c.name, code: c.code, course_type: c.course_type, credit_hours: c.credit_hours, semester_id: c.semester_id }); setShowCourseForm(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteCourse(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
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
