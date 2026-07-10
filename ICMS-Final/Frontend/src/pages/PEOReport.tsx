import React, { useState, useEffect, useMemo } from 'react';
import obeService, { Batch } from '../api/obeService';
import peoService, { PEOReportItem } from '../api/peoService';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';

const PEOReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [report, setReport] = useState<PEOReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedPEO, setExpandedPEO] = useState<string | null>(null);

  const graduatedBatches = useMemo(() => {
    return batches.filter((batch) => {
      const graduationStatus = batch.graduation_status;
      return (
        graduationStatus === 'graduated_complete' ||
        Boolean(batch.graduated_at) ||
        batch.is_alumni_feedback_eligible
      );
    });
  }, [batches]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await obeService.getAlumniFeedbackBatches();
        setBatches(data);
      } catch (error) {
        console.error('Failed to fetch batches:', error);
      }
    };
    fetchBatches();
  }, []);

  useEffect(() => {
    if (graduatedBatches.length === 0) {
      setSelectedBatch('');
      return;
    }

    const stillAvailable = graduatedBatches.some((batch) => batch.id === selectedBatch);
    if (!stillAvailable) {
      setSelectedBatch(graduatedBatches[0].id);
    }
  }, [graduatedBatches, selectedBatch]);

  useEffect(() => {
    if (!selectedBatch) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await peoService.getPEOReports(selectedBatch);
        setReport(data);
      } catch (error) {
        console.error('Failed to fetch PEO report:', error);
        toast.error('Failed to load PEO report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedBatch]);

  const getStatus = (score: number | null, kpi: number) => {
    if (score === null) return 'NOT_ASSESSED';
    return score >= kpi ? 'ACHIEVED' : 'BELOW_TARGET';
  };

  const handleExport = () => {
    if (report.length === 0) {
      toast.error('No report data to export');
      return;
    }
    const selectedBatchObj = batches.find(b => b.id === selectedBatch);
    const wb = XLSX.utils.book_new();

    // --- Summary Sheet ---
    const summaryHeaderRows: any[][] = [
      [selectedBatchObj?.program?.name || 'Program Name'],
      ['Department: ' + (selectedBatchObj?.program?.department || 'Computer Science')],
      ['Batch: ' + (selectedBatchObj?.name || 'Selected Batch')],
      ['PEO Attainment Summary Report'],
      ['Date: ' + new Date().toLocaleDateString()],
      [],
      []
    ];

    const summaryData: any[] = [...summaryHeaderRows];
    summaryData.push([
      'PEO Code',
      'PEO Title',
      'Direct Score',
      'Indirect Score',
      'Final Score',
      'KPI Threshold',
      'Status'
    ]);

    const statusIndices: number[] = [];
    report.forEach(peo => {
      statusIndices.push(summaryData.length);
      summaryData.push([
        peo.peo_code,
        peo.peo_title,
        peo.direct_score !== null ? `${peo.direct_score.toFixed(1)}%` : '—',
        peo.indirect_score !== null ? `${peo.indirect_score.toFixed(1)}%` : '—',
        peo.final_score !== null ? `${peo.final_score.toFixed(1)}%` : '0.0%',
        (selectedBatchObj?.program?.peos?.find((p: any) => p.order_number.toString() === peo.peo_code.replace('PEO-', ''))?.kpi_threshold ?? 0).toFixed(1) + '%',
        getStatus(peo.final_score, 60)
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }
    ];
    ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, 'PEO Summary');

    const filename = `PEO_Report_${selectedBatchObj?.name?.replace(/\s+/g, '_') || 'Selected_Batch'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success('Report exported successfully');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">PEO Attainment Report</h1>
          <p className="text-slate-500 font-medium mt-1">
            {graduatedBatches.find(b => b.id === selectedBatch)?.name || 'Select a graduated batch'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={!report.length}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            Export Report
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Batch:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {graduatedBatches.length === 0 ? (
                <option value="" disabled>No graduated batches available</option>
              ) : (
                graduatedBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>{batch.name}</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {!loading && graduatedBatches.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          No graduated or alumni batches found yet.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {!loading && report.length > 0 && (
        <div className="space-y-8">
          {/* PEO Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {report.map(peo => {
              const isExpanded = expandedPEO === peo.peo_id;
              const kpi = 60;
              const status = getStatus(peo.final_score, kpi);

              return (
                <div
                  key={peo.peo_id}
                  className={`bg-white rounded-[24px] shadow-sm border transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-500 border-transparent shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
                >
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedPEO(isExpanded ? null : peo.peo_id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800">
                        {peo.peo_code} — {peo.peo_title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${status === 'ACHIEVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'}`}
                      >
                        {status === 'ACHIEVED' ? 'Achieved ✅' : 'Below Target ❌'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Direct Score</div>
                        <div className="text-xl font-bold text-slate-700">
                          {peo.direct_score !== null ? `${peo.direct_score.toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Indirect Score</div>
                        <div className="text-xl font-bold text-slate-700">
                          {peo.indirect_score !== null ? `${peo.indirect_score.toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="relative pt-2 pb-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">
                          Final Attainment: {peo.final_score !== null ? `${peo.final_score.toFixed(1)}%` : 'N/A'}
                        </span>
                        <span className="text-indigo-600">KPI: {kpi}%</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        {peo.final_score !== null && (
                          <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${status === 'ACHIEVED' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(peo.final_score, 100)}%` }}
                          />
                        )}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 z-10"
                          style={{ left: `${kpi}%` }}
                          title={`KPI: ${kpi}%`}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      {peo.formula_applied === 'direct_only' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                          100% Direct (Indirect Pending)
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[24px]">
                      <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">
                        Contributing GAs
                      </h4>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                                GA Code
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                GA Title
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                GA Score
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                Weight
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {peo.contributing_gas.map(ga => (
                              <tr key={ga.ga_id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-slate-700">
                                  {ga.ga_code}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {ga.ga_title}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-sm font-black text-indigo-600">
                                    {ga.ga_score.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-sm font-bold text-slate-700">
                                    {ga.weight.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PEOReport;
