import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import obeService, { Batch } from '../api/obeService';
import PEOReportDashboard from '../features/peoReport/PEOReportDashboard';

const PEOReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await obeService.getAllBatches({ alumni_feedback: 'all' });
        setBatches(data);
      } catch (error) {
        console.error('Failed to fetch batches:', error);
        toast.error('Failed to fetch batches');
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, []);

  const alumniBatches = useMemo(
    () =>
      batches
        .filter((b) => b.status === 'graduated')
        .sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''))),
    [batches]
  );

  const selectedBatch = alumniBatches.find((b) => b.id === selectedBatchId) || null;
  const programId = String(selectedBatch?.program?.id || '');
  const reportYear = useMemo(() => {
    const baseDate = selectedBatch?.graduated_at || selectedBatch?.alumni_feedback_enabled_at;
    const parsedYear = baseDate ? new Date(baseDate).getFullYear() : new Date().getFullYear();
    return Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  }, [selectedBatch]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 mb-6">PO Attainment Report</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Batch Select */}
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Alumni Batch
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {alumniBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Placeholder for future use (if needed) */}
          <div className="flex items-end">
          </div>
        </div>
      </div>

      {/* Report Dashboard */}
      {selectedBatch && programId ? (
        <PEOReportDashboard
          programId={programId}
          year={reportYear}
          batchId={selectedBatch.id}
          batchName={selectedBatch.name}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-500">
          Select an alumni batch to view the PO report.
        </div>
      )}
    </div>
  );
};

export default PEOReport;
