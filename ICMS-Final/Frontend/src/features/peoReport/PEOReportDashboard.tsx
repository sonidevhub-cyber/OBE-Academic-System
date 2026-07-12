import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Chart as ChartJS } from 'chart.js';
import { Download, LoaderCircle, Save } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { downloadPEOReportPDF, getPEOReport, upsertPEOCQI } from './peoReportApi';
import type { PEOReportData } from './types';
import PEOEmploymentAnalytics from './PEOEmploymentAnalytics';
import PEOAttainmentChart from './PEOAttainmentChart';
import PEOCQISection from './PEOCQISection';
import PEOMatrixTable from './PEOMatrixTable';
import PEOQuestionBreakdown from './PEOQuestionBreakdown';

interface PEOReportDashboardProps {
  programId?: string;
  year?: string | number;
  batchId?: string;
  batchName?: string;
}

const PEOReportDashboard: React.FC<PEOReportDashboardProps> = ({
  programId: propProgramId,
  year: propYear,
  batchName,
}) => {
  const params = useParams<{ programId: string; year: string }>();
  const programId = propProgramId || params.programId || '';
  const year = propYear || params.year || '';
  const { currentUser, isSAC } = useAuth();
  const chartRef = useRef<ChartJS<'bar'> | undefined>(undefined);

  const [reportData, setReportData] = useState<PEOReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [cqiDrafts, setCqiDrafts] = useState<Record<string, { identified_weakness: string; corrective_action_plan: string }>>({});
  const [savingPeoId, setSavingPeoId] = useState<string | null>(null);

  const currentRole = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const canDownloadPdf = isSAC || currentRole === 'hod';
  const canManageCQI = currentRole === 'hod';
  const handleAddCQI = (peoId: string) => {
    // TODO: confirm whether Add CQI should open a modal/form or scroll to the PEOCQI section.
    console.log(`Add CQI clicked for ${peoId}`);
  };

  useEffect(() => {
    if (!programId || !year) {
      setLoading(false);
      setError('Program ID and year are required to load the PEO report.');
      return;
    }

    let active = true;
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPEOReport(programId, year);
        if (active) {
          setReportData(data);
        }
      } catch (err) {
        console.error('Failed to load PEO report:', err);
        if (active) {
          setError('Failed to load PEO report.');
          toast.error('Failed to load PEO report');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [programId, year]);

  const triggeredQuestionBreakdowns = useMemo(
    () => reportData?.questionBreakdown ?? [],
    [reportData],
  );

  useEffect(() => {
    if (!reportData) return;

    const draftMap = reportData.cqiSections.reduce<Record<string, { identified_weakness: string; corrective_action_plan: string }>>(
      (acc, section) => {
        acc[section.peoId] = {
          identified_weakness: section.identifiedWeakness || '',
          corrective_action_plan: section.correctiveActionPlan || '',
        };
        return acc;
      },
      {},
    );

    setCqiDrafts((prev) => ({ ...draftMap, ...prev }));
  }, [reportData]);

  const handleDownloadPdf = async () => {
    if (!reportData) {
      toast.error('No report data to export');
      return;
    }

    const chartImage = chartRef.current?.toBase64Image();
    if (!chartImage) {
      toast.error('Chart snapshot is not ready yet');
      return;
    }

    setPdfLoading(true);
    try {
      await downloadPEOReportPDF(
        programId,
        year,
        chartImage.replace(/^data:image\/png;base64,/, ''),
      );
      toast.success('PEO report PDF downloaded');
    } catch (err) {
      console.error('Failed to download PEO report PDF:', err);
      toast.error('Failed to download PEO report PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSaveCqi = async (peoId: string) => {
    const draft = cqiDrafts[peoId];
    if (!draft) {
      toast.error('CQI draft is missing');
      return;
    }

    if (!draft.identified_weakness.trim() || !draft.corrective_action_plan.trim()) {
      toast.error('Please fill both CQI fields');
      return;
    }

    setSavingPeoId(peoId);
    try {
      await upsertPEOCQI(programId, year, peoId, draft);
      toast.success(`CQI saved for ${peoId}`);
    } catch (err) {
      console.error('Failed to save PEO CQI:', err);
      toast.error('Failed to save CQI');
    } finally {
      setSavingPeoId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
        {error || 'No report data available.'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#ffffff_28%,#eef2ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-600">PEO Report</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {batchName || reportData.header.program}
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                {reportData.header.program} · Evaluation Cycle {reportData.header.evaluationCycleYear}
              </p>
            </div>

            {canDownloadPdf ? (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pdfLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </button>
            ) : null}
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Section 1: Employment Status</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Basic information from alumni survey</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Program: {reportData.header.program}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Cycle Year: {reportData.header.evaluationCycleYear}
              </div>
              {batchName ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Batch: {batchName}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-6">
            <PEOEmploymentAnalytics stats={reportData.employmentStats} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Section 2: PEO Attainment</p>
              <h2 className="text-2xl font-black text-slate-900">Main matrix table and attainment chart</h2>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              Target Threshold: {reportData.summary.targetThreshold.toFixed(2)}% · {reportData.summary.overallStatus === 'achieved' ? 'All PEOs achieved' : 'CQI triggered'}
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-800">PEO Attainment Chart</h3>
          <PEOAttainmentChart ref={chartRef} chartData={reportData.summary.chartData} />
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold text-slate-800">Main Matrix Table</h3>
          <PEOMatrixTable
            matrix={reportData.matrix}
            canManageCQI={canManageCQI}
            onAddCQI={handleAddCQI}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold text-slate-800">Detailed Question-Wise Analysis</h3>
          <PEOQuestionBreakdown breakdowns={triggeredQuestionBreakdowns} matrix={reportData.matrix} />
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold text-slate-800">CQI Section</h3>
          <PEOCQISection sections={reportData.cqiSections} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-800">CQI Form</h3>
            <p className="text-sm text-slate-500">Fill and save the CQI action plan from this same report screen.</p>
          </div>

          <div className="space-y-4">
            {reportData.matrix
              .filter((row) => row.status === 'CQI Triggered')
              .map((row) => {
                const draft = cqiDrafts[row.peoId] || {
                  identified_weakness: '',
                  corrective_action_plan: '',
                };

                return (
                  <div key={row.peoId} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">{row.peoId}</p>
                        <h4 className="mt-1 text-xl font-black text-slate-900">{row.description}</h4>
                      </div>
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        CQI Triggered
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Identified Weakness</label>
                        <textarea
                          value={draft.identified_weakness}
                          onChange={(e) =>
                            setCqiDrafts((prev) => ({
                              ...prev,
                              [row.peoId]: {
                                ...draft,
                                identified_weakness: e.target.value,
                              },
                            }))
                          }
                          className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
                          placeholder="Write the weakness that triggered CQI..."
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">Corrective Action Plan</label>
                        <textarea
                          value={draft.corrective_action_plan}
                          onChange={(e) =>
                            setCqiDrafts((prev) => ({
                              ...prev,
                              [row.peoId]: {
                                ...draft,
                                corrective_action_plan: e.target.value,
                              },
                            }))
                          }
                          className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
                          placeholder="Write the remedial action plan..."
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-500">
                        This CQI entry will be saved for the current program and evaluation year.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSaveCqi(row.peoId)}
                        disabled={savingPeoId === row.peoId}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingPeoId === row.peoId ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save CQI
                      </button>
                    </div>
                  </div>
                );
              })}

            {reportData.matrix.filter((row) => row.status === 'CQI Triggered').length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
                No CQI form is required because every PEO has achieved the target.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">Signatures</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Generated By</p>
              <p className="mt-2 font-semibold text-slate-900">{reportData.signatures.generatedBy}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved By HOD</p>
              <p className="mt-2 font-semibold text-slate-900">
                {reportData.signatures.hodApprovedBy && reportData.signatures.hodApprovedDate
                  ? `${reportData.signatures.hodApprovedBy} on ${reportData.signatures.hodApprovedDate}`
                  : 'Pending HOD Approval'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PEOReportDashboard;
