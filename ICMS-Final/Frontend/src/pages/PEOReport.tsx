import React, { useEffect, useMemo, useState } from 'react';

import obeService, { Batch } from '../api/obeService';
import PEOReportDashboard from '../features/peoReport/PEOReportDashboard';
import { toast } from 'react-hot-toast';

const PEOReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await obeService.getAlumniFeedbackBatches();
        setBatches(data);
      } catch (error) {
        console.error('Failed to fetch alumni batches:', error);
        toast.error('Failed to load alumni batches');
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, []);

  const alumniBatches = useMemo(
    () =>
      batches
        .filter((batch) => batch.is_alumni_feedback_eligible || batch.status === 'graduated')
        .sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''))),
    [batches]
  );

  useEffect(() => {
    if (alumniBatches.length === 0) {
      setSelectedBatchId('');
      return;
    }

    const stillAvailable = alumniBatches.some((batch) => batch.id === selectedBatchId);
    if (!stillAvailable) {
      setSelectedBatchId(alumniBatches[0].id);
    }
  }, [alumniBatches, selectedBatchId]);

  const selectedBatch = alumniBatches.find((batch) => batch.id === selectedBatchId) || alumniBatches[0];
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

  if (!selectedBatch || !programId) {
    return (
      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        No alumni-eligible batch found yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600">PEO Report</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Alumni batch report</h1>
            <p className="mt-2 text-sm text-slate-500">
              Select an alumni batch to view its real employment status, organization data, and CQI form.
            </p>
          </div>

          <div className="min-w-[280px]">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Alumni Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              <option value="">Select alumni batch</option>
              {alumniBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <PEOReportDashboard
        programId={programId}
        year={reportYear}
        batchName={selectedBatch.name}
        batchId={selectedBatch.id}
      />
    </div>
  );
};

export default PEOReport;
