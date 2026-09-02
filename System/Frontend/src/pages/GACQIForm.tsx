import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import obeService, { GACQIRecord, GACQIResubmissionHistory, Batch } from '../api/obeService';

const GACQIForm: React.FC = () => {
  const { cqiId } = useParams<{ cqiId: string }>();
  const [cqi, setCqi] = useState<GACQIRecord | null>(null);
  const [history, setHistory] = useState<GACQIResubmissionHistory[]>([]);
  const [rootCause, setRootCause] = useState('');
  const [hodActionPlan, setHodActionPlan] = useState('');
  const [implementedInBatch, setImplementedInBatch] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cqiId) {
      loadCQIData();
    } else {
      obeService.getAllBatches({ alumni_feedback: 'all' }).then(setBatches).catch(() => setBatches([]));
    }
  }, [cqiId]);

  const loadCQIData = async () => {
    if (!cqiId) return;
    setLoading(true);
    try {
      const historyData = await obeService.getGACQIHistory(cqiId);
      setHistory(historyData);
      const record = await obeService.getGACQIRecord(cqiId);
      setCqi(record);
      setRootCause(record.issue_statement || record.root_cause || '');
      setHodActionPlan(record.hod_action_plan || '');
      setImplementedInBatch(record.implemented_in_batch || '');
      setActionTaken(record.action_taken_description || '');
      const batchesData = await obeService.getAllBatches({ alumni_feedback: 'all' });
      setBatches(batchesData);
    } catch (err) {
      console.error(err);
      setError('Failed to load CQI data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (!cqiId || !cqi) {
      setError('No CQI record found');
      return;
    }
    if (!implementedInBatch) {
      setError('Implementation Batch is required');
      return;
    }
    if (actionTaken.trim().length < 20) {
      setError('Action Taken must be at least 20 characters');
      return;
    }
    try {
      setLoading(true);
      await obeService.updateGACQIRecord(cqiId, {
        root_cause: rootCause || undefined,
        hod_action_plan: hodActionPlan || undefined,
      });
      await obeService.closeGACQI(cqiId, {
        implemented_in_batch: implementedInBatch,
        action_taken_description: actionTaken.trim(),
      });
      alert('CQI saved and closed successfully');
      loadCQIData();
    } catch (err) {
      console.error(err);
      setError('Failed to save and close CQI');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">GA-Level CQI Form</h1>

      {cqi && (
        <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="font-semibold">GA:</span> {cqi.ga_title}
            </div>
            <div>
              <span className="font-semibold">CQI Level:</span>
              <span className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {cqi.cqi_level === 'SEMESTER' ? 'Semester End CQI' : 'Program End CQI'}
                {cqi.semester && ` - Semester ${cqi.semester}`}
              </span>
            </div>
            <div>
              <span className="font-semibold">Status:</span>
              <span className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {cqi.status}
              </span>
            </div>
            <div>
              <span className="font-semibold">Attainment:</span> {cqi.attainment_value?.toFixed(1)}%
            </div>
            <div>
              <span className="font-semibold">KPI:</span> {cqi.kpi_threshold_at_trigger}%
            </div>
          </div>
          {cqi.is_locked && (
            <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 font-medium">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Locked - Program End CQI Approved
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}

      {/* Student Feedback Survey Card (read-only) */}
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">Student Feedback Survey (For Reference)</h3>
        <p className="text-sm text-gray-600">
          (This section displays student feedback for affected courses. For demonstration, this is placeholder content.)
        </p>
        <ul className="mt-2 text-sm space-y-1">
          <li>• "Course pace was too fast"</li>
          <li>• "More practice problems needed"</li>
          <li>• "Lectures were clear and helpful"</li>
        </ul>
      </div>

      {/* Single consolidated CQI form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Issue Statement (Root Cause) <span className="text-red-600">*</span>
          </label>
          <textarea
            className={`w-full p-3 border rounded-lg ${
              cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
            rows={4}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder="Describe the root cause of the GA-level deficiency..."
            disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HOD Action Plan <span className="text-red-600">*</span>
          </label>
          <textarea
            className={`w-full p-3 border rounded-lg ${
              cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
            rows={4}
            value={hodActionPlan}
            onChange={(e) => setHodActionPlan(e.target.value)}
            placeholder="Describe the action plan to address the root cause..."
            disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.status === 'CLOSED_IMPLEMENTED' || cqi?.is_locked}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Implementation Batch <span className="text-red-600">*</span>
          </label>
          <select
            className={`w-full p-3 border rounded-lg ${
              cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
            value={implementedInBatch}
            onChange={(e) => setImplementedInBatch(e.target.value)}
            disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.status === 'CLOSED_IMPLEMENTED' || cqi?.is_locked}
          >
            <option value="">Select the batch where actions were implemented</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action Taken Description <span className="text-red-600">*</span>
          </label>
          <textarea
            className={`w-full p-3 border rounded-lg ${
              cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
            rows={4}
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            placeholder="Describe the corrective actions implemented, interventions applied, teaching strategies revised, resources added, etc. (minimum 20 characters)"
            disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.status === 'CLOSED_IMPLEMENTED' || cqi?.is_locked}
          />
        </div>

        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
          onClick={handleSaveAndClose}
          disabled={loading || cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
        >
          {loading ? 'Saving...' : 'Save & Close CQI'}
        </button>
      </div>

      {/* Resubmission History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Resubmission History</h3>
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span><strong>Status:</strong> {item.status_at_time}</span>
                  <span><strong>Submitted:</strong> {new Date(item.submitted_at).toLocaleString()}</span>
                </div>
                <div className="mb-2">
                  <strong>Root Cause:</strong>
                  <p className="mt-1 text-sm">{item.root_cause_snapshot}</p>
                </div>
                {item.hod_comment_snapshot && (
                  <div className="mt-2">
                    <strong>HOD Comment:</strong>
                    <p className="mt-1 text-sm">{item.hod_comment_snapshot}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GACQIForm;
