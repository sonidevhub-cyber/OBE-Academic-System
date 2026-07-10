import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import peoService, { PEOCQIRecord, PEOCQISubmissionHistory, PEOReportItem } from "../../api/peoService";
import obeService, { Batch } from "../../api/obeService";
import authService from "../../api/authService";
import { History, CheckCircle, AlertCircle, ChevronRight, ChevronDown, Save } from "lucide-react";

const HODPEOCQI: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [peoReports, setPeoReports] = useState<PEOReportItem[]>([]);
  const [peoCqiRecords, setPeoCqiRecords] = useState<PEOCQIRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPeos, setExpandedPeos] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [localCqiData, setLocalCqiData] = useState<Record<string, { root_cause: string; remedial_plan: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentAuth = authService.getCurrentUser();
  const isHOD = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  const fetchBatches = async () => {
    try {
      const data = await obeService.getAlumniFeedbackBatches();
      setBatches(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load batches");
    }
  };

  const fetchData = async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const [reports, cqis] = await Promise.all([
        peoService.getPEOReports(selectedBatchId),
        peoService.getPEOCQIRecords(selectedBatchId),
      ]);
      setPeoReports(reports);
      setPeoCqiRecords(cqis);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load PEO data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    fetchData();
  }, [selectedBatchId]);

  useEffect(() => {
    if (batches.length === 0) {
      setSelectedBatchId("");
      return;
    }

    const stillAvailable = batches.some(batch => batch.id === selectedBatchId);
    if (!stillAvailable) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const togglePeoExpansion = (peoId: string) => {
    setExpandedPeos(prev =>
      prev.includes(peoId) ? prev.filter(id => id !== peoId) : [...prev, peoId]
    );
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory(prev => prev === cqiId ? null : cqiId);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'DRAFT':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const handleCreateCqi = async (peoReport: PEOReportItem) => {
    try {
      setSubmitting(true);
      const newCqi = await peoService.createPEOCQI({
        peo: peoReport.peo_id,
        batch: selectedBatchId,
        root_cause: '',
        remedial_plan: '',
      });
      toast.success("PEO CQI record created");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create CQI");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCqi = async (cqiId: string, field: string, value: string) => {
    setLocalCqiData(prev => ({
      ...prev,
      [cqiId]: {
        ...prev[cqiId],
        [field]: value,
      }
    }));
  };

  const handleSaveCqi = async (cqiId: string) => {
    try {
      const data = localCqiData[cqiId] || {};
      await peoService.updatePEOCQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan,
      });
      toast.success("PEO CQI saved");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save CQI");
    }
  };

  const handleSubmitCqi = async (cqiId: string) => {
    try {
      await peoService.submitPEOCQI(cqiId);
      toast.success("PEO CQI submitted and approved");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit CQI");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">PEO CQI Review</h2>

      {/* Batch Selection */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Select Batch</h3>
        <select
          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0"
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(e.target.value)}
        >
          <option value="">Select a batch</option>
          {batches.length === 0 ? (
            <option value="" disabled>No alumni batches available</option>
          ) : (
            batches.map(batch => (
              <option key={batch.id} value={batch.id}>{batch.name}</option>
            ))
          )}
        </select>
      </div>

      {!selectedBatchId && batches.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 mb-6">
          No alumni batches available yet.
        </div>
      )}

      {selectedBatchId && (
        <div>
          {loading ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {peoReports.map(peoReport => {
                const existingCqi = peoCqiRecords.find(cqi => cqi.peo === peoReport.peo_id || cqi.peo_id === peoReport.peo_id);
                const isExpanded = expandedPeos.includes(peoReport.peo_id);
                const kpi = 60; // TODO: get actual KPI from PEO data
                const needsCqi = peoReport.final_score !== null && peoReport.final_score < kpi;

                return (
                  <div key={peoReport.peo_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* PEO Header */}
                    <div
                      className="p-6 flex items-center justify-between cursor-pointer bg-gray-50"
                      onClick={() => togglePeoExpansion(peoReport.peo_id)}
                    >
                      <div className="flex items-center gap-4">
                        {isExpanded ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-xl font-bold text-gray-800">{peoReport.peo_code}</h4>
                            {needsCqi && !existingCqi && (
                              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700">
                                Needs CQI
                              </span>
                            )}
                            {existingCqi && (
                              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(existingCqi.status)}`}>
                                {getStatusIcon(existingCqi.status)}
                                {existingCqi.status}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 font-medium">{peoReport.peo_title}</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">PEO Attainment</p>
                        <p className="text-2xl font-black text-gray-900">{peoReport.final_score?.toFixed(1) ?? '0.0'}%</p>
                        <p className="text-xs text-gray-500">KPI: {kpi}%</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-6">
                        {/* PEO Report Details */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                          <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3">PEO Report Details</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Direct Score</p>
                              <p className="text-lg font-bold text-gray-700">{peoReport.direct_score?.toFixed(1) ?? '—'}%</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Indirect Score</p>
                              <p className="text-lg font-bold text-gray-700">{peoReport.indirect_score?.toFixed(1) ?? '—'}%</p>
                            </div>
                          </div>
                          {peoReport.contributing_gas.length > 0 && (
                            <div className="mt-4">
                              <h6 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contributing GAs</h6>
                              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="p-3 border-b border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest">GA Code</th>
                                      <th className="p-3 border-b border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest">GA Title</th>
                                      <th className="p-3 border-b border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest text-center">GA Score</th>
                                      <th className="p-3 border-b border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Weight</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {peoReport.contributing_gas.map(ga => (
                                      <tr key={ga.ga_id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="p-3 font-bold text-gray-700">{ga.ga_code}</td>
                                        <td className="p-3 text-gray-700">{ga.ga_title}</td>
                                        <td className="p-3 text-center">
                                          <span className="text-sm font-bold text-indigo-600">{ga.ga_score.toFixed(1)}%</span>
                                        </td>
                                        <td className="p-3 text-center">
                                          <span className="text-sm font-bold text-gray-700">{ga.weight.toFixed(1)}%</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CQI Section */}
                        {needsCqi || existingCqi ? (
                          <div className="space-y-4">
                            {!existingCqi ? (
                              <button
                                onClick={() => handleCreateCqi(peoReport)}
                                disabled={submitting}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
                              >
                                <Save size={18} />
                                Create PEO CQI
                              </button>
                            ) : (
                              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="p-4 flex items-center justify-between bg-gray-50">
                                  <div className="flex items-center gap-3">
                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase ${getStatusBadgeColor(existingCqi.status)}`}>
                                      {getStatusIcon(existingCqi.status)}
                                      {existingCqi.status}
                                    </span>
                                  </div>
                                  {existingCqi.history && existingCqi.history.length > 0 && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleHistory(existingCqi.id); }}
                                      className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-medium text-sm"
                                    >
                                      <History size={16} />
                                      History
                                    </button>
                                  )}
                                </div>

                                {/* History */}
                                {expandedHistory === existingCqi.id && (
                                  <div className="p-4 border-t border-gray-200">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Submission History</div>
                                    <div className="space-y-3">
                                      {existingCqi.history?.map((historyItem: PEOCQISubmissionHistory) => (
                                        <div key={historyItem.id} className="bg-gray-50 p-3 rounded-xl">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className={`text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(historyItem.status_at_time)}`}>
                                              {historyItem.status_at_time}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {new Date(historyItem.submitted_at).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="text-sm text-gray-600 space-y-1">
                                            {historyItem.root_cause_snapshot && (
                                              <div><span className="font-semibold">Root Cause:</span> {historyItem.root_cause_snapshot}</div>
                                            )}
                                            {historyItem.remedial_plan_snapshot && (
                                              <div><span className="font-semibold">Remedial Plan:</span> {historyItem.remedial_plan_snapshot}</div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* CQI Form */}
                                <div className="p-4 space-y-4">
                                  <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Root Cause</label>
                                    <textarea
                                      value={localCqiData[existingCqi.id]?.root_cause ?? existingCqi.root_cause ?? ''}
                                      onChange={(e) => handleUpdateCqi(existingCqi.id, 'root_cause', e.target.value)}
                                      className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      rows={4}
                                      placeholder="Describe the root cause..."
                                      disabled={existingCqi.status === 'APPROVED' || existingCqi.is_locked}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Remedial Plan</label>
                                    <textarea
                                      value={localCqiData[existingCqi.id]?.remedial_plan ?? existingCqi.remedial_plan ?? ''}
                                      onChange={(e) => handleUpdateCqi(existingCqi.id, 'remedial_plan', e.target.value)}
                                      className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      rows={4}
                                      placeholder="Describe the remedial plan..."
                                      disabled={existingCqi.status === 'APPROVED' || existingCqi.is_locked}
                                    />
                                  </div>

                                  {existingCqi.status !== 'APPROVED' && !existingCqi.is_locked && isHOD && (
                                    <div className="flex gap-3">
                                      <button
                                        onClick={() => handleSaveCqi(existingCqi.id)}
                                        className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                      >
                                        Save Draft
                                      </button>
                                      <button
                                        onClick={() => handleSubmitCqi(existingCqi.id)}
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                      >
                                        Submit & Approve
                                      </button>
                                    </div>
                                  )}

                                  {existingCqi.status === 'APPROVED' && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                      <div className="flex items-center gap-2 text-emerald-700">
                                        <CheckCircle size={16} />
                                        <span className="font-bold">Locked - Approved</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <CheckCircle size={20} />
                              <span className="font-bold">PEO KPI met - no CQI needed</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HODPEOCQI;
