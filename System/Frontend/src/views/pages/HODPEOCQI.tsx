import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  LoaderCircle,
  Save,
  Lock,
  CheckCheck,
} from 'lucide-react';

import authService from '../../api/authService';
import obeService, { Batch } from '../../api/obeService';
import peoService, {
  PEOCQIRecord,
  PEOCQISubmissionHistory,
  PEOReportItem,
} from '../../api/peoService';

const HODPEOCQI: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [peoReports, setPeoReports] = useState<PEOReportItem[]>([]);
  const [peoCqiRecords, setPeoCqiRecords] = useState<PEOCQIRecord[]>([]);
  const [expandedPeos, setExpandedPeos] = useState<string[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [localCqiData, setLocalCqiData] = useState<
    Record<string, { root_cause: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closingCqiId, setClosingCqiId] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({
    implemented_in_batch: '',
    action_taken_description: '',
  });
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const currentAuth = authService.getCurrentUser();
  const isHOD =
    currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';

  const alumniBatches = useMemo(
    () =>
      batches
        .filter(
          (batch) =>
            batch.is_alumni_feedback_eligible || batch.status === 'graduated'
        )
        .sort((a, b) =>
          String(b.name || '').localeCompare(String(a.name || ''))
        ),
    [batches]
  );

  const peoPrograms = useMemo(() => {
    const seen = new Map<string, string>();
    batches.forEach(b => {
      const id = String((b as any).program?.id || (b as any).program_id || '');
      const name = (b as any).program?.name || (b as any).program_name || '';
      if (id && name) seen.set(id, name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [batches]);

  const filteredAlumniBatches = useMemo(
    () => alumniBatches.filter(b => !selectedProgramId || String((b as any).program?.id || (b as any).program_id || '') === selectedProgramId),
    [alumniBatches, selectedProgramId]
  );

  const activeBatch =
    alumniBatches.find((batch) => batch.id === selectedBatchId) ||
    alumniBatches[0];

  const ongoingBatches = useMemo(
    () => batches.filter((batch) => batch.status === 'active'),
    [batches]
  );

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

    const stillAvailable = alumniBatches.some(
      (batch) => batch.id === selectedBatchId
    );
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
    if (status === 'CLOSED_IMPLEMENTED')
      return 'bg-emerald-100 text-emerald-700';
    if (status === 'APPROVED' || status === 'OPEN')
      return 'bg-amber-100 text-amber-700';
    if (status === 'DRAFT') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'CLOSED_IMPLEMENTED')
      return <CheckCheck className="h-4 w-4" />;
    if (status === 'APPROVED') return <CheckCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const canCloseCqi = (record: PEOCQIRecord) => {
    return (
      isHOD &&
      record.status !== 'CLOSED_IMPLEMENTED' &&
      (record.status === 'APPROVED' || record.status === 'OPEN')
    );
  };

  const normalizeMatchValue = (value: unknown) =>
    String(value ?? '').trim().toLowerCase();

  const getPeoRecordKeys = (record: PEOCQIRecord) => [
    record.peo,
    record.peo_id,
    (record as any).peo_uuid,
    (record as any).peoCode,
    record.peo_code,
  ].map(normalizeMatchValue).filter(Boolean);

  const handleCreateCqi = async (peoReport: PEOReportItem) => {
    try {
      setSubmitting(true);
      const newCqi = await peoService.createPEOCQI({
        peo: peoReport.peo_id,
        batch: selectedBatchId,
        root_cause: '',
      });
      setPeoCqiRecords((prev) => [newCqi, ...prev]);
      setExpandedPeos((prev) =>
        prev.includes(peoReport.peo_id) ? prev : [...prev, peoReport.peo_id]
      );
      toast.success('PEO CQI record created');
      await fetchData(selectedBatchId);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCqi = (cqiId: string, value: string) => {
    setLocalCqiData((prev) => ({
      ...prev,
      [cqiId]: {
        root_cause: value,
      },
    }));
  };

  const handleSaveCqi = async (cqiId: string) => {
    try {
      setSavingId(cqiId);
      const data = localCqiData[cqiId] || {
        root_cause: '',
      };
      await peoService.updatePEOCQIRecord(cqiId, {
        root_cause: data.root_cause,
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
      const data = localCqiData[cqiId] || {
        root_cause: '',
      };
      await peoService.updatePEOCQIRecord(cqiId, {
        root_cause: data.root_cause,
      });
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

  const openCloseModal = (cqiId: string) => {
    setClosingCqiId(cqiId);
    setCloseForm({ implemented_in_batch: '', action_taken_description: '' });
    setCloseModalOpen(true);
  };

  const handleCloseCqi = async () => {
    if (!closingCqiId) return;
    if (!closeForm.implemented_in_batch) {
      toast.error('Please select the batch where actions were implemented');
      return;
    }
    if (!closeForm.action_taken_description.trim()) {
      toast.error('Please describe the action taken (mandatory)');
      return;
    }
    setCloseSubmitting(true);
    try {
      await peoService.closePEOCQI(closingCqiId, {
        implemented_in_batch: closeForm.implemented_in_batch,
        action_taken_description: closeForm.action_taken_description.trim(),
      });
      toast.success('PO CQI closed successfully — attainment auto-pulled');
      setCloseModalOpen(false);
      setClosingCqiId(null);
      fetchData(selectedBatchId);
    } catch (error: any) {
      console.error(error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to close CQI';
      toast.error(msg);
    } finally {
      setCloseSubmitting(false);
    }
  };

  const getCqiRecordForPeo = (peoReport: PEOReportItem) => {
    const lookupKeys = [
      peoReport.peo_id,
      peoReport.peo_code,
      (peoReport as any).peo,
      (peoReport as any).id,
    ].map(normalizeMatchValue).filter(Boolean);

    return peoCqiRecords.find((record) =>
      getPeoRecordKeys(record).some((key) => lookupKeys.includes(key))
    );
  };

  const handleDownloadPdf = async () => {
    if (!activeBatch) {
      toast.error('Please select an alumni batch first');
      return;
    }

    setPdfLoading(true);
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const marginX = 12;
      const generatedAt = new Date().toLocaleString();
      const title = 'PO CQI Advisory Export';

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(title, pageWidth / 2, 14, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Batch: ${activeBatch.name || 'N/A'}`, marginX, 22);
      pdf.text(`Generated on: ${generatedAt}`, marginX, 28);
      pdf.text(`Total POs: ${peoReports.length}`, marginX, 34);

      pdf.setFont('helvetica', 'bold');
      pdf.text(`CQI Records: ${peoCqiRecords.length}`, pageWidth - marginX, 22, {
        align: 'right',
      });
      pdf.text(
        `Approved CQIs: ${
          peoCqiRecords.filter(
            (record) =>
              record.status === 'APPROVED' || record.status === 'CLOSED_IMPLEMENTED'
          ).length
        }`,
        pageWidth - marginX,
        28,
        { align: 'right' }
      );
      pdf.text(
        `Pending CQIs: ${
          peoCqiRecords.filter(
            (record) =>
              record.status !== 'APPROVED' && record.status !== 'CLOSED_IMPLEMENTED'
          ).length
        }`,
        pageWidth - marginX,
        34,
        {
          align: 'right',
        }
      );

      autoTable(pdf, {
        startY: 40,
        head: [
          [
            'PO Code',
            'PO Title',
            'Final Score',
            'CQI Status',
            'Approved On',
            'Root Cause',
          ],
        ],
        body: peoReports.length
          ? peoReports.map((peoReport) => {
              const existingCqi = getCqiRecordForPeo(peoReport);
              const needsCqi =
                peoReport.final_score !== null && peoReport.final_score < 60;
              const approvedOn =
                existingCqi?.updated_at || existingCqi?.created_at || '-';
              const draft = localCqiData[existingCqi?.id || ''] || {
                root_cause: existingCqi?.root_cause || '',
              };

              return [
                peoReport.peo_code,
                peoReport.peo_title,
                peoReport.final_score === null
                  ? 'N/A'
                  : `${peoReport.final_score.toFixed(1)}%`,
                existingCqi?.status || (needsCqi ? 'Needs CQI' : 'Achieved'),
                approvedOn === '-'
                  ? '-'
                  : new Date(approvedOn).toLocaleDateString(),
                needsCqi
                  ? draft.root_cause || 'Pending HOD submission'
                  : draft.root_cause || 'Not required',
              ];
            })
          : [['-', 'No PO records available', '-', '-', '-', '-']],
        theme: 'grid',
        styles: {
          fontSize: 6.5,
          cellPadding: 1.5,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 42 },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 24, halign: 'center' },
          5: { cellWidth: 60 },
        },
        margin: { left: marginX, right: marginX, bottom: 12 },
      });

      pdf.save(`po-cqi-advisory-${activeBatch.name || 'batch'}.pdf`);
      toast.success('PO CQI PDF downloaded');
    } catch (error) {
      console.error('Failed to generate PO CQI PDF:', error);
      toast.error('Failed to generate PO CQI PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
              PO CQI Advisory Export
            </p>
            <h2 className="mt-2 text-2xl font-black text-gray-900">
              PO CQI review, action plan, and closing loop
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Select an alumni batch to review PO attainment, manage CQI, and close
              the loop with auto-pulled resulting attainment.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="min-w-[180px]">
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Program</label>
              <select className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-indigo-500 focus:ring-0" value={selectedProgramId} onChange={(e) => { setSelectedProgramId(e.target.value); setSelectedBatchId(""); }}>
                <option value="">All Programs</option>
                {peoPrograms.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Select Alumni Batch</label>
              <select className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-indigo-500 focus:ring-0" value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                <option value="">Select a batch</option>
                {filteredAlumniBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
            </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-black text-gray-900">
            CQI Advisory Export
          </h2>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!activeBatch || loading || pdfLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pdfLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            Batch: {activeBatch?.name || 'Select alumni batch'}
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            Total POs: {peoReports.length}
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
            CQI Records: {peoCqiRecords.length}
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Closed:{' '}
            {
              peoCqiRecords.filter((r) => r.status === 'CLOSED_IMPLEMENTED')
                .length
            }
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
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No PO records for this batch
          </h3>
          <p className="text-gray-600">All POs met their targets.</p>
        </div>
      )}

      {!loading && peoReports.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    PO Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    PO Title
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
                    Resulting At.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {peoReports.map((peoReport) => {
                  const existingCqi = getCqiRecordForPeo(peoReport);
                  const isExpanded = expandedPeos.includes(peoReport.peo_id);
                  const kpi = 60;
                  const needsCqi =
                    peoReport.final_score !== null && peoReport.final_score < kpi;
                  const draft = localCqiData[existingCqi?.id || ''] || {
                    root_cause: existingCqi?.root_cause || '',
                  };

                  return (
                    <React.Fragment key={peoReport.peo_id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                          {peoReport.peo_code}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {peoReport.peo_title}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {peoReport.direct_score?.toFixed(1) ?? '—'}%
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {peoReport.indirect_score?.toFixed(1) ?? '—'}%
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-900">
                          {peoReport.final_score?.toFixed(1) ?? '0.0'}%
                        </td>
                        <td className="px-4 py-4">
                          {existingCqi ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadge(
                                existingCqi.status
                              )}`}
                            >
                              {getStatusIcon(existingCqi.status)}
                              {existingCqi.status === 'CLOSED_IMPLEMENTED'
                                ? 'Closed'
                                : existingCqi.status}
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
                          {existingCqi?.resulting_attainment !== null &&
                          existingCqi?.resulting_attainment !== undefined ? (
                            <div>
                              <span className="font-bold">
                                {Number(
                                  existingCqi.resulting_attainment
                                ).toFixed(1)}
                                %
                              </span>
                              {existingCqi.implemented_in_batch_name && (
                                <div className="text-xs text-gray-500">
                                  Batch: {existingCqi.implemented_in_batch_name}
                                </div>
                              )}
                            </div>
                          ) : existingCqi?.status === 'CLOSED_IMPLEMENTED' ? (
                            '—'
                          ) : existingCqi ? (
                            <span className="text-gray-400 text-xs italic">
                              Pending close
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePeoExpansion(peoReport.peo_id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
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
                            {existingCqi && canCloseCqi(existingCqi) && (
                              <button
                                type="button"
                                onClick={() => openCloseModal(existingCqi.id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
                              >
                                <CheckCheck className="h-4 w-4" />
                                Close
                              </button>
                            )}
                            {existingCqi?.status === 'CLOSED_IMPLEMENTED' && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500">
                                <Lock className="h-3.5 w-3.5" />
                                Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr>
                          <td colSpan={8} className="bg-gray-50/70 p-0">
                            {existingCqi ? (
                              <div className="grid gap-4 p-5 lg:grid-cols-2">
                                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                    Root Cause
                                  </p>
                                  <textarea
                                    value={draft.root_cause}
                                    onChange={(e) =>
                                      handleUpdateCqi(
                                        existingCqi.id,
                                        e.target.value
                                      )
                                    }
                                    className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-indigo-500"
                                    rows={4}
                                    placeholder="Describe the root cause..."
                                    disabled={
                                      existingCqi.status === 'APPROVED' ||
                                      existingCqi.status === 'CLOSED_IMPLEMENTED' ||
                                      existingCqi.is_locked
                                    }
                                  />
                                </div>

                                {existingCqi.status === 'CLOSED_IMPLEMENTED' && (
                                <>
                                  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                      Action Taken Description
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {existingCqi.action_taken_description || '—'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                                      Closing Details
                                    </p>
                                    <div className="space-y-1 text-sm text-gray-700">
                                      <div>
                                        <span className="font-semibold">
                                          Implemented in:
                                        </span>{' '}
                                        {existingCqi.implemented_in_batch_name ||
                                          existingCqi.implemented_in_batch ||
                                          '—'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Resulting attainment:
                                        </span>{' '}
                                        {existingCqi.resulting_attainment !== null &&
                                        existingCqi.resulting_attainment !==
                                          undefined
                                          ? `${Number(
                                              existingCqi.resulting_attainment
                                            ).toFixed(1)}% (auto-calculated)`
                                          : '—'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Closed by:
                                        </span>{' '}
                                        {existingCqi.closed_by_name ||
                                          existingCqi.closed_by ||
                                          '—'}
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Closed on:
                                        </span>{' '}
                                        {existingCqi.closed_at
                                          ? new Date(
                                              existingCqi.closed_at
                                            ).toLocaleString()
                                          : '—'}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="lg:col-span-2 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadge(
                                        existingCqi.status
                                      )}`}
                                    >
                                      {getStatusIcon(existingCqi.status)}
                                      {existingCqi.status === 'CLOSED_IMPLEMENTED'
                                        ? 'Closed'
                                        : existingCqi.status}
                                    </span>
                                    {existingCqi.history &&
                                    existingCqi.history.length > 0 ? (
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

                                  {existingCqi.status !== 'APPROVED' &&
                                  existingCqi.status !== 'CLOSED_IMPLEMENTED' &&
                                  !existingCqi.is_locked &&
                                  isHOD ? (
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
                                        onClick={() =>
                                          handleSubmitCqi(existingCqi.id)
                                        }
                                        disabled={savingId === existingCqi.id}
                                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        Submit & Approve
                                      </button>
                                    </div>
                                  ) : existingCqi.status === 'APPROVED' ? (
                                    <div className="text-sm font-semibold text-amber-600">
                                      Approved — use Close to complete the loop
                                    </div>
                                  ) : (
                                    <div className="text-sm font-semibold text-gray-500">
                                      {existingCqi.status === 'CLOSED_IMPLEMENTED'
                                        ? 'Locked — Closed'
                                        : 'Awaiting HOD action'}
                                    </div>
                                  )}
                                </div>

                                {expandedHistory === existingCqi.id ? (
                                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                                      Submission History
                                    </div>
                                    <div className="space-y-3">
                                      {existingCqi.history?.map(
                                        (historyItem: PEOCQISubmissionHistory) => (
                                          <div
                                            key={historyItem.id}
                                            className="rounded-xl bg-white p-3"
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                                                {historyItem.status_at_time}
                                              </span>
                                              <span className="text-xs text-gray-500">
                                                {new Date(
                                                  historyItem.submitted_at
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="text-sm text-gray-600 space-y-1">
                                              {historyItem.root_cause_snapshot ? (
                                                <div>
                                                  <span className="font-semibold">
                                                    Root Cause:
                                                  </span>{' '}
                                                  {historyItem.root_cause_snapshot}
                                                </div>
                                                ) : null}
                                              </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              </div>
                            ) : (
                              <div className="p-5">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                  {needsCqi
                                    ? 'CQI action plan not yet submitted by HOD. Create the CQI record to enter identified weakness and corrective action plan.'
                                    : 'No CQI action is required for this PO because the target is achieved.'}
                                </div>
                              </div>
                            )}
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

      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    Close PO CQI — Complete the Loop
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Mandatory documentation — applies whether target was met or not.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
                  Implementation Batch <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 transition-all focus:border-emerald-500 focus:ring-0"
                  value={closeForm.implemented_in_batch}
                  onChange={(e) =>
                    setCloseForm((prev) => ({
                      ...prev,
                      implemented_in_batch: e.target.value,
                    }))
                  }
                >
                  <option value="">
                    Select the batch where actions were implemented
                  </option>
                  {ongoingBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
                  Action Taken Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-emerald-500"
                  rows={6}
                  placeholder="Describe the corrective actions implemented — curriculum changes, industry linkages, alumni engagement improvements, teaching enhancements, etc."
                  value={closeForm.action_taken_description}
                  onChange={(e) =>
                    setCloseForm((prev) => ({
                      ...prev,
                      action_taken_description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-1">
                  Resulting Attainment
                </p>
                <p className="text-sm text-amber-800">
                  Automatically pulled from the{' '}
                  <span className="font-bold">
                    calculated cumulative PO attainment
                  </span>{' '}
                  for the implementation batch. Not editable.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCloseModalOpen(false);
                  setClosingCqiId(null);
                }}
                disabled={closeSubmitting}
                className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseCqi}
                disabled={closeSubmitting}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-70 disabled:cursor-not-allowed"
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

export default HODPEOCQI;
