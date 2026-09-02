import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { Chart as ChartJS } from 'chart.js';
import { Download, LoaderCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { getPEOReport } from './peoReportApi';
import type { PEOReportData } from './types';
import PEOEmploymentAnalytics from './PEOEmploymentAnalytics';
import PEOAttainmentChart from './PEOAttainmentChart';
import PEOMatrixTable from './POReportMatrixTable';
import PEOEmployerComments from './PEOEmployerComments';

interface PEOReportDashboardProps {
  programId?: string;
  year?: string | number;
  batchId?: string;
  batchName?: string;
}

const PEOReportDashboard: React.FC<PEOReportDashboardProps> = ({
  programId: propProgramId,
  year: propYear,
  batchId: propBatchId,
  batchName,
}) => {
  const params = useParams<{ programId: string; year: string }>();
  const programId = propProgramId || params.programId || '';
  const year = propYear || params.year || '';
  const batchId = propBatchId || '';
  const { currentUser, isSAC } = useAuth();
  const chartRef = useRef<ChartJS<'bar'> | undefined>(undefined);

  const [reportData, setReportData] = useState<PEOReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const currentRole = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
  const canDownloadPdf = isSAC || currentRole === 'hod';

  const getCqiSectionsForPdf = () => {
    if (!reportData) return [];
    if (reportData.cqiSections?.length) return reportData.cqiSections;

    return reportData.matrix
      .filter((row) => row.status === 'CQI Triggered' || row.cqiRecordId)
      .map((row, index) => ({
        peoId: row.peoCode || `PO-${index + 1}`,
        rootCause: row.rootCause || null,
        cqiStatus:
          row.cqiStatus === 'APPROVED' || row.cqiStatus === 'CLOSED_IMPLEMENTED' || row.cqiIsLocked
            ? 'Closed'
            : 'Open',
        hodApprovedBy: reportData.signatures.hodApprovedBy,
        hodApprovedDate: reportData.signatures.hodApprovedDate,
        cqiPending: !row.rootCause,
        implementedInBatch: row.implementedInBatch || null,
        actionTaken: row.actionTaken || null,
      }));
  };

  const generatePdfLocally = (chartImage: string) => {
    const cqiSections = getCqiSectionsForPdf();
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 12;
    const generatedAt = new Date().toLocaleString();
    const chartWidth = pageWidth - marginX * 2;
    const chartHeight = 78;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('PO CQI Advisory Export', pageWidth / 2, 14, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(
      `${reportData?.header.program || 'N/A'} | Evaluation Cycle ${reportData?.header.evaluationCycleYear || year}`,
      marginX,
      22
    );
    pdf.text(`Department: ${reportData?.header.department || 'N/A'}`, marginX, 28);
    pdf.text(`Generated on: ${generatedAt}`, marginX, 34);

    const targetThreshold = reportData?.summary.targetThreshold?.toFixed(2) || '0.00';
    const overallStatus =
      reportData?.summary.overallStatus === 'achieved' ? 'All POs achieved' : 'CQI required';

    pdf.setFont('helvetica', 'bold');
    pdf.text(`Target Threshold: ${targetThreshold}%`, pageWidth - marginX, 22, { align: 'right' });
    pdf.text(`Status: ${overallStatus}`, pageWidth - marginX, 28, { align: 'right' });
    const alumniN = reportData?.header.totalAlumniSurveyResponses ?? 0;
    const employerN = reportData?.header.totalEmployerSurveyResponses ?? 0;
    pdf.text(
      `Responses: Alumni ${alumniN} / Employer ${employerN} = ${reportData?.header.totalSurveyResponses || 0}`,
      pageWidth - marginX, 34, { align: 'right' }
    );

    const chartY = 40;
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(marginX, chartY, chartWidth, chartHeight, 3, 3, 'S');
    pdf.addImage(chartImage, 'PNG', marginX + 2, chartY + 2, chartWidth - 4, chartHeight - 4);

    autoTable(pdf, {
      startY: chartY + chartHeight + 8,
      head: [[
        'PO',
        'Description',
        'Mapped Questions',
        'Direct %',
        'Indirect %',
        'Final %',
        'Target %',
        'Status',
      ]],
      body: reportData?.matrix.map((row, index) => [
        row.peoCode || `PO-${index + 1}`,
        row.description,
        row.mappedQuestions.length > 0 ? row.mappedQuestions.join('\n') : 'No mapped questions',
        row.directPercentage === null ? 'Unavailable' : `${row.directPercentage.toFixed(2)}%`,
        row.indirectPercentage === null ? 'Unavailable' : `${row.indirectPercentage.toFixed(2)}%`,
        row.combinedAttainmentPercentage === null ? 'Unavailable' : `${row.combinedAttainmentPercentage.toFixed(2)}%`,
        `${row.targetPercentage.toFixed(2)}%`,
        row.status === 'Achieved' ? 'Achieved' : 'Not Achieved',
      ]) || [],
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
        0: { cellWidth: 18 },
        1: { cellWidth: 40 },
        2: { cellWidth: 58 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 24, halign: 'center' },
      },
      margin: { left: marginX, right: marginX, bottom: 12 },
    });

    autoTable(pdf, {
      startY: (pdf as any).lastAutoTable?.finalY ? (pdf as any).lastAutoTable.finalY + 8 : pageHeight - 60,
      head: [[
        'PO',
        'CQI Status',
        'Identified Weakness',
        'Implemented On',
        'Action Taken',
        'Approved By',
        'Approved Date',
      ]],
      body: cqiSections.length
        ? cqiSections.map((section) => [
            section.peoId,
            section.cqiStatus,
            section.rootCause || 'Pending HOD submission',
            section.implementedInBatch || '-',
            section.actionTaken || '-',
            section.hodApprovedBy || 'Pending HOD approval',
            section.hodApprovedDate || '-',
          ])
        : [['-', 'No CQI records', 'No CQI records are available yet for this cycle.', '-', '-', '-', '-']],
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
        0: { cellWidth: 20 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 58 },
        3: { cellWidth: 26 },
        4: { cellWidth: 42 },
        5: { cellWidth: 28 },
        6: { cellWidth: 30 },
      },
      margin: { left: marginX, right: marginX, bottom: 12 },
    });

    pdf.save(`po-cqi-advisory-${reportData?.header.program || 'po'}-${reportData?.header.evaluationCycleYear || year}.pdf`);
  };

  useEffect(() => {
    if (!programId || !year) {
      setLoading(false);
      return;
    }

    let active = true;
    const loadReport = async () => {
      setLoading(true);
      try {
        const data = await getPEOReport(programId, year, batchId);
        if (active) {
          setReportData(data);
        }
      } catch (err) {
        console.error('Failed to load PO report:', err);
        toast.error('Failed to load PO report');
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
  }, [programId, year, batchId]);

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

    const cqiSections = getCqiSectionsForPdf();
    const missingActionPlan = cqiSections.some(
      (section) => section.cqiPending && !section.rootCause
    );

    if (missingActionPlan) {
      toast.error('Please fill in the root cause for the triggered CQI records before exporting.');
      return;
    }

    setPdfLoading(true);
    try {
      generatePdfLocally(chartImage);
      toast.success('PO report PDF downloaded');
    } catch (err) {
      console.error('Failed to download PO report PDF:', err);
      toast.error('Failed to download PO report PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="h-12 w-12 animate-spin mx-auto mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-xl font-bold text-gray-600">Generating report...</p>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
        No report data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with download button */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 mb-2">PO Report</p>
          <h1 className="text-2xl font-black text-gray-900">{batchName || reportData.header.program}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {reportData.header.program} • Evaluation Cycle {reportData.header.evaluationCycleYear}
          </p>
        </div>
        
        {canDownloadPdf && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
          >
            {pdfLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        )}
      </div>

      {/* Indirect weights banner */}
      {(() => {
        const alumniWeight = reportData.indirectWeightConfig?.alumniWeight ?? 50;
        const employerWeight = reportData.indirectWeightConfig?.employerWeight ?? 50;
        const isFixed = !reportData.indirectWeightConfig || (alumniWeight === 50 && employerWeight === 50);
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-5 py-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-1">
                Alumni Survey
              </div>
              <div className="text-2xl font-black text-indigo-800">
                {reportData.header.totalAlumniSurveyResponses ?? 0}
                <span className="ml-2 text-sm font-bold text-indigo-500">
                  {alumniWeight.toFixed(0)}% weight
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-5 py-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-1">
                Employer Survey
              </div>
              <div className="text-2xl font-black text-emerald-800">
                {reportData.header.totalEmployerSurveyResponses ?? 0}
                <span className="ml-2 text-sm font-bold text-emerald-600">
                  {employerWeight.toFixed(0)}% weight
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-1">
                Indirect (20%) Combined
                {isFixed && <span className="ml-2 rounded-full bg-slate-900 text-slate-50 px-2 py-0.5 text-[9px]">FIXED 50:50</span>}
              </div>
              <div className="text-2xl font-black text-gray-800">
                {reportData.header.totalSurveyResponses ?? 0}
                <span className="ml-2 text-sm font-bold text-gray-500">total respondents</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Matrix first */}
      <PEOMatrixTable
        matrix={reportData.matrix}
        indirectWeightConfig={reportData.indirectWeightConfig}
      />

      {/* Then chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">PO Attainment</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
            Target Threshold: {reportData.summary.targetThreshold.toFixed(2)}% • {reportData.summary.overallStatus === 'achieved' ? 'All POs achieved' : 'Not All POs achieved'}
          </div>
        </div>
        <PEOAttainmentChart ref={chartRef} chartData={reportData.summary.chartData} />
      </div>

      {/* Then employment analytics */}
      <PEOEmploymentAnalytics stats={reportData.employmentStats} />

      <PEOEmployerComments comments={reportData.employerComments || []} />
    </div>
  );
};

export default PEOReportDashboard;
