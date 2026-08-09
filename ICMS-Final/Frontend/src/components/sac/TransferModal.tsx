import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MoveHorizontal,
  Loader2,
  AlertCircle,
  Users,
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
  const [loading, setLoading] = useState(true);
  const [submittingBatchId, setSubmittingBatchId] = useState<string>('');

  useEffect(() => {
    if (isOpen && student) {
      const fetchEligible = async () => {
        setLoading(true);
        setSubmittingBatchId('');
        try {
          const res = await promotionService.getEligibleBatches(student.id);
          setEligibleBatches(res.data.eligible_batches);
        } catch (err) {
          toast.error('Failed to load eligible batches');
        } finally {
          setLoading(false);
        }
      };
      fetchEligible();
    }
  }, [isOpen, student]);

  const handleBatchSelectAndTransfer = async (batchId: string, batchName: string) => {
    if (submittingBatchId) return;
    setSubmittingBatchId(batchId);
    try {
      const res = await promotionService.transferStudent(student.id, {
        new_batch_id: batchId
      });
      toast.success(res.data.message || `Transferred to ${batchName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSubmittingBatchId('');
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
            className="bg-white w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden border border-gray-100"
          >
            <div className="px-6 py-5 border-b border-gray-100 relative bg-white">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-[0.15em] text-left">
                Select New Batch
              </h2>
              <div className="mt-4 flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100">
                <div className="p-2.5 rounded-xl bg-white border border-white shadow-sm flex items-center justify-center shrink-0">
                  <MoveHorizontal className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{student.full_name}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-indigo-700 bg-indigo-100/70 w-fit px-2.5 py-0.5 rounded-full border border-indigo-200">
                    <AlertCircle className="w-3 h-3" />
                    <span>Repeating Semester {student.current_semester}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="py-10 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-gray-500 text-sm font-medium">Checking eligible batches...</p>
                </div>
              ) : eligibleBatches.length > 0 ? (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 -mr-2 touch-pan-y overscroll-contain scroll-smooth">
                  {eligibleBatches.map(batch => {
                    const isSubmittingThis = submittingBatchId === batch.id;
                    const isAwaiting = batch.name?.toLowerCase().includes('await') || false;
                    return (
                      <button
                        key={batch.id}
                        onClick={() => handleBatchSelectAndTransfer(batch.id, batch.name)}
                        disabled={!!submittingBatchId}
                        className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group
                          ${isSubmittingThis
                            ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                            : submittingBatchId
                              ? 'border-gray-100 bg-white opacity-50 cursor-not-allowed'
                              : isAwaiting
                                ? 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-md hover:shadow-indigo-100 cursor-pointer'
                                : 'border-gray-100 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-md hover:shadow-indigo-100 cursor-pointer'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl transition-colors shrink-0
                            ${isSubmittingThis
                              ? 'bg-indigo-500 text-white'
                              : isAwaiting
                                ? 'bg-slate-200 text-slate-600 group-hover:bg-indigo-500 group-hover:text-white'
                                : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-500 group-hover:text-white'
                              }`}>
                            {isSubmittingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className={`font-bold transition-colors
                              ${isSubmittingThis ? 'text-indigo-900' : 'text-gray-800'}`}>
                              {batch.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors
                                ${isSubmittingThis
                                  ? 'bg-indigo-200 text-indigo-700'
                                  : isAwaiting
                                    ? 'bg-slate-200 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                                    : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                                  }`}>
                                {batch.student_count} Students
                              </span>
                              {batch.session_type && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors
                                  ${isSubmittingThis
                                    ? 'bg-indigo-200 text-indigo-700'
                                    : isAwaiting
                                      ? 'bg-slate-200 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                                      : 'bg-gray-100 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                                    }`}>
                                  {batch.session_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSubmittingThis ? (
                          <span className="text-xs font-bold text-indigo-700 mr-1">Transferring...</span>
                        ) : (
                          <ChevronRight className={`w-5 h-5 transition-colors shrink-0
                            ${submittingBatchId ? 'text-gray-300' : 'text-gray-300 group-hover:text-indigo-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center gap-3">
                  <AlertCircle className="w-10 h-10 text-slate-400" />
                  <div>
                    <p className="text-slate-800 font-bold">No eligible batches found</p>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                      No batch is currently on Semester {student.current_semester}.
                      Transfer will be possible when an eligible batch reaches Semester {student.current_semester}.
                    </p>
                  </div>
                </div>
              )}

              {!loading && eligibleBatches.length > 0 && (
                <p className="mt-4 text-[11px] text-center text-gray-400 font-medium tracking-wide">
                  Click a batch above to confirm transfer instantly
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TransferModal;
