import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  PlusCircle, 
  Trash2, 
  ArrowRightCircle, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Home,
  GraduationCap,
  Search,
  ClipboardList
} from 'lucide-react';
import batchService, { Batch, BatchCreateData } from '../../api/batchService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import { curriculumService, CurriculumVersion } from '../../api/curriculumService';
import { toast } from 'react-toastify';

interface BatchesProps {
  onManagePromotion?: (programId: string, batchId: string) => void;
}

const Batches: React.FC<BatchesProps> = ({ onManagePromotion }) => {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  
  const [program, setProgram] = useState<Program | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [masterCurricula, setMasterCurricula] = useState<CurriculumVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCurricula, setLoadingCurricula] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [graduatingBatch, setGraduatingBatch] = useState<Batch | null>(null);
  const [isGraduating, setIsGraduating] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBatch, setNewBatch] = useState<BatchCreateData>({
    name: '',
    start_year: new Date().getFullYear(),
    end_year: new Date().getFullYear() + 4,
    session_type: 'fall',
    curriculum_version_id: undefined
  });

  const fetchData = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const [progRes, batchRes] = await Promise.all([
        academicStructureService.getProgramDetail(programId),
        batchService.getBatches(programId)
      ]);
      setProgram(progRes.data);
      setBatches(batchRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  const fetchMasterCurricula = useCallback(async () => {
    if (!programId) return;
    setLoadingCurricula(true);
    try {
      const res = await curriculumService.getMasterCurricula(programId);
      console.log('Master curricula API response:', res);
      // The backend api_response returns { data: [...], ... } inside Axios' res.data
      setMasterCurricula(res.data.data);
    } catch (err: any) {
      console.error('Failed to fetch master curricula:', err);
    } finally {
      setLoadingCurricula(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (showAddModal) {
      fetchMasterCurricula();
    }
  }, [showAddModal, fetchMasterCurricula]);

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programId) return;
    if (newBatch.end_year <= newBatch.start_year) {
      setError('End year must be greater than start year');
      return;
    }
    setSubmitting(true);
    try {
      await batchService.createBatch(programId, newBatch);
      setSuccess('Batch created successfully');
      setShowAddModal(false);
      setNewBatch({
        name: '',
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 4,
        session_type: 'fall',
        curriculum_version_id: undefined
      });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.name?.[0] || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceSemester = async (batch: Batch) => {
    if (!programId || !program) return;
    if (batch.current_semester >= program.total_semesters) {
      setError('Already at final semester');
      return;
    }
    if (!window.confirm(`Move ${batch.name} to Semester ${batch.current_semester + 1}?`)) return;
    
    try {
      await batchService.advanceSemester(programId, batch.id);
      setSuccess(`${batch.name} advanced to semester ${batch.current_semester + 1}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.[0] || 'Failed to advance semester');
    }
  };

  const handleGraduateBatch = async () => {
    if (!programId || !graduatingBatch) return;
    
    setIsGraduating(true);
    try {
      const res = await batchService.graduateBatch(programId, graduatingBatch.id);
      toast.success(`${res.data.batch_name} graduated! ${res.data.alumni_count} students are now Alumni.`);
      setGraduatingBatch(null);
      fetchData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to graduate batch';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGraduating(false);
    }
  };

  const handleDeleteBatch = async (batch: Batch) => {
    if (!programId) return;
    if (!window.confirm(`Deactivate ${batch.name}?`)) return;
    
    try {
      await batchService.deleteBatch(programId, batch.id);
      setSuccess('Batch deactivated successfully');
      fetchData();
    } catch (err) {
      setError('Failed to deactivate batch');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-gray-500 animate-pulse">Loading batches...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/sac/programs" className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Home className="w-4 h-4" />
          <span>Programs</span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-bold text-gray-900">{program?.name}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-400 font-medium">Batches</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-end border-b pb-6 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <span>Batches</span>
          </h1>
          <p className="text-gray-500 mt-1">Manage student groups for {program?.name}.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Add Batch</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">×</button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Start Year</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">End Year</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Semester</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Students</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Curriculum Version</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">
                  No batches created for this program yet.
                </td>
              </tr>
            ) : (
              batches.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="font-bold text-gray-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{b.start_year}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{b.end_year}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      Semester {b.current_semester}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-gray-900">{b.student_count}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Enrolled</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {b.curriculum_version_no ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                        {b.curriculum_version_no}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Not Assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    {b.status === 'graduated' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        Graduated
                      </span>
                    ) : b.is_active ? (
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
                      {b.status === 'active' && b.is_active && (
                        <>
                          {program && b.current_semester < program.total_semesters && (
                              onManagePromotion ? (
                                <button
                                  onClick={() => onManagePromotion(programId!, b.id)}
                                  title="Manage Promotion"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                  <span>Manage Promotion</span>
                                </button>
                              ) : (
                                <Link
                                  to={`/sac/programs/${programId}/batches/${b.id}/promotion`}
                                  title="Manage Promotion"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                  <span>Manage Promotion</span>
                                </Link>
                              )
                            )}
                          {program && b.current_semester === program.total_semesters && (
                            <button 
                              onClick={() => setGraduatingBatch(b)}
                              title="Graduate Batch"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold"
                            >
                              <GraduationCap className="w-3.5 h-3.5" />
                              <span>Graduate</span>
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteBatch(b)}
                            title="Deactivate Batch"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {b.status === 'graduated' && (
                        <Link
                          to={`/sac/programs/${programId}/batches/${b.id}/alumni`}
                          title="View Alumni"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-600 hover:text-white transition-all text-xs font-bold"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>View Alumni</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Add New Batch
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAddBatch} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Name</label>
                <input 
                  required
                  value={newBatch.name}
                  onChange={e => setNewBatch({...newBatch, name: e.target.value})}
                  placeholder="e.g. BSCS-2022"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Year</label>
                  <input 
                    type="number"
                    required
                    value={newBatch.start_year}
                    onChange={e => setNewBatch({...newBatch, start_year: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Year</label>
                  <input 
                    type="number"
                    required
                    value={newBatch.end_year}
                    onChange={e => setNewBatch({...newBatch, end_year: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Session Type</label>
                <select
                  required
                  value={newBatch.session_type}
                  onChange={e => setNewBatch({...newBatch, session_type: e.target.value as 'fall' | 'spring'})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="fall">Fall</option>
                  <option value="spring">Spring</option>
                </select>
                <p className="mt-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  {newBatch.session_type === 'fall' ? 'Starts at Semester 1 (Odd)' : 'Starts at Semester 2 (Even)'}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Curriculum Version (Optional)</label>
                <select
                  value={newBatch.curriculum_version_id || ''}
                  onChange={e => setNewBatch({...newBatch, curriculum_version_id: e.target.value ? parseInt(e.target.value) : undefined})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  disabled={loadingCurricula}
                >
                  <option value="">None - Create Without Curriculum</option>
                  {masterCurricula
                    .filter(v => v.status === 'finalized')
                    .map(v => (
                      <option key={v.id} value={v.id}>
                        {v.version_no}
                      </option>
                    ))}
                </select>
                {loadingCurricula && (
                  <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Loading versions...
                  </p>
                )}
                <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Select a master curriculum to clone for this batch
                </p>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Batch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Batches;
