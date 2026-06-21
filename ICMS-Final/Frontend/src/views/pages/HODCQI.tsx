import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import { toast } from "react-hot-toast";
import obeService from "../../api/obeService";
import { GACQIRecord, GACQIResubmissionHistory, GAReportItem, BatchGAReportResponse, ReadinessResponse } from "../../api/obeService";
import authService from "../../api/authService";
import { History, CheckCircle, XCircle, MessageSquare, FileBarChart, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";

const HODCQI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"clo" | "ga">("clo");
  
  // CLO CQI states
  const [cloData, setCloData] = useState<any[]>([]);
  const [cloLoadingId, setCloLoadingId] = useState<string | null>(null);
  const [cloLoading, setCloLoading] = useState(false);
  const [cloComments, setCloComments] = useState<{ [key: string]: string }>({});

  // GA CQI states
  const [gaBatches, setGaBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [gaReportData, setGaReportData] = useState<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | null>(null);
  const [gaLoading, setGaLoading] = useState(false);
  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localComment, setLocalComment] = useState<{ [key: string]: string }>({});

  // Get current user
  const currentAuth = authService.getCurrentUser();
  const isHod = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  // --- CLO CQI functions ---
  const fetchCloData = async () => {
    try {
      setCloLoading(true);
      const res = await api.get("/assessments/hod-cqi/");
      setCloData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load CLO CQI data");
    } finally {
      setCloLoading(false);
    }
  };

  const handleCloAction = async (id: string, status: string) => {
    try {
      setCloLoadingId(id);
      await api.patch(`/assessments/hod-cqi/update/${id}/`, {
        status,
        hod_comment: cloComments[id] || ""
      });
      toast.success(`CLO CQI ${status}`);
      fetchCloData();
    } catch (err: any) {
      console.error(err?.response?.data);
      toast.error("Action failed");
    } finally {
      setCloLoadingId(null);
    }
  };

  // --- GA CQI functions ---
  const fetchGaBatches = async () => {
    try {
      setGaLoading(true);
      const batchesData = await obeService.getAllBatches();
      setGaBatches(batchesData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch batches');
    } finally {
      setGaLoading(false);
    }
  };

  const fetchGaReport = async () => {
    if (!selectedBatchId) return;
    setGaLoading(true);
    try {
      const data = await obeService.getBatchGAReport(selectedBatchId, { mode: 'cumulative', scope: 'cohort' });
      setGaReportData(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch GA report');
    } finally {
      setGaLoading(false);
    }
  };

  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs(prev =>
      prev.includes(gaCode)
        ? prev.filter(code => code !== gaCode)
        : [...prev, gaCode]
    );
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory(prev => prev === cqiId ? null : cqiId);
  };

  const handleApproveCqi = async (cqiId: string) => {
    setSubmitting(true);
    try {
      await obeService.approveGACQI(cqiId);
      toast.success('GA CQI approved');
      fetchGaReport();
    } catch (error) {
      console.error(error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCqi = async (cqiId: string) => {
    const comment = localComment[cqiId] || prompt('Please provide a rejection comment:');
    if (!comment) return;
    setSubmitting(true);
    try {
      await obeService.rejectGACQI(cqiId, comment);
      toast.success('GA CQI rejected');
      fetchGaReport();
    } catch (error) {
      console.error(error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'FULLY_APPROVED':
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'PENDING':
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'SENT_BACK':
      case 'rejected':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FULLY_APPROVED':
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
      case 'pending':
      case 'SENT_BACK':
      case 'rejected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  // --- Helper functions for GA CQI ---
  const isBatchGAReportResponse = (data: any): data is BatchGAReportResponse => {
    return data && typeof data.is_program_end_ready === 'boolean' && Array.isArray(data.ga_reports);
  };

  const isGAArray = (data: any): data is GAReportItem[] => {
    return Array.isArray(data);
  };

  const getGAItems = (): GAReportItem[] => {
    if (isBatchGAReportResponse(gaReportData)) {
      return gaReportData.ga_reports;
    } else if (isGAArray(gaReportData)) {
      return gaReportData;
    }
    return [];
  };

  const getIsProgramEndReady = (): boolean => {
    if (isBatchGAReportResponse(gaReportData)) {
      return gaReportData.is_program_end_ready;
    }
    return false;
  };

  // --- Effects ---
  useEffect(() => {
    fetchCloData();
    fetchGaBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchGaReport();
    }
  }, [selectedBatchId]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">HOD CQI Review</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("clo")}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            activeTab === "clo"
              ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          CLO CQI
        </button>
        <button
          onClick={() => setActiveTab("ga")}
          className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            activeTab === "ga"
              ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          GA CQI
        </button>
      </div>

      {/* CLO CQI Tab */}
      {activeTab === "clo" && (
        <div>
          {cloLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : cloData.length === 0 ? (
            <p className="text-gray-500">No CLO CQI Data Found</p>
          ) : (
            cloData.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-xl shadow mb-4 border"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-red-600 text-lg">
                    {item.clo_display}
                  </h3>
                  <span className={`px-3 py-1 rounded text-white text-sm ${
                    item.status === "approved"
                      ? "bg-green-600"
                      : item.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-500"
                  }`}>
                    {item.status || "pending"}
                  </span>
                </div>
                <p><b>Instructor:</b> {item.instructor_name}</p>
                <p><b>Reason:</b> {item.reason}</p>
                <p><b>Action Plan:</b> {item.action_plan}</p>
                {item.hod_comment && (
                  <p className="text-blue-600 mt-1">
                    <b>HOD Comment:</b> {item.hod_comment}
                  </p>
                )}
                {item.status === "pending" && (
                  <textarea
                    placeholder="Write comment (optional)"
                    className="w-full border p-2 mt-3 rounded"
                    value={cloComments[item.id] || ""}
                    onChange={(e) =>
                      setCloComments({
                        ...cloComments,
                        [item.id]: e.target.value
                      })
                    }
                  />
                )}
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </p>
                {item.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleCloAction(item.id, "approved")}
                      disabled={cloLoadingId === item.id}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
                    >
                      {cloLoadingId === item.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleCloAction(item.id, "rejected")}
                      disabled={cloLoadingId === item.id}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded"
                    >
                      {cloLoadingId === item.id ? "..." : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* GA CQI Tab */}
      {activeTab === "ga" && (
        <div className="space-y-6">
          {/* Batch Selection */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Select Batch</h3>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {gaBatches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>

          {selectedBatchId && (
            <div>
              {gaLoading ? (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ) : !getIsProgramEndReady() ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">GA CQI Not Ready Yet</h3>
                  <p className="text-gray-500">Program end not reached or all courses not finalized</p>
                </div>
              ) : (
                <div>
                  {/* GA CQI List */}
                  <div className="space-y-4">
                    {getGAItems().map((ga: GAReportItem) => (
                      ga.ga_cqi_records && ga.ga_cqi_records.length > 0 && (
                        <div key={ga.ga_code} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          {/* GA Header */}
                          <div
                            className="p-6 flex items-center justify-between cursor-pointer bg-gray-50"
                            onClick={() => toggleGAExpansion(ga.ga_code)}
                          >
                            <div className="flex items-center gap-4">
                              {expandedGAs.includes(ga.ga_code) ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                              <div>
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className="text-xl font-bold text-gray-800">{ga.ga_code}</h4>
                                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(ga.status)}`}>
                                    {getStatusIcon(ga.status)}
                                    {ga.status}
                                  </span>
                                </div>
                                <p className="text-gray-600 font-medium">{ga.ga_title}</p>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">GA Attainment</p>
                              <p className="text-2xl font-black text-gray-900">{ga.ga_attainment?.toFixed(1) ?? '0.0'}%</p>
                              <p className="text-xs text-gray-500">KPI: {ga.kpi_threshold?.toFixed(1) ?? '0.0'}%</p>
                            </div>
                          </div>

                          {expandedGAs.includes(ga.ga_code) && (
                            <div className="border-t border-gray-100 p-6">
                              <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">GA CQI Records</h5>
                              <div className="space-y-4">
                                {ga.ga_cqi_records.map((cqi: GACQIRecord) => (
                                  <div key={cqi.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                    <div className="p-4 flex items-center justify-between bg-gray-50">
                                      <div className="flex items-center gap-3">
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(cqi.status)}`}>
                                          {getStatusIcon(cqi.status)}
                                          {cqi.status}
                                        </span>
                                        <span className="text-sm font-bold text-gray-700">
                                          {cqi.cqi_level} CQI
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleHistory(cqi.id);
                                          }}
                                          className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-medium text-sm"
                                        >
                                          <History size={16} />
                                          History
                                        </button>
                                      </div>
                                    </div>

                                    {/* History */}
                                    {expandedHistory === cqi.id && (
                                      <div className="p-4 border-t border-gray-100">
                                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Submission History</div>
                                        <div className="space-y-3">
                                          {cqi.history && cqi.history.length > 0 ? (
                                            cqi.history.map((history: GACQIResubmissionHistory) => (
                                              <div key={history.id} className="bg-gray-50 p-3 rounded-xl">
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className={`text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(history.status_at_time ?? '')}`}>
                                                    {history.status_at_time}
                                                  </span>
                                                  <span className="text-xs text-gray-500">
                                                    {new Date(history.submitted_at).toLocaleString()}
                                                  </span>
                                                </div>
                                                <div className="text-sm text-gray-600 space-y-1">
                                                  {history.root_cause_snapshot && <div><span className="font-semibold">Root Cause:</span> {history.root_cause_snapshot}</div>}
                                                  {history.remedial_plan_snapshot && <div><span className="font-semibold">Remedial Plan:</span> {history.remedial_plan_snapshot}</div>}
                                                  {history.hod_comment_snapshot && <div><span className="font-semibold">HOD Comment:</span> {history.hod_comment_snapshot}</div>}
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-sm text-gray-500">No history available</div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* CQI Details */}
                                    <div className="p-4 border-t border-gray-100">
                                      {cqi.hod_comment && (
                                        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                          <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare size={16} className="text-amber-600" />
                                            <span className="text-sm font-bold text-amber-700">HOD Comment</span>
                                          </div>
                                          <p className="text-sm text-amber-800">{cqi.hod_comment}</p>
                                        </div>
                                      )}
                                      <div className="mb-4">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Root Cause:</span>
                                        <p className="text-gray-700 mt-1">{cqi.root_cause || 'N/A'}</p>
                                      </div>
                                      <div className="mb-4">
                                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Remedial Plan:</span>
                                        <p className="text-gray-700 mt-1">{cqi.remedial_plan || 'N/A'}</p>
                                      </div>

                                      {/* HOD Actions */}
                                      {cqi.status === 'PENDING' && !cqi.is_locked && isHod && (
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">HOD Comment (for rejection)</label>
                                            <textarea
                                              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700"
                                              rows={2}
                                              placeholder="Enter comment if rejecting"
                                              value={localComment[cqi.id] || ''}
                                              onChange={(e) => setLocalComment({ ...localComment, [cqi.id]: e.target.value })}
                                            />
                                          </div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleApproveCqi(cqi.id)}
                                              disabled={submitting}
                                              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                            >
                                              <CheckCircle size={16} />
                                              Approve
                                            </button>
                                            <button
                                              onClick={() => handleRejectCqi(cqi.id)}
                                              disabled={submitting}
                                              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                            >
                                              <XCircle size={16} />
                                              Send Back
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {cqi.status === 'FULLY_APPROVED' || cqi.is_locked ? (
                                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                                          <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-600" />
                                            <span className="text-sm font-bold text-green-700">Locked - Approved</span>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HODCQI;
