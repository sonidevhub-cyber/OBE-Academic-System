import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import obeService, {
  VisionMissionCQIReviewRecord,
  Batch,
  VisionMissionAnalyticsResponse,
  VisionMissionAnalyticsRow,
  VisionResponse,
  MissionResponse,
} from '../../api/obeService';
import authService from '../../api/authService';
import { fetchCurrentProfile } from '../../api/profileService';
import academicStructureService, { Program } from '../../api/academicStructureService';
import {
  Eye,
  RefreshCw,
  CheckSquare,
  Edit3,
  Calendar,
  User,
  FileText,
  ShieldCheck,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCheck,
  Lock,
} from 'lucide-react';

const extractDepartmentId = (...values: any[]): string => {
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object') {
      const id = value.id || value.department_id || value.uuid;
      if (id) return String(id);
    }
  }
  return '';
};

const HODVisionMissionCQI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'VISION' | 'MISSION'>('VISION');
  const [reviews, setReviews] = useState<VisionMissionCQIReviewRecord[]>([]);
  const [vision, setVision] = useState<VisionResponse | null>(null);
  const [mission, setMission] = useState<MissionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [hodProfile, setHodProfile] = useState<any>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [analytics, setAnalytics] = useState<VisionMissionAnalyticsResponse | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingRow, setClosingRow] = useState<VisionMissionAnalyticsRow | null>(null);
  const [closeForm, setCloseForm] = useState({
    implemented_in_batch: '',
    action_taken_description: '',
  });
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const currentAuth = authService.getCurrentUser() as any;
  const isHOD =
    currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  const authUser = currentAuth?.user || currentAuth;
  const profileUser = hodProfile?.user || hodProfile;
  const selectedProgram = programs.find((program) => program.id === selectedProgramId) || programs[0] || null;
  const departmentId = extractDepartmentId(
    selectedProgram?.department,
    profileUser?.department_id || profileUser?.department,
    authUser?.department_id ||
      authUser?.department
  );

  useEffect(() => {
    let cancelled = false;
    const role = currentAuth?.role || currentAuth?.user?.role || 'hod';

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled) {
          setHodProfile(response.data || null);
        }
      } catch (error) {
        console.error('Failed to fetch HOD profile:', error);
        if (!cancelled) {
          setHodProfile(null);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentAuth?.role, currentAuth?.user?.role]);

  useEffect(() => {
    let cancelled = false;
    const loadPrograms = async () => {
      try {
        const response = await academicStructureService.getPrograms();
        const list = response.data || [];
        if (!cancelled) {
          setPrograms(list);
          setSelectedProgramId((prev) => prev || list[0]?.id || '');
        }
      } catch (error) {
        console.error('Failed to load programs:', error);
      }
    };
    loadPrograms();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBatches = async () => {
      try {
        const list = await obeService.getAllBatches({ alumni_feedback: 'all' });
        if (!cancelled) {
          setBatches(list);
          setSelectedBatchId((prev) => prev || list[0]?.id || '');
        }
      } catch (error) {
        console.error('Failed to load batches:', error);
      }
    };
    loadBatches();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAll = async () => {
    if (!departmentId) return;
    setLoading(true);
    try {
      const [visionData, missionData, reviewsData] = await Promise.all([
        obeService.getDepartmentVision(departmentId).catch(() => null),
        obeService.getDepartmentMission(departmentId).catch(() => null),
        obeService.getVisionMissionCQIReviews().catch(() => []),
      ]);
      setVision(visionData);
      setMission(missionData);
      setReviews(reviewsData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [departmentId]);

  useEffect(() => {
    if (!selectedBatchId) {
      setAnalytics(null);
      return;
    }
    let cancelled = false;
    const loadAnalytics = async () => {
      try {
        const data = await obeService.getVisionMissionAnalytics(selectedBatchId);
        if (!cancelled) setAnalytics(data);
      } catch (error) {
        console.error('Failed to load Vision/Mission analytics:', error);
        if (!cancelled) setAnalytics(null);
      }
    };
    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId]);

  const filteredReviews = reviews.filter(
    (r) =>
      r.statement_type === activeTab &&
      (!departmentId || String(r.department || '') === departmentId)
  );

  const currentStatementText =
    activeTab === 'VISION' ? vision?.statement ?? '' : mission?.statement ?? '';

  const toggleReviewExpansion = (id: string) => {
    setExpandedReview((prev) => (prev === id ? null : id));
  };

  const triggeredRows = [
    ...(analytics?.vision_rows || []),
    ...(analytics?.mission_rows || []),
  ].filter((row) => row.cqi_action_required && row.cqi_record_id);

  const openCloseModal = (row: VisionMissionAnalyticsRow) => {
    setClosingRow(row);
    setCloseForm({ implemented_in_batch: '', action_taken_description: '' });
    setCloseModalOpen(true);
  };

  const handleCloseCqi = async () => {
    if (!closingRow?.cqi_record_id) return;
    if (!closeForm.implemented_in_batch) {
      toast.error('Please select the batch where actions were implemented');
      return;
    }
    if (!closeForm.action_taken_description.trim()) {
      toast.error('Please describe the action taken');
      return;
    }
    setCloseSubmitting(true);
    try {
      await obeService.closeVisionMissionCQI(closingRow.cqi_record_id, {
        implemented_in_batch: closeForm.implemented_in_batch,
        action_taken_description: closeForm.action_taken_description.trim(),
      });
      toast.success('Vision/Mission CQI closed successfully');
      setCloseModalOpen(false);
      setClosingRow(null);
      if (selectedBatchId) {
        const data = await obeService.getVisionMissionAnalytics(selectedBatchId);
        setAnalytics(data);
      }
    } catch (error: any) {
      console.error(error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to close Vision/Mission CQI';
      toast.error(msg);
    } finally {
      setCloseSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-500">
                Vision &amp; Mission — CQI Review
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">
                Statement Review and Revision Register
              </h2>
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                Review history is maintained here for audit. Statement revisions are managed from OBE Configuration, while this page handles keyword-level CQI and closing loop evidence.
              </p>
            </div>
          </div>
          {isHOD && (
            <div className="flex flex-col gap-3 sm:items-end">
              <select
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                className="w-full min-w-[260px] rounded-xl border-2 border-indigo-100 bg-white px-4 py-3 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 sm:w-auto"
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('VISION')}
          className={`px-5 py-3 font-black uppercase tracking-wider text-xs rounded-t-lg transition-colors ${
            activeTab === 'VISION'
              ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye className="inline w-4 h-4 mr-1.5" />
          Vision
        </button>
        <button
          onClick={() => setActiveTab('MISSION')}
          className={`px-5 py-3 font-black uppercase tracking-wider text-xs rounded-t-lg transition-colors ${
            activeTab === 'MISSION'
              ? 'bg-violet-100 text-violet-700 border-b-2 border-violet-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="inline w-4 h-4 mr-1.5" />
          Mission
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 border-b border-gray-100">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
            Current Live {activeTab} Statement
          </p>
          <p className="text-lg font-semibold text-gray-800 leading-relaxed">
            {currentStatementText || (
              <span className="text-gray-400 italic">
                No {activeTab.toLowerCase()} statement set for this program
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-indigo-50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
              Triggered Vision / Mission CQI Closures
            </p>
            <h3 className="mt-1 text-xl font-black text-gray-900">
              Close keyword-level CQI loops
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Not Achieved Vision/Mission keyword CQIs require implementation evidence and a resulting attainment closure.
            </p>
          </div>
          <select
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            className="w-full rounded-xl border-2 border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-gray-700 focus:border-emerald-500 focus:ring-0 md:w-[280px]"
          >
            <option value="">Select batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name || batch.custom_id}
              </option>
            ))}
          </select>
        </div>

        {triggeredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400 italic">
            No triggered Vision/Mission CQI records found for the selected batch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Keyword</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Attainment</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Action Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Closing</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {triggeredRows.map((row) => {
                  const closed = row.cqi_status === 'CLOSED_IMPLEMENTED';
                  return (
                    <tr key={`${row.keyword_type}-${row.keyword_id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-black text-gray-900">{row.keyword_type}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">{row.keyword}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{row.target_kpi?.toFixed(1) ?? '-'}%</td>
                      <td className="px-4 py-4 text-sm font-bold text-rose-600">{row.attainment_score?.toFixed(1) ?? '-'}%</td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-md">
                        {row.hod_action_plan || 'Pending HOD action plan'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {closed ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase text-emerald-700">
                              <CheckCheck className="h-3 w-3" />
                              Closed
                            </span>
                            <div className="text-xs text-gray-500">
                              {row.implemented_in_batch_name || 'Implementation batch'} · {row.resulting_attainment?.toFixed(1) ?? '-'}%
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black uppercase text-amber-700">
                            Needs closing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {closed ? (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500">
                            <Lock className="h-3.5 w-3.5" />
                            Locked
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCloseModal(row)}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
                          >
                            <CheckCheck className="h-4 w-4" />
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-600">Loading records...</p>
        </div>
      )}

      {!loading && filteredReviews.length === 0 && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No {activeTab} reviews yet
          </h3>
          <p className="text-gray-500 mb-4">
            Statement review records appear here after revisions are saved from OBE Configuration.
          </p>
        </div>
      )}

      {!loading && filteredReviews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-gray-500">
              {filteredReviews.length}{' '}
              {filteredReviews.length === 1 ? 'review' : 'reviews'} on record
            </p>
          </div>

          {filteredReviews.map((review) => {
            const expanded = expandedReview === review.id;
            return (
              <div
                key={review.id}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleReviewExpansion(review.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                        review.decision === 'REVISED'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    >
                      {review.decision === 'REVISED' ? (
                        <Edit3 className="w-4 h-4" />
                      ) : (
                        <CheckSquare className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                            review.decision === 'REVISED'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {review.decision}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            review.trigger_type === 'SCHEDULED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-gray-50 text-gray-600 border border-gray-200'
                          }`}
                        >
                          <Clock className="w-3 h-3 mr-0.5" />
                          {review.trigger_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {review.justification}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {review.review_date
                          ? new Date(review.review_date).toLocaleDateString()
                          : '—'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <User className="w-3 h-3" />
                        {review.reviewed_by_name || review.reviewed_by || 'HOD'}
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                          Snapshot of Statement Before Review
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {review.previous_statement_snapshot}
                        </p>
                      </div>

                      {review.decision === 'REVISED' ? (
                        <div className="rounded-xl bg-amber-50 p-4 shadow-sm border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                              New Revised Statement (Live Version Created)
                            </p>
                          </div>
                          <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap font-semibold">
                            {review.new_statement || '—'}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-emerald-50 p-4 shadow-sm border border-emerald-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                            <p className="text-xs font-black uppercase tracking-widest text-emerald-700">
                              Retained Unchanged
                            </p>
                          </div>
                          <p className="text-sm text-emerald-800 leading-relaxed">
                            Statement was confirmed as still relevant and
                            appropriate for the program. No new version
                            created.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                        Justification (Mandatory)
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {review.justification}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Reviewed:{' '}
                          {review.review_date
                            ? new Date(review.review_date).toLocaleString()
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>
                          By: {review.reviewed_by_name || review.reviewed_by || 'HOD'}
                        </span>
                      </div>
                      {review.department_name && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Academic unit: {review.department_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Trigger: {review.trigger_type}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closeModalOpen && closingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <h3 className="text-xl font-black text-gray-900">
                Close {closingRow.keyword_type} CQI
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {closingRow.keyword}
              </p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
                  Implementation Batch <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 focus:border-emerald-500 focus:ring-0"
                  value={closeForm.implemented_in_batch}
                  onChange={(event) =>
                    setCloseForm((prev) => ({
                      ...prev,
                      implemented_in_batch: event.target.value,
                    }))
                  }
                >
                  <option value="">Select the batch where actions were implemented</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name || batch.custom_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
                  Action Taken Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:border-emerald-500"
                  rows={6}
                  placeholder="Describe implemented measures for this Vision/Mission keyword CQI."
                  value={closeForm.action_taken_description}
                  onChange={(event) =>
                    setCloseForm((prev) => ({
                      ...prev,
                      action_taken_description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                  Resulting Attainment
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Automatically recalculated from the selected implementation batch and locked after closing.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                disabled={closeSubmitting}
                className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseCqi}
                disabled={closeSubmitting}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {closeSubmitting ? 'Closing...' : 'Confirm Close & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODVisionMissionCQI;
