import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  MoveHorizontal, 
  Loader2, 
  AlertCircle,
  Users,
  Calendar,
  ChevronRight
} from 'lucide-react';
import promotionService, { StudentPromotion, EligibleBatch } from '../../api/promotionService';
import { toast } from 'react-toastify';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentPromotion;
  onSuccess: () => void;
}

const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, student, onSuccess }) => {
  const [eligibleBatches, setEligibleBatches] = useState<EligibleBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && student) {
      const fetchEligible = async () => {
        setLoading(true);
        try {
          const res = await promotionService.getEligibleBatches(student.id);
          setEligibleBatches(res.data.eligible_batches);
          if (res.data.eligible_batches.length > 0) {
            setSelectedBatchId(res.data.eligible_batches[0].id);
          }
        } catch (err) {
          toast.error('Failed to load eligible batches');
        } finally {
          setLoading(false);
        }
      };
      fetchEligible();
    }
  }, [isOpen, student]);

  const handleTransfer = async () => {
    if (!selectedBatchId) return;
    setSubmitting(true);
    try {
      const res = await promotionService.transferStudent(student.id, {
        new_batch_id: selectedBatchId
      });
      toast.success(res.data.message);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-gray-100"
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-8 text-white relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MoveHorizontal className="w-6 h-6" />
                Transfer Student
              </h2>
              <p className="text-orange-50 text-sm mt-1">Move student to an eligible batch</p>
            </div>

            <div className="p-8 space-y-6">
              {/* Student Info */}
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Student</p>
                  <p className="text-lg font-bold text-gray-900">{student.full_name}</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-orange-600 font-bold bg-orange-50 w-fit px-3 py-1 rounded-full border border-orange-100">
                    <AlertCircle className="w-4 h-4" />
                    <span>Repeating Semester {student.current_semester}</span>
                  </div>
                </div>

                {loading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="text-gray-500 text-sm font-medium">Checking eligible batches...</p>
                  </div>
                ) : eligibleBatches.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Select New Batch</label>
                    <div className="space-y-2">
                      {eligibleBatches.map(batch => (
                        <button
                          key={batch.id}
                          onClick={() => setSelectedBatchId(batch.id)}
                          className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group ${selectedBatchId === batch.id ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-100' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl transition-colors ${selectedBatchId === batch.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={`font-bold ${selectedBatchId === batch.id ? 'text-orange-900' : 'text-gray-700'}`}>{batch.name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${selectedBatchId === batch.id ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {batch.student_count} Students
                                </span>
                              </div>
                            </div>
                          </div>
                          {selectedBatchId === batch.id && (
                            <ChevronRight className="w-5 h-5 text-orange-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col items-center text-center gap-3">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                    <div>
                      <p className="text-amber-900 font-bold">No eligible batches found</p>
                      <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                        No batch is currently on Semester {student.current_semester}. 
                        Transfer will be possible when an eligible batch reaches Semester {student.current_semester}.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={submitting || !selectedBatchId || eligibleBatches.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MoveHorizontal className="w-5 h-5" />}
                  <span>Transfer Student</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TransferModal;
