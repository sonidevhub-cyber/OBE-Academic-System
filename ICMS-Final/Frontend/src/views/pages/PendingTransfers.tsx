import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  ChevronRight,
  Home,
  Loader2,
  MoveHorizontal,
  AlertCircle,
  RefreshCw,
  Search,
  Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import promotionService, { PendingTransferStudent } from '../../api/promotionService';
import TransferModal from '../../components/sac/TransferModal';
import { toast } from 'react-toastify';

const PendingTransfers: React.FC = () => {
  const [students, setStudents] = useState<PendingTransferStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentToTransfer, setStudentToTransfer] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promotionService.getPendingTransfers();
      setStudents(res.data);
    } catch (err) {
      toast.error('Failed to load frozen students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.current_batch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-gray-500 animate-pulse">Loading frozen students...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/sac/dashboard" className="hover:text-indigo-600 flex items-center gap-1 transition-colors">
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-400 font-medium">Freeze</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6 border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <MoveHorizontal className="w-8 h-8 text-slate-700" />
            <span>Freeze</span>
          </h1>
          <p className="text-gray-500 mt-1">Frozen students waiting for an eligible batch transfer.</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            />
          </div>
          <button 
            onClick={fetchData}
            className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-slate-100 rounded-2xl"><Users className="w-6 h-6 text-slate-700" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Frozen</p>
            <p className="text-lg font-bold text-gray-900">{students.length} Students</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-2xl"><CheckCircle2 className="w-6 h-6 text-indigo-600" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Available Batches</p>
            <p className="text-lg font-bold text-gray-900">{students.filter(s => s.has_eligible_batch).length} Students</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-slate-50 rounded-2xl"><AlertCircle className="w-6 h-6 text-slate-500" /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Waiting</p>
            <p className="text-lg font-bold text-gray-900">{students.filter(s => !s.has_eligible_batch).length} Students</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Batch (Sem)</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Session</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">No frozen students found.</td>
              </tr>
            ) : (
              filteredStudents.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{s.full_name}</span>
                      <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-0.5 font-medium">
                        <Mail className="w-3 h-3" />
                        <span>{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold text-gray-700">{s.current_batch}</span>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase">Sem {s.current_semester}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase">
                      {s.session_type}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {s.has_eligible_batch ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Waiting
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {s.has_eligible_batch ? (
                      <button 
                        onClick={() => setStudentToTransfer(s)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold ml-auto border border-slate-200 hover:border-indigo-600"
                      >
                        <MoveHorizontal className="w-3.5 h-3.5" />
                        <span>Transfer</span>
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

// Helper for check icon
const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default PendingTransfers;
