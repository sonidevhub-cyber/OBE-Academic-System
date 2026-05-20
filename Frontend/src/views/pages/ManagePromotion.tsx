import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Users, 
  ChevronRight,
  Home,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  History,
  MoveHorizontal
} from 'lucide-react';
import promotionService, { StudentPromotion, EligibleBatch } from '../../api/promotionService';
import batchService, { Batch } from '../../api/batchService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import { toast } from 'react-toastify';
import TransferModal from '../../components/sac/TransferModal';

interface ManagePromotionProps {
  programId?: string;
  batchId?: string;
  onBack?: () => void;
}

const ManagePromotion: React.FC<ManagePromotionProps> = ({ 
  programId: propProgramId, 
  batchId: propBatchId,
  onBack 
}) => {
  const params = useParams<{ programId: string; batchId: string }>();
  const programId = propProgramId || params.programId;
  const batchId = propBatchId || params.batchId;
  
  const [program, setProgram] = useState<Program | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<StudentPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showConfirmAllModal, setShowConfirmAllModal] = useState(false);
  const [studentToRepeat, setStudentToRepeat] = useState<StudentPromotion | null>(null);
  const [studentToTransfer, setStudentToTransfer] = useState<StudentPromotion | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId || !batchId) return;
    setLoading(true);
    try {
      const [progRes, batchRes, studentsRes] = await Promise.all([
        academicStructureService.getProgramDetail(programId),
        batchService.getBatchById(programId, batchId),
        promotionService.getBatchStudents(programId, batchId)
      ]);
      
      setProgram(progRes.data);
      setBatch(batchRes.data);
      setStudents(studentsRes.data);
    } catch (err: any) {
      setError('Failed to load promotion data');
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  }, [programId, batchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePromoteAll = async () => {
    if (!programId || !batchId) return;
    setActionLoading(true);
    try {
      const res = await promotionService.promoteAllProvisionally(programId, batchId);
      toast.success(res.data.message);
      setShowPromoteModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Promotion failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!programId || !batchId) return;
    setActionLoading(true);
    try {
      const res = await promotionService.confirmAllPromotions(programId, batchId);
      toast.success(res.data.message);
      setShowConfirmAllModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Confirmation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkRepeat = async () => {
    if (!programId || !batchId || !studentToRepeat) return;
    setActionLoading(true);
    try {
      const res = await promotionService.markAsRepeat(programId, batchId, studentToRepeat.id);
      toast.success(res.data.message);
      setStudentToRepeat(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to mark as repeat');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-gray-500 animate-pulse">Loading student records...</p>
      </div>
    );
  }

  const allNone = students.every(s => s.promotion_status === 'none' || s.promotion_status === 'confirmed' || s.promotion_status === 'repeat');
  const hasProvisional = students.some(s => s.promotion_status === 'provisional');

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/sac/programs" className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Home className="w-4 h-4" />
          <span>Programs</span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link to={`/sac/programs/${programId}/batches`} className="hover:text-indigo-600 transition-colors">
          {program?.name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="font-bold text-gray-900">{batch?.name}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-400 font-medium">Manage Promotion</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600" />
            <span>Manage Promotion</span>
          </h1>
          <p className="text-gray-500 mt-1">Handle provisional promotions and repeats for {batch?.name}.</p>
        </div>
        <div className="flex gap-3">
          {allNone && !hasProvisional && batch && batch.current_semester < (program?.total_semesters || 8) && (
            <button 
              onClick={() => setShowPromoteModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100"
            >
              <UserPlus className="w-4 h-4" />
              <span>Promote All Provisionally</span>
            </button>
          )}
          {hasProvisional && (
            <button 
              onClick={() => setShowConfirmAllModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Confirm All Promotions</span>
            </button>
          )}
          {onBack ? (
            <button 
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <Link 
              to={`/sac/programs/${programId}/batches`}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          )}
        </div>
      </div>

      {/* Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-2xl"><Users className="w-6 h-6 text-indigo-600" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Batch</p>
            <p className="text-lg font-bold text-gray-900">{batch?.name}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-2xl"><History className="w-6 h-6 text-blue-600" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Semester</p>
            <p className="text-lg font-bold text-gray-900">Semester {batch?.current_semester}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-2xl"><Users className="w-6 h-6 text-amber-600" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Students</p>
            <p className="text-lg font-bold text-gray-900">{students.length}</p>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Semester</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">No students found in this batch.</td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-indigo-600">
                      {student.custom_id || student.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-bold text-gray-900">{student.full_name}</td>
                  <td className="px-6 py-5 text-gray-500 text-sm">{student.email}</td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Sem {student.current_semester || batch?.current_semester}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${
                      student.promotion_status === 'provisional' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      student.promotion_status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      student.promotion_status === 'repeat' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {student.promotion_status === 'none' ? 'Not Promoted' : student.promotion_status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {student.promotion_status === 'provisional' && (
                        <button 
                          onClick={() => setStudentToRepeat(student)}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all"
                        >
                          Mark as Repeat
                        </button>
                      )}
                      {student.promotion_status === 'repeat' && (
                        <button 
                          onClick={() => setStudentToTransfer(student)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-all ml-auto"
                        >
                          <MoveHorizontal className="w-3.5 h-3.5" />
                          <span>Transfer</span>
                        </button>
                      )}
                      {(student.promotion_status === 'confirmed' || student.promotion_status === 'none') && <span className="text-gray-300">-</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Promote All Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                Provisional Promotion
              </h2>
              <button onClick={() => setShowPromoteModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                All <span className="font-bold text-gray-900">{students.length}</span> students will be moved to <span className="font-bold text-indigo-600">Semester {(batch?.current_semester || 0) + 1}</span> provisionally.
              </p>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-800 font-medium">You can mark failed students as Repeat after external results arrive.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowPromoteModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button 
                  onClick={handlePromoteAll}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Promote All</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm All Modal */}
      {showConfirmAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Confirm All Promotions
              </h2>
              <button onClick={() => setShowConfirmAllModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">All provisionally promoted students will be permanently confirmed.</p>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-800 font-medium">Make sure you have checked external results and marked failed students as Repeat first.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowConfirmAllModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button 
                  onClick={handleConfirmAll}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Confirm All</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Repeat Modal */}
      {studentToRepeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Mark as Repeat
              </h2>
              <button onClick={() => setStudentToRepeat(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Mark <span className="font-bold text-gray-900">{studentToRepeat.full_name}</span> as Repeat?
              </p>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-sm text-red-800 font-medium">They will be moved back to Semester {(studentToRepeat.current_semester || 0) - 1}. This is based on external result.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStudentToRepeat(null)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button 
                  onClick={handleMarkRepeat}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 font-bold disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                  <span>Mark as Repeat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {studentToTransfer && (
        <TransferModal
          isOpen={!!studentToTransfer}
          onClose={() => setStudentToTransfer(null)}
          student={studentToTransfer}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default ManagePromotion;
