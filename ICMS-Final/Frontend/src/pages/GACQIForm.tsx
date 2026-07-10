import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import obeService, { GACQIRecord, GACQIResubmissionHistory } from '../api/obeService';

const GACQIForm: React.FC = () => {
  const { cqiId } = useParams<{ cqiId: string }>();
  const [cqi, setCqi] = useState<GACQIRecord | null>(null);
  const [history, setHistory] = useState<GACQIResubmissionHistory[]>([]);
  const [rootCause, setRootCause] = useState('');
  const [remedialPlan, setRemedialPlan] = useState('');
  const [hodComment, setHodComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock user role for demonstration
  const [userRole, setUserRole] = useState<'coordinator' | 'hod'>('coordinator'); // can be 'coordinator' or 'hod'

  useEffect(() => {
    if (cqiId) {
      loadCQIData();
    }
  }, [cqiId]);

  const loadCQIData = async () => {
    if (!cqiId) return;
    setLoading(true);
    try {
      const historyData = await obeService.getGACQIHistory(cqiId);
      setHistory(historyData);
      // For demonstration, create a mock CQI if needed
      setCqi({
        id: cqiId,
        ga: '1',
        ga_title: 'GA-1: Problem Solving',
        ga_code: 'GA-1',
        batch: '1',
        batch_name: 'Batch 2021-2025',
        cqi_level: 'SEMESTER',
        semester: 5,
        attainment_value: 55.0,
        kpi_threshold_at_trigger: 60.0,
        root_cause: '',
        remedial_plan: '',
        hod_comment: '',
        status: 'PENDING',
        submitted_by: null,
        approved_by: null,
        is_audit_visible: true,
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: [],
        issue_statement: null,
        hod_action_plan: null,
        triggered_at: null,
        saved_by_hod: null,
        saved_at: null,
        is_active: true,
      });
      setRootCause('');
      setRemedialPlan('');
    } catch (err) {
      console.error(err);
      setError('Failed to load CQI data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!rootCause || !remedialPlan) {
      setError('Please fill out all required fields');
      return;
    }
    try {
      setLoading(true);
      if (cqiId && cqi) {
        // Update existing CQI
        await obeService.updateGACQIRecord(cqiId, {
          root_cause: rootCause,
          remedial_plan: remedialPlan,
        });
      } else {
        // Create new CQI (for demonstration)
        await obeService.createGACQI({
          root_cause: rootCause,
          remedial_plan: remedialPlan,
        } as Partial<GACQIRecord>);
      }
      alert('CQI submitted successfully');
      loadCQIData();
    } catch (err) {
      console.error(err);
      setError('Failed to submit CQI');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!cqiId) return;
    try {
      setLoading(true);
      await obeService.approveGACQI(cqiId);
      alert('CQI approved');
      loadCQIData();
    } catch (err) {
      console.error(err);
      setError('Failed to approve CQI');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!cqiId || !hodComment) {
      setError('Please enter a rejection comment');
      return;
    }
    try {
      setLoading(true);
      await obeService.rejectGACQI(cqiId, hodComment);
      alert('CQI rejected');
      loadCQIData();
    } catch (err) {
      console.error(err);
      setError('Failed to reject CQI');
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

      {userRole === 'coordinator' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Root Cause
            </label>
            <textarea
                className="w-full p-3 border rounded-lg"
                rows={4}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Describe the root cause of the GA-level deficiency..."
                disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
              />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remedial Plan
            </label>
            <textarea
              className="w-full p-3 border rounded-lg"
              rows={4}
              value={remedialPlan}
              onChange={(e) => setRemedialPlan(e.target.value)}
              placeholder="Describe the remedial action plan..."
              disabled={cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
            />
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            onClick={handleSubmit}
            disabled={loading || cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
          >
            Submit CQI
          </button>
        </div>
      )}

      {userRole === 'hod' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Root Cause
            </label>
            <textarea
              className="w-full p-3 border rounded-lg bg-gray-50"
              rows={4}
              value={cqi?.root_cause || ''}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remedial Plan
            </label>
            <textarea
              className="w-full p-3 border rounded-lg bg-gray-50"
              rows={4}
              value={cqi?.remedial_plan || ''}
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Comment (if applicable)
            </label>
            <textarea
              className="w-full p-3 border rounded-lg"
              rows={3}
              value={hodComment}
              onChange={(e) => setHodComment(e.target.value)}
              placeholder="Enter rejection comment..."
            />
          </div>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              onClick={handleApprove}
              disabled={loading || cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
            >
              Approve
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              onClick={handleReject}
              disabled={loading || cqi?.status === 'FULLY_APPROVED' || cqi?.is_locked}
            >
              Reject
            </button>
          </div>
        </div>
      )}

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
                <div>
                  <strong>Remedial Plan:</strong>
                  <p className="mt-1 text-sm">{item.remedial_plan_snapshot}</p>
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
