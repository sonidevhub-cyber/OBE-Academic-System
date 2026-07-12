import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, History, Save } from 'lucide-react';

import authService from '../../api/authService';
import obeService, { Batch } from '../../api/obeService';
import peoService, { PEOCQIRecord, PEOCQISubmissionHistory, PEOReportItem } from '../../api/peoService';

const HODPEOCQI: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [peoReports, setPeoReports] = useState<PEOReportItem[]>([]);
  const [peoCqiRecords, setPeoCqiRecords] = useState<PEOCQIRecord[]>([]);
  const [expandedPeos, setExpandedPeos] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [localCqiData, setLocalCqiData] = useState<Record<string, { root_cause: string; remedial_plan: string }>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const currentAuth = authService.getCurrentUser();
  const isHOD = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  const alumniBatches = useMemo(
    () =>
      batches
        .filter((batch) => batch.is_alumni_feedback_eligible || batch.status === 'graduated')
        .sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''))),
    [batches]
  );

  const activeBatch = alumniBatches.find((batch) => batch.id === selectedBatchId) || alumniBatches[0];

  const fetchBatches = async () => {
    try {
      const data = await obeService.getAlumniFeedbackBatches();
      setBatches(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load alumni batches');
    }
  };

  const fetchData = async (batchId: string) => {
    if (!batchId) return;
    setLoading(true);
    try {
      const [reports, cqis] = await Promise.all([
        peoService.getPEOReports(batchId),
        peoService.getPEOCQIRecords(batchId),
      ]);
      setPeoReports(reports);
      setPeoCqiRecords(cqis);

      setLocalCqiData((prev) => {
        const next = { ...prev };
        cqis.forEach((record) => {
          next[record.id] = {
            root_cause: record.root_cause || '',
            remedial_plan: record.remedial_plan || '',
          };
        });
        return next;
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to load PEO data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

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

  useEffect(() => {
    if (!selectedBatchId) return;
    fetchData(selectedBatchId);
  }, [selectedBatchId]);

  const togglePeoExpansion = (peoId: string) => {
    setExpandedPeos((prev) =>
      prev.includes(peoId) ? prev.filter((id) => id !== peoId) : [...prev, peoId]
    );
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory((prev) => (prev === cqiId ? null : cqiId));
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700';
    if (status === 'DRAFT') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'APPROVED') return <CheckCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
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
      setPeoCqiRecords((prev) => [newCqi, ...prev]);
      setExpandedPeos((prev) => (prev.includes(peoReport.peo_id) ? prev : [...prev, peoReport.peo_id]));
      toast.success('PEO CQI record created');
      await fetchData(selectedBatchId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCqi = (cqiId: string, field: 'root_cause' | 'remedial_plan', value: string) => {
    setLocalCqiData((prev) => ({
      ...prev,
      [cqiId]: {
        root_cause: prev[cqiId]?.root_cause || '',
        remedial_plan: prev[cqiId]?.remedial_plan || '',
        [field]: value,
      },
    }));
  };

  const handleSaveCqi = async (cqiId: string) => {
    try {
      setSavingId(cqiId);
      const data = localCqiData[cqiId] || { root_cause: '', remedial_plan: '' };
      await peoService.updatePEOCQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan,
      });
      toast.success('PEO CQI saved');
      await fetchData(selectedBatchId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save CQI');
    } finally {
      setSavingId(null);
    }
  };

  const handleSubmitCqi = async (cqiId: string) => {
    try {
      setSavingId(cqiId);
      await peoService.submitPEOCQI(cqiId);
      toast.success('PEO CQI submitted and approved');
      await fetchData(selectedBatchId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit CQI');
    } finally {
      setSavingId(null);
    }
  };

  const getCqiRecordForPeo = (peoId: string) =>
    peoCqiRecords.find((record) => record.peo === peoId || record.peo_id === peoId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">PEO CQI Advisory Export</p>
            <h2 className="mt-2 text-2xl font-black text-gray-900">PEO CQI review and action plan</h2>
            <p className="mt-2 text-sm text-gray-500">
              Select an alumni batch to review PEO attainment and manage CQI in the same GA-style layout.
            </p>
          </div>

          <div className="min-w-[300px]">
            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
              Select Alumni Batch
            </label>
            <select
              className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-indigo-500 focus:ring-0"
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
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 mb-6">CQI Advisory Export</h2>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            Batch: {activeBatch?.name || 'Select alumni batch'}
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            Total PEOs: {peoReports.length}
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            CQI Records: {peoCqiRecords.length}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-600">Loading records...</p>
        </div>
      )}

      {!loading && selectedBatchId && peoReports.length === 0 && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No PEO records for this batch</h3>
          <p className="text-gray-600">All PEOs met their targets.</p>
        </div>
      )}

      {!loading && peoReports.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    PEO Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    PEO Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Direct Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Indirect Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Final Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    CQI Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Approved On
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {peoReports.map((peoReport) => {
                  const existingCqi = getCqiRecordForPeo(peoReport.peo_id);
                  const isExpanded = expandedPeos.includes(peoReport.peo_id);
                  const kpi = 60;
                  const needsCqi = peoReport.final_score !== null && peoReport.final_score < kpi;
                  const draft = localCqiData[existingCqi?.id || ''] || {
                    root_cause: existingCqi?.root_cause || '',
                    remedial_plan: existingCqi?.remedial_plan || '',
                  };

                  return (
                    <React.Fragment key={peoReport.peo_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">{peoReport.peo_code}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{peoReport.peo_title}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{peoReport.direct_score?.toFixed(1) ?? '—'}%</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{peoReport.indirect_score?.toFixed(1) ?? '—'}%</td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-900">{peoReport.final_score?.toFixed(1) ?? '0.0'}%</td>
                        <td className="px-4 py-4">
                          {existingCqi ? (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadge(existingCqi.status)}`}>
                              {getStatusIcon(existingCqi.status)}
                              {existingCqi.status}
                            </span>
                          ) : needsCqi ? (
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-700">
                              Needs CQI
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">
                              Achieved
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {existingCqi?.updated_at
                            ? new Date(existingCqi.updated_at).toLocaleDateString()
                            : existingCqi?.created_at
                              ? new Date(existingCqi.created_at).toLocaleDateString()
                              : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePeoExpansion(peoReport.peo_id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {isExpanded ? 'Hide' : 'Open'}
                            </button>
                            {!existingCqi && needsCqi ? (
                              <button
                                type="button"
                                onClick={() => handleCreateCqi(peoReport)}
                                disabled={submitting}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                <Save className="h-4 w-4" />
                                Create
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && existingCqi ? (
                        <tr>
                          <td colSpan={8} className="bg-gray-50/70 p-0">
                            <div className="grid gap-4 p-5 lg:grid-cols-2">
                              <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Root Cause</p>
                                <textarea
                                  value={draft.root_cause}
                                  onChange={(e) => handleUpdateCqi(existingCqi.id, 'root_cause', e.target.value)}
                                  className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-indigo-500"
                                  rows={4}
                                  placeholder="Describe the root cause..."
                                  disabled={existingCqi.status === 'APPROVED' || existingCqi.is_locked}
                                />
                              </div>
                              <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Remedial Plan</p>
                                <textarea
                                  value={draft.remedial_plan}
                                  onChange={(e) => handleUpdateCqi(existingCqi.id, 'remedial_plan', e.target.value)}
                                  className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-indigo-500"
                                  rows={4}
                                  placeholder="Describe the remedial plan..."
                                  disabled={existingCqi.status === 'APPROVED' || existingCqi.is_locked}
                                />
                              </div>

                              <div className="lg:col-span-2 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadge(existingCqi.status)}`}>
                                      {getStatusIcon(existingCqi.status)}
                                      {existingCqi.status}
                                    </span>
                                    {existingCqi.history && existingCqi.history.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleHistory(existingCqi.id)}
                                        className="inline-flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                                      >
                                        <History className="h-4 w-4" />
                                        History
                                      </button>
                                    ) : null}
                                  </div>

                                  {existingCqi.status !== 'APPROVED' && !existingCqi.is_locked && isHOD ? (
                                    <div className="flex gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveCqi(existingCqi.id)}
                                        disabled={savingId === existingCqi.id}
                                        className="rounded-xl bg-gray-700 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        Save Draft
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSubmitCqi(existingCqi.id)}
                                        disabled={savingId === existingCqi.id}
                                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        Submit & Approve
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-sm font-semibold text-gray-500">
                                      {existingCqi.status === 'APPROVED' ? 'Locked - Approved' : 'Awaiting HOD action'}
                                    </div>
                                  )}
                                </div>

                                {expandedHistory === existingCqi.id ? (
                                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                                      Submission History
                                    </div>
                                    <div className="space-y-3">
                                      {existingCqi.history?.map((historyItem: PEOCQISubmissionHistory) => (
                                        <div key={historyItem.id} className="rounded-xl bg-white p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                                              {historyItem.status_at_time}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {new Date(historyItem.submitted_at).toLocaleString()}
                                            </span>
                                          </div>
                                          <div className="text-sm text-gray-600 space-y-1">
                                            {historyItem.root_cause_snapshot ? (
                                              <div><span className="font-semibold">Root Cause:</span> {historyItem.root_cause_snapshot}</div>
                                            ) : null}
                                            {historyItem.remedial_plan_snapshot ? (
                                              <div><span className="font-semibold">Remedial Plan:</span> {historyItem.remedial_plan_snapshot}</div>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODPEOCQI;
