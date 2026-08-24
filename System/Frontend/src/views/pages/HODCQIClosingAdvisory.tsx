import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import ExportChoiceModal from '../../components/reports/ExportChoiceModal';
import obeService, {
  Batch,
  CQIClosingSummaryResponse,
  GACQIClosingSummaryItem,
  PEOCQIClosingSummaryItem,
  VisionMissionCQIClosingSummaryItem,
  VisionMissionReviewSummaryItem,
} from '../../api/obeService';
import {
  FileCheck,
  BarChart3,
  Eye,
  ShieldCheck,
  RefreshCw,
  Download,
  LoaderCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  FileText,
  TrendingUp,
  AlertCircle,
  Target,
  CheckCheck,
  Zap,
  Award,
  BookOpen,
} from 'lucide-react';

type SectionKey = 'ga' | 'po' | 'vm-cqi' | 'vm';

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : `${Number(value).toFixed(1)}%`;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : '-';

const AttainmentChip = ({
  attained,
  value,
  kpi,
}: {
  attained: boolean | null | undefined;
  value: number | null;
  kpi: number | null;
}) => {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">
        -
      </span>
    );
  }
  const met =
    attained !== null && attained !== undefined
      ? attained
      : kpi !== null && kpi !== undefined
        ? value >= kpi
        : null;
  const color =
    met === true
      ? 'bg-emerald-100 text-emerald-700'
      : met === false
        ? 'bg-rose-100 text-rose-700'
        : 'bg-gray-100 text-gray-600';
  const icon =
    met === true ? (
      <CheckCircle className="w-3 h-3" />
    ) : met === false ? (
      <XCircle className="w-3 h-3" />
    ) : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${color}`}
    >
      {icon}
      {Number(value).toFixed(1)}%
      {kpi !== null && kpi !== undefined && (
        <span className="opacity-70 font-bold"> / {kpi}%</span>
      )}
    </span>
  );
};

const OutcomeChip = ({
  decision,
}: {
  decision: 'RETAINED' | 'REVISED' | string;
}) => {
  const revised = decision === 'REVISED';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
        revised
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {revised ? <BookOpen className="w-3 h-3" /> : <CheckCheck className="w-3 h-3" />}
      {decision}
    </span>
  );
};

const HODCQIClosingAdvisory: React.FC = () => {
  const [data, setData] = useState<CQIClosingSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<SectionKey | 'ALL'>('ALL');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportBatchId, setExportBatchId] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchData = async (showToast = false) => {
    if (showToast) setRefreshing(true);
    else setLoading(true);
    try {
      const summary = await obeService.getCQIClosingSummary();
      setData(summary);
      if (showToast) toast.success('Closing summary refreshed');
    } catch (error: any) {
      console.error(error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to load closing summary';
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    obeService
      .getAllBatches({ alumni_feedback: 'all' })
      .then((items) => {
        setBatches(items);
        setExportBatchId((prev) => prev || items[0]?.id || '');
      })
      .catch((error) => {
        console.error(error);
        toast.error('Failed to load batches for export');
      });
  }, []);

  const stats = useMemo(() => {
    const ga = data?.ga_cqi_closures?.length ?? 0;
    const po = data?.peo_cqi_closures?.length ?? 0;
    const vmCqi = data?.vision_mission_cqi_closures?.length ?? 0;
    const vm = data?.vision_mission_reviews?.length ?? 0;
    const gaMet =
      data?.ga_cqi_closures?.filter(
        (c) => c.resulting_attainment_met_target
      ).length ?? 0;
    const poMet =
      data?.peo_cqi_closures?.filter(
        (c) => c.resulting_attainment_met_target
      ).length ?? 0;
    const vmRevised =
      data?.vision_mission_reviews?.filter(
        (r) => r.resulting_outcome === 'REVISED'
      ).length ?? 0;
    return {
      total: ga + po + vmCqi + vm,
      ga,
      po,
      vmCqi,
      vm,
      gaMet,
      poMet,
      vmRevised,
    };
  }, [data]);

  const toggleExpand = (key: string) => {
    setExpandedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedExportBatch = batches.find((batch) => batch.id === exportBatchId);

  const getBatchScopedClosures = () => {
    const matchesBatch = (item: any) =>
      item?.flagged?.triggered_batch_id === exportBatchId ||
      item?.flagged?.batch_id === exportBatchId ||
      item?.closed_in_batch === exportBatchId;

    return {
      ga: (data?.ga_cqi_closures || []).filter(matchesBatch),
      po: (data?.peo_cqi_closures || []).filter(matchesBatch),
      vmCqi: (data?.vision_mission_cqi_closures || []).filter(matchesBatch),
      vmReviews: data?.vision_mission_reviews || [],
    };
  };

  const addReportHeader = (pdf: jsPDF, title: string, subtitle: string) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFillColor(17, 24, 39);
    pdf.rect(0, 0, pageWidth, 24, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(title, 14, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(subtitle, 14, 17);
    pdf.setTextColor(15, 23, 42);
  };

  const addSectionTitle = (pdf: jsPDF, title: string, y: number) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, 14, y);
  };

  const handleExportPdf = () => {
    if (!exportBatchId || !selectedExportBatch) {
      toast.error('Please select a batch to export');
      return;
    }

    setExporting(true);
    try {
      const scoped = getBatchScopedClosures();
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const generatedAt = new Date().toLocaleString();
      const batchName = selectedExportBatch.name || selectedExportBatch.custom_id || 'Batch';

      addReportHeader(
        pdf,
        'Consolidated CQI Closing Report',
        `Batch: ${batchName} | Generated: ${generatedAt}`
      );

      autoTable(pdf, {
        startY: 32,
        body: [[
          `GA Closings: ${scoped.ga.length}`,
          `PO Closings: ${scoped.po.length}`,
          `Vision/Mission CQI Closings: ${scoped.vmCqi.length}`,
          `Statement Reviews: ${scoped.vmReviews.length}`,
        ]],
        theme: 'plain',
        styles: { fontSize: 10, fontStyle: 'bold', fillColor: [248, 250, 252], cellPadding: 4 },
        margin: { left: 14, right: 14 },
      });

      let y = ((pdf as any).lastAutoTable?.finalY || 44) + 10;

      addSectionTitle(pdf, 'Graduate Attribute CQI Closings', y);
      autoTable(pdf, {
        startY: y + 4,
        head: [['GA', 'Title', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On']],
        body: scoped.ga.length
          ? scoped.ga.map((item: GACQIClosingSummaryItem) => [
              item.flagged.ga_code,
              item.flagged.ga_title || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No GA CQI closures for selected batch', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      y = ((pdf as any).lastAutoTable?.finalY || y) + 10;
      addSectionTitle(pdf, 'Program Outcome CQI Closings', y);
      autoTable(pdf, {
        startY: y + 4,
        head: [['PO', 'Title', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On']],
        body: scoped.po.length
          ? scoped.po.map((item: PEOCQIClosingSummaryItem) => [
              item.flagged.peo_code,
              item.flagged.peo_title || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No PO CQI closures for selected batch', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      pdf.addPage();
      addReportHeader(pdf, 'Vision / Mission CQI Report', `Batch: ${batchName} | Generated: ${generatedAt}`);
      addSectionTitle(pdf, 'Vision / Mission Keyword CQI Closings', 34);
      autoTable(pdf, {
        startY: 38,
        head: [['Type', 'Keyword', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On']],
        body: scoped.vmCqi.length
          ? scoped.vmCqi.map((item: VisionMissionCQIClosingSummaryItem) => [
              item.flagged.statement_type,
              item.flagged.keyword || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No Vision/Mission CQI closures for selected batch', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      y = ((pdf as any).lastAutoTable?.finalY || 92) + 10;
      addSectionTitle(pdf, 'Vision / Mission Statement Reviews', y);
      autoTable(pdf, {
        startY: y + 4,
        head: [['Type', 'Trigger', 'Decision', 'Previous Statement', 'Justification', 'Reviewed On']],
        body: scoped.vmReviews.length
          ? scoped.vmReviews.map((item: VisionMissionReviewSummaryItem) => [
              item.flagged.statement_type,
              item.flagged.trigger_type,
              item.resulting_outcome,
              item.flagged.previous_statement_snapshot || '-',
              item.action_taken.justification || '-',
              formatDate(item.review_date),
            ])
          : [['-', '-', '-', 'No Vision/Mission statement reviews recorded', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      const pageCount = pdf.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - 14, 200, { align: 'right' });
      }

      pdf.save(`cqi-closing-report-${batchName}.pdf`);
      toast.success('CQI report PDF exported');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Failed to export CQI closing report:', error);
      toast.error('Failed to export CQI report PDF');
    } finally {
      setExporting(false);
    }
  };

  const addWorkbookSheet = (wb: XLSX.WorkBook, name: string, rows: any[][], mergeRows: number[] = []) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const maxCol = Math.max(0, rows.reduce((max, row) => Math.max(max, row.length - 1), 0));
    ws['!merges'] = mergeRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: maxCol } }));
    ws['!cols'] = Array.from({ length: maxCol + 1 }, (_, index) => ({
      wch: index <= 1 ? 24 : index === 6 ? 46 : 20,
    }));
    ws['!rows'] = rows.map((_, index) => ({ hpt: mergeRows.includes(index) ? 26 : 24 }));
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 0; R <= range.e.r; R += 1) {
      for (let C = 0; C <= range.e.c; C += 1) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;
        const isTitle = mergeRows.includes(R);
        const isHeader = R === mergeRows.length + 1 || rows[R]?.[0] === 'GA' || rows[R]?.[0] === 'PO' || rows[R]?.[0] === 'Type';
        ws[address].s = {
          fill: isTitle
            ? { fgColor: { rgb: '064E3B' } }
            : isHeader
              ? { fgColor: { rgb: 'D1FAE5' } }
              : undefined,
          font: {
            bold: isTitle || isHeader,
            color: isTitle ? { rgb: 'FFFFFF' } : isHeader ? { rgb: '065F46' } : { rgb: '111827' },
          },
          alignment: {
            horizontal: isTitle || isHeader ? 'center' : 'left',
            vertical: 'center',
            wrapText: true,
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D1D5DB' } },
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
            left: { style: 'thin', color: { rgb: 'D1D5DB' } },
            right: { style: 'thin', color: { rgb: 'D1D5DB' } },
          },
        };
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  const handleExportExcel = () => {
    if (!exportBatchId || !selectedExportBatch) {
      toast.error('Please select a batch to export');
      return;
    }

    setExporting(true);
    try {
      const scoped = getBatchScopedClosures();
      const batchName = selectedExportBatch.name || selectedExportBatch.custom_id || 'Batch';
      const generatedAt = new Date().toLocaleString();
      const wb = XLSX.utils.book_new();

      addWorkbookSheet(wb, 'Summary', [
        ['Consolidated CQI Closing Report'],
        [`Batch: ${batchName}`],
        [`Generated: ${generatedAt}`],
        [],
        ['Section', 'Records'],
        ['GA CQI Closings', scoped.ga.length],
        ['PO CQI Closings', scoped.po.length],
        ['Vision/Mission CQI Closings', scoped.vmCqi.length],
        ['Vision/Mission Reviews', scoped.vmReviews.length],
      ], [0, 1, 2]);

      addWorkbookSheet(wb, 'GA Closings', [
        ['Graduate Attribute CQI Closings'],
        [`Batch: ${batchName}`],
        [],
        ['GA', 'Title', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On'],
        ...(scoped.ga.length
          ? scoped.ga.map((item: GACQIClosingSummaryItem) => [
              item.flagged.ga_code,
              item.flagged.ga_title || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No GA CQI closures for selected batch', '-', '-', '-', '-', '-', '-']]),
      ], [0, 1]);

      addWorkbookSheet(wb, 'PO Closings', [
        ['Program Outcome CQI Closings'],
        [`Batch: ${batchName}`],
        [],
        ['PO', 'Title', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On'],
        ...(scoped.po.length
          ? scoped.po.map((item: PEOCQIClosingSummaryItem) => [
              item.flagged.peo_code,
              item.flagged.peo_title || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No PO CQI closures for selected batch', '-', '-', '-', '-', '-', '-']]),
      ], [0, 1]);

      addWorkbookSheet(wb, 'Vision Mission CQI', [
        ['Vision / Mission Keyword CQI Closings'],
        [`Batch: ${batchName}`],
        [],
        ['Type', 'Keyword', 'Flagged Batch', 'Initial', 'Implemented In', 'Result', 'Action Taken', 'Closed On'],
        ...(scoped.vmCqi.length
          ? scoped.vmCqi.map((item: VisionMissionCQIClosingSummaryItem) => [
              item.flagged.statement_type,
              item.flagged.keyword || '-',
              item.flagged.batch_name || '-',
              formatPercent(item.flagged.attainment_value),
              item.closed_in_batch_name || '-',
              formatPercent(item.resulting_attainment),
              item.action_taken || '-',
              formatDate(item.closed_date),
            ])
          : [['-', 'No Vision/Mission CQI closures for selected batch', '-', '-', '-', '-', '-', '-']]),
      ], [0, 1]);

      addWorkbookSheet(wb, 'Statement Reviews', [
        ['Vision / Mission Statement Reviews'],
        [`Batch: ${batchName}`],
        [],
        ['Type', 'Trigger', 'Decision', 'Previous Statement', 'Justification', 'Reviewed On'],
        ...(scoped.vmReviews.length
          ? scoped.vmReviews.map((item: VisionMissionReviewSummaryItem) => [
              item.flagged.statement_type,
              item.flagged.trigger_type,
              item.resulting_outcome,
              item.flagged.previous_statement_snapshot || '-',
              item.action_taken.justification || '-',
              formatDate(item.review_date),
            ])
          : [['-', '-', '-', 'No Vision/Mission statement reviews recorded', '-', '-']]),
      ], [0, 1]);

      XLSX.writeFile(wb, `cqi-closing-report-${batchName.replace(/\s+/g, '_')}.xlsx`);
      toast.success('CQI report Excel exported');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Failed to export CQI closing Excel:', error);
      toast.error('Failed to export CQI report Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">
                HOD Advisory — CQI Closing Register
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">
                Consolidated CQI Closing Summary
              </h2>
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                Three distinct, parallel CQI flows in separate sections — never
                merged. Shows every closed GA CQI, closed PO CQI, and every
                Vision/Mission review/decision logged by the HOD.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-800 disabled:opacity-70"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={loading || !data}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-emerald-700 disabled:opacity-70"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <Zap className="w-4 h-4 text-indigo-300" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
            Total Closings
          </p>
          <p className="text-3xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600">
              {stats.gaMet}/{stats.ga} met
            </span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
            GA CQI Closings
          </p>
          <p className="text-3xl font-black text-gray-900">{stats.ga}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600">
              {stats.poMet}/{stats.po} met
            </span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
            PO CQI Closings
          </p>
          <p className="text-3xl font-black text-gray-900">{stats.po}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600">
              {stats.vmCqi} closed
            </span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
            V/M CQI Closings
          </p>
          <p className="text-3xl font-black text-gray-900">{stats.vmCqi}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600">
              {stats.vmRevised} revised
            </span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">
            V/M Reviews
          </p>
          <p className="text-3xl font-black text-gray-900">{stats.vm}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          {
            key: 'ALL' as const,
            label: 'All Sections',
            icon: <FileText className="w-4 h-4" />,
            count: stats.total,
            color:
              'bg-gray-900 text-white border-gray-900 hover:bg-gray-800',
          },
          {
            key: 'ga' as const,
            label: 'GA CQI Closings',
            icon: <BarChart3 className="w-4 h-4" />,
            count: stats.ga,
            color:
              'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
          },
          {
            key: 'po' as const,
            label: 'PO CQI Closings',
            icon: <TrendingUp className="w-4 h-4" />,
            count: stats.po,
            color:
              'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
          },
          {
            key: 'vm-cqi' as const,
            label: 'Vision / Mission CQI Closings',
            icon: <ShieldCheck className="w-4 h-4" />,
            count: stats.vmCqi,
            color:
              'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
          },
          {
            key: 'vm' as const,
            label: 'Vision / Mission Reviews',
            icon: <ShieldCheck className="w-4 h-4" />,
            count: stats.vm,
            color:
              'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
              activeSection === tab.key
                ? tab.key === 'ALL'
                  ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                  : tab.color.replace('border-', 'ring-2 ring-') + ' shadow-md border-transparent'
                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] ${
                activeSection === tab.key
                  ? tab.key === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-inherit'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-600">
            Loading closing summary...
          </p>
        </div>
      )}

      {!loading && stats.total === 0 && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No closing records yet
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Close the loop on GA CQI and PO CQI records from their respective
            pages, or record a Vision/Mission review. Completed actions will
            appear here in three distinct sections.
          </p>
        </div>
      )}

      {!loading && (activeSection === 'ALL' || activeSection === 'ga') && (
        <SectionCard
          title="GA CQI Closings"
          subtitle="Graduate Attributes — implementation batch + resulting attainment auto-pulled"
          accent="from-blue-50 to-indigo-50"
          icon={<BarChart3 className="w-5 h-5" />}
          iconColor="bg-blue-600"
          empty={stats.ga === 0}
          emptyText="No GA CQI records have been closed yet."
        >
          <div className="divide-y divide-gray-100">
            {data?.ga_cqi_closures?.map((item) => (
              <GAClosingRow
                key={`ga-${item.id}`}
                item={item}
                expanded={!!expandedMap[`ga-${item.id}`]}
                onToggle={() => toggleExpand(`ga-${item.id}`)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {!loading && (activeSection === 'ALL' || activeSection === 'po') && (
        <SectionCard
          title="PO CQI Closings"
          subtitle="Program Outcomes — implementation batch + resulting attainment auto-pulled"
          accent="from-violet-50 to-purple-50"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="bg-violet-600"
          empty={stats.po === 0}
          emptyText="No PO CQI records have been closed yet."
        >
          <div className="divide-y divide-gray-100">
            {data?.peo_cqi_closures?.map((item) => (
              <POClosingRow
                key={`po-${item.id}`}
                item={item}
                expanded={!!expandedMap[`po-${item.id}`]}
                onToggle={() => toggleExpand(`po-${item.id}`)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {!loading && (activeSection === 'ALL' || activeSection === 'vm-cqi') && (
        <SectionCard
          title="Vision / Mission CQI Closings"
          subtitle="Keyword-level Vision/Mission CQI closures — implementation batch + resulting attainment auto-pulled"
          accent="from-emerald-50 to-teal-50"
          icon={<ShieldCheck className="w-5 h-5" />}
          iconColor="bg-emerald-600"
          empty={stats.vmCqi === 0}
          emptyText="No Vision/Mission CQI records have been closed yet."
        >
          <div className="divide-y divide-gray-100">
            {data?.vision_mission_cqi_closures?.map((item) => (
              <VMCQIClosingRow
                key={`vm-cqi-${item.id}`}
                item={item}
                expanded={!!expandedMap[`vm-cqi-${item.id}`]}
                onToggle={() => toggleExpand(`vm-cqi-${item.id}`)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {!loading && (activeSection === 'ALL' || activeSection === 'vm') && (
        <SectionCard
          title="Vision / Mission Reviews"
          subtitle="Single-step closing action — Retained or Revised decision with justification"
          accent="from-emerald-50 to-teal-50"
          icon={<ShieldCheck className="w-5 h-5" />}
          iconColor="bg-emerald-600"
          empty={stats.vm === 0}
          emptyText="No Vision/Mission reviews have been recorded yet."
        >
          <div className="divide-y divide-gray-100">
            {data?.vision_mission_reviews?.map((item) => (
              <VMReviewRow
                key={`vm-${item.id}`}
                item={item}
                expanded={!!expandedMap[`vm-${item.id}`]}
                onToggle={() => toggleExpand(`vm-${item.id}`)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <ExportChoiceModal
        open={exportModalOpen}
        title="Export CQI Report"
        description="Select a batch, then choose PDF or Excel."
        exporting={exporting}
        pdfDisabled={!exportBatchId}
        excelDisabled={!exportBatchId}
        onClose={() => setExportModalOpen(false)}
        onPdf={handleExportPdf}
        onExcel={handleExportExcel}
      >
        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
          Batch
        </label>
        <select
          value={exportBatchId}
          onChange={(event) => setExportBatchId(event.target.value)}
          className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 font-bold text-gray-700 focus:border-emerald-500 focus:ring-0"
        >
          <option value="">Select a batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name || batch.custom_id}
            </option>
          ))}
        </select>
      </ExportChoiceModal>
    </div>
  );
};

const SectionCard: React.FC<{
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
  iconColor: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}> = ({ title, subtitle, accent, icon, iconColor, empty, emptyText, children }) => (
  <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
    <div className={`p-5 border-b border-gray-100 bg-gradient-to-r ${accent}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${iconColor} text-white flex items-center justify-center shadow-md`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
    {empty ? (
      <div className="p-10 text-center text-sm text-gray-400 italic">
        {emptyText}
      </div>
    ) : (
      children
    )}
  </div>
);

const GAClosingRow: React.FC<{
  item: GACQIClosingSummaryItem;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  return (
    <div className="bg-white">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-black text-gray-900">
                {item.flagged.ga_code}
              </span>
              {item.flagged.ga_title && (
                <span className="text-xs text-gray-500 truncate max-w-md">
                  {item.flagged.ga_title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Flagged batch:{' '}
                <span className="font-semibold text-gray-700">
                  {item.flagged.batch_name}
                </span>
              </span>
              <AttainmentChip
                attained={null}
                value={item.flagged.attainment_value}
                kpi={item.flagged.kpi_threshold}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-gray-500">
              Implemented in
            </div>
            <div className="text-sm font-bold text-gray-800">
              {item.closed_in_batch_name || 'N/A'}
            </div>
          </div>
          <AttainmentChip
            attained={item.resulting_attainment_met_target}
            value={item.resulting_attainment}
            kpi={item.flagged.kpi_threshold}
          />
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Action Taken (Mandatory Documentation)
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {item.action_taken || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Resulting Attainment
                </span>
                <AttainmentChip
                  attained={item.resulting_attainment_met_target}
                  value={item.resulting_attainment}
                  kpi={item.flagged.kpi_threshold}
                />
              </div>
              <p className="text-xs text-gray-500">
                Auto-calculated cumulative GA attainment for{' '}
                <span className="font-semibold">
                  {item.closed_in_batch_name || 'implementation batch'}
                </span>{' '}
                at the moment of closing. Not user-editable.
              </p>
              <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Closed by:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_by_name || item.closed_by || 'HOD'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Closed on:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_date
                      ? new Date(item.closed_date).toLocaleString()
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const POClosingRow: React.FC<{
  item: PEOCQIClosingSummaryItem;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  return (
    <div className="bg-white">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-black text-gray-900">
                {item.flagged.peo_code}
              </span>
              {item.flagged.peo_title && (
                <span className="text-xs text-gray-500 truncate max-w-md">
                  {item.flagged.peo_title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Flagged batch:{' '}
                <span className="font-semibold text-gray-700">
                  {item.flagged.batch_name}
                </span>
              </span>
              <AttainmentChip
                attained={null}
                value={item.flagged.attainment_value}
                kpi={item.flagged.kpi_threshold}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-gray-500">
              Implemented in
            </div>
            <div className="text-sm font-bold text-gray-800">
              {item.closed_in_batch_name || 'N/A'}
            </div>
          </div>
          <AttainmentChip
            attained={item.resulting_attainment_met_target}
            value={item.resulting_attainment}
            kpi={item.flagged.kpi_threshold}
          />
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Action Taken (Mandatory Documentation)
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {item.action_taken || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Resulting Attainment
                </span>
                <AttainmentChip
                  attained={item.resulting_attainment_met_target}
                  value={item.resulting_attainment}
                  kpi={item.flagged.kpi_threshold}
                />
              </div>
              <p className="text-xs text-gray-500">
                Auto-calculated cumulative PO attainment for{' '}
                <span className="font-semibold">
                  {item.closed_in_batch_name || 'implementation batch'}
                </span>{' '}
                at the moment of closing. Not user-editable.
              </p>
              <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Closed by:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_by_name || item.closed_by || 'HOD'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Closed on:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_date
                      ? new Date(item.closed_date).toLocaleString()
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VMCQIClosingRow: React.FC<{
  item: VisionMissionCQIClosingSummaryItem;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  const isVision = item.flagged.statement_type === 'VISION';
  return (
    <div className="bg-white">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isVision ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isVision ? <Eye className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                {item.flagged.statement_type}
              </span>
              <span className="text-sm font-black text-gray-900">
                {item.flagged.keyword || 'Keyword CQI'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Flagged batch:{' '}
                <span className="font-semibold text-gray-700">
                  {item.flagged.batch_name}
                </span>
              </span>
              <AttainmentChip
                attained={null}
                value={item.flagged.attainment_value}
                kpi={item.flagged.kpi_threshold}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-gray-500">Implemented in</div>
            <div className="text-sm font-bold text-gray-800">
              {item.closed_in_batch_name || 'N/A'}
            </div>
          </div>
          <AttainmentChip
            attained={item.resulting_attainment_met_target}
            value={item.resulting_attainment}
            kpi={item.flagged.kpi_threshold}
          />
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Action Taken
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {item.action_taken || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                  Resulting Attainment
                </span>
                <AttainmentChip
                  attained={item.resulting_attainment_met_target}
                  value={item.resulting_attainment}
                  kpi={item.flagged.kpi_threshold}
                />
              </div>
              <p className="text-xs text-gray-500">
                Auto-calculated Vision/Mission keyword attainment for{' '}
                <span className="font-semibold">
                  {item.closed_in_batch_name || 'implementation batch'}
                </span>{' '}
                at the moment of closing.
              </p>
              <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Closed by:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_by_name || item.closed_by || 'HOD'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Closed on:{' '}
                  <span className="font-semibold text-gray-700">
                    {item.closed_date ? new Date(item.closed_date).toLocaleString() : '—'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VMReviewRow: React.FC<{
  item: VisionMissionReviewSummaryItem;
  expanded: boolean;
  onToggle: () => void;
}> = ({ item, expanded, onToggle }) => {
  const isVision = item.flagged.statement_type === 'VISION';
  return (
    <div className="bg-white">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isVision
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isVision ? (
              <Eye className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                {item.flagged.statement_type}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  item.flagged.trigger_type === 'SCHEDULED'
                    ? 'border-blue-100 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600'
                }`}
              >
                {item.flagged.trigger_type}
              </span>
              {item.flagged.department_name && (
                <span className="text-xs text-gray-400">
                  Academic unit: {item.flagged.department_name}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-1 max-w-2xl">
              “{item.flagged.previous_statement_snapshot}”
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-gray-500">Reviewed</div>
            <div className="text-sm font-bold text-gray-800">
              {item.review_date
                ? new Date(item.review_date).toLocaleDateString()
                : '—'}
            </div>
          </div>
          <OutcomeChip decision={item.resulting_outcome} />
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                Previous Statement Snapshot
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {item.flagged.previous_statement_snapshot}
              </p>
            </div>

            {item.resulting_outcome === 'REVISED' ? (
              <div className="rounded-xl bg-amber-50 p-4 shadow-sm border border-amber-200">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-2">
                  Revised Statement (New Live Version)
                </p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed font-semibold">
                  {item.action_taken.new_statement || '—'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 p-4 shadow-sm border border-emerald-200">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-2">
                  Retained Unchanged
                </p>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Statement confirmed as still relevant and appropriate. No
                  new version created.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
              Justification (Mandatory)
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {item.action_taken.justification || '—'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Reviewed:{' '}
              <span className="font-semibold text-gray-700">
                {item.review_date
                  ? new Date(item.review_date).toLocaleString()
                  : '—'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
              <User className="w-3.5 h-3.5" />
              By:{' '}
              <span className="font-semibold text-gray-700">
                {item.reviewed_by_name || item.reviewed_by || 'HOD'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
              {isVision ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span className="font-semibold text-gray-700">
                {item.flagged.statement_type}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Trigger:{' '}
              <span className="font-semibold text-gray-700">
                {item.flagged.trigger_type}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODCQIClosingAdvisory;
