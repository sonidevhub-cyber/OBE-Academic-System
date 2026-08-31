
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, ArrowLeft, Download, RotateCw, CheckCircle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import obeService, {
  CLOMasterCompilationResponse,
  CLOMasterCompilationCourse,
  CLOMasterCompilationStudent,
  Batch
} from '../../../api/obeService';
import academicStructureService, { Program, Semester } from '../../../api/academicStructureService';
import { toast } from 'react-hot-toast';
import BatchFrameworkBanner from '../../../components/obe/BatchFrameworkBanner';
import ExportChoiceModal from '../../../components/reports/ExportChoiceModal';

type BatchCategory = 'all' | 'ongoing' | 'graduated';

const cloSortKey = (cloCode: string): [number, number | string] => {
  try {
    if (cloCode.startsWith('CLO-')) {
      const n = parseInt(cloCode.replace('CLO-', ''), 10);
      if (!Number.isNaN(n)) return [0, n];
    }
    return [1, cloCode];
  } catch {
    return [2, cloCode];
  }
};

const compareCloCode = (a: string, b: string) => {
  const ka = cloSortKey(a);
  const kb = cloSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (typeof ka[1] === 'number' && typeof kb[1] === 'number') return ka[1] - kb[1];
  return String(ka[1]).localeCompare(String(kb[1]));
};

const CoordinatorCLOReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allSemesters, setAllSemesters] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<BatchCategory>('all');
  const [report, setReport] = useState<CLOMasterCompilationResponse | null>(null);
  const [expandedCqi, setExpandedCqi] = useState<Set<string>>(new Set());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggleCqi = (key: string) => {
    const newSet = new Set(expandedCqi);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedCqi(newSet);
  };

  const selectedBatchName = useMemo(() => {
    const batch = allBatches.find((b) => b.id === selectedBatchId);
    return batch?.name || null;
  }, [allBatches, selectedBatchId]);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [programsRes, batches] = await Promise.all([
          academicStructureService.getPrograms(),
          obeService.getAllBatches({ alumni_feedback: 'all' }),
        ]);
        const programs = programsRes.data;
        // Flatten all semesters from all programs
        const semesters = programs.flatMap((p: any) => p.semesters || []);
        // De-duplicate semesters by id
        const uniqueSemesters = Array.from(new Map(semesters.map((s: any) => [s.id, s])).values());
        setAllPrograms(programs);
        setAllSemesters(uniqueSemesters);
        setAllBatches(batches);
        
        if (programs[0]) setSelectedProgramId(programs[0].id);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Filter batches based on program and category
  const filteredBatches = selectedProgramId
    ? allBatches.filter((b) => {
        if (b.program?.id !== selectedProgramId) return false;
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      })
    : allBatches.filter((b) => {
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      });

  const loadReport = async (forceRefresh = false) => {
    if (!selectedProgramId || !selectedSemesterId || !selectedBatchId) return;

    setLoading(!report);
    try {
      const data = await obeService.getCLOMasterCompilation(
        selectedProgramId,
        selectedSemesterId,
        selectedBatchId,
        'json',
        forceRefresh
      );
      const normalized = data as CLOMasterCompilationResponse;
      (normalized.finalized_courses || []).forEach((course) => {
        if (course.clos && course.clos.length > 1) {
          course.clos = [...course.clos].sort((a, b) => compareCloCode(a.clo_code || '', b.clo_code || ''));
        }
      });
      setReport(normalized);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load CLO Master Compilation');
    } finally {
      setLoading(false);
    }
  };

  // Fetch report when selections change
  useEffect(() => {
    loadReport(false);
  }, [selectedProgramId, selectedSemesterId, selectedBatchId]);

  useEffect(() => {
    if (!selectedProgramId || !selectedSemesterId || !selectedBatchId) {
      return;
    }

    // Auto-refresh removed - user can manually refresh using the refresh button
  }, [selectedProgramId, selectedSemesterId, selectedBatchId]);

  const buildExportRows = () => {
    if (!report) return null;

    const selectedBatch = allBatches.find((b) => b.id === selectedBatchId);
    const courseColumns = report.finalized_courses.flatMap((course) =>
      course.clos.map((clo) => ({ course, clo }))
    );
    const cqiRows = report.finalized_courses.flatMap((course) =>
      course.clos
        .filter((clo) => clo.cqi)
        .map((clo) => ({ course, clo }))
    );

    const rows: any[][] = [
      [report.program.name],
      [`Program Code: ${report.program.code}`],
      [`Batch: ${selectedBatch?.name || report.batch?.name || 'Selected Batch'}`],
      [`Semester: ${report.semester.name}`],
      ['CLO Master Compilation'],
      [`Date: ${new Date().toLocaleDateString()}`],
      [],
    ];

    const header = ['Sr. No.', 'Reg. No.', 'Student Name', ...courseColumns.map(({ course, clo }) => `${course.course_code} - ${clo.clo_code}`)];
    rows.push(header);

    report.students.forEach((student, idx) => {
      const row: any[] = [idx + 1, student.reg_no, student.name];
      courseColumns.forEach(({ course, clo }) => {
        const score = student.courses?.[course.course_id]?.[clo.clo_code];
        row.push(score ? `${score.score.toFixed(1)}%` : '-');
      });
      rows.push(row);
    });

    rows.push([]);
    rows.push(['No. of Students Achieving CLOs KPI (50%)', '', '', ...courseColumns.map(({ clo }) => `${clo.cohort_achieved_count}`)]);
    rows.push(['% of Students Achieving CLOs at Cohort-Level (50%)', '', '', ...courseColumns.map(({ clo }) => `${clo.cohort_percentage.toFixed(2)}%`)]);

    const cqiSectionStart = rows.length;
    rows.push([]);
    rows.push(['CQI Details']);
    rows.push(['Course Code', 'CLO Code', 'KPI Target', 'Cohort %', 'Reason', 'Action Plan', 'Coordinator Comment']);
    if (cqiRows.length === 0) {
      rows.push(['No CQI records found']);
    } else {
      cqiRows.forEach(({ course, clo }) => {
        rows.push([
          course.course_code,
          clo.clo_code,
          `${clo.kpi_target.toFixed(1)}%`,
          `${clo.cohort_percentage.toFixed(2)}%`,
          clo.cqi?.reason || '',
          clo.cqi?.action_plan || '',
          clo.cqi?.coordinator_comment || '',
        ]);
      });
    }

    return { selectedBatch, courseColumns, cqiSectionStart, rows };
  };

  const handleExportExcel = async () => {
    if (!report) return;
    setExporting(true);

    try {
      const exportData = buildExportRows();
      if (!exportData) return;
      const { courseColumns, cqiSectionStart, rows } = exportData;
      const wb = XLSX.utils.book_new();

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const maxCol = Math.max(6, 2 + courseColumns.length);
      ws['!merges'] = [
        ...[0, 1, 2, 3, 4, 5].map((r) => ({ s: { r, c: 0 }, e: { r, c: maxCol } })),
        { s: { r: cqiSectionStart + 1, c: 0 }, e: { r: cqiSectionStart + 1, c: 6 } },
      ];
      ws['!freeze'] = { xSplit: 3, ySplit: 8 };
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 0 }, e: { r: 7 + report.students.length, c: maxCol } }) };

      const columnWidths = [
        { wch: 10 },
        { wch: 22 },
        { wch: 26 },
        ...courseColumns.map(() => ({ wch: 14 })),
      ];
      while (columnWidths.length < 7) {
        columnWidths.push({ wch: 20 });
      }
      ws['!cols'] = columnWidths;
      ws['!rows'] = rows.map((_, index) => ({ hpt: index <= 5 ? 24 : index === 7 || index === cqiSectionStart + 2 ? 34 : 22 }));

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (!cell) continue;
          const baseBorder = {
            top: { style: 'thin', color: { rgb: 'D1D5DB' } },
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
            left: { style: 'thin', color: { rgb: 'D1D5DB' } },
            right: { style: 'thin', color: { rgb: 'D1D5DB' } },
          };

          if (R <= 5) {
            cell.s = {
              fill: { fgColor: { rgb: '1D4ED8' } },
              font: { color: { rgb: 'FFFFFF' }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: baseBorder,
            };
          } else if (R === 7) {
            cell.s = {
              fill: { fgColor: { rgb: 'DBEAFE' } },
              font: { bold: true, color: { rgb: '1E3A8A' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            };
          } else if (R > 7 && R <= 7 + report.students.length) {
            if (C >= 3) {
              const student = report.students[R - 8];
              const course = courseColumns[C - 3];
              const score = student?.courses?.[course.course.course_id]?.[course.clo.clo_code];
              const achieved = score?.achieved;
              cell.s = {
                fill: {
                  fgColor: {
                    rgb: achieved ? 'DCFCE7' : 'FEE2E2',
                  },
                },
                font: {
                  color: {
                    rgb: achieved ? '166534' : '991B1B',
                  },
                  bold: true,
                },
                alignment: { horizontal: 'center', vertical: 'center' },
              };
            } else {
              cell.s = {
                font: { bold: true },
                alignment: { horizontal: 'center', vertical: 'center' },
              };
            }
          } else if (R === 9 + report.students.length) {
            cell.s = {
              fill: { fgColor: { rgb: 'EDE9FE' } },
              font: { bold: true, color: { rgb: '312E81' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === 10 + report.students.length) {
            cell.s = {
              fill: { fgColor: { rgb: 'EDE9FE' } },
              font: { bold: true, color: { rgb: '312E81' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === cqiSectionStart + 1) {
            cell.s = {
              fill: { fgColor: { rgb: 'DBEAFE' } },
              font: { bold: true, color: { rgb: '1E3A8A' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === cqiSectionStart + 2) {
            cell.s = {
              fill: { fgColor: { rgb: 'DBEAFE' } },
              font: { bold: true, color: { rgb: '1E3A8A' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            };
          } else if (R > cqiSectionStart + 2) {
            cell.s = {
              alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'CLO Master');
      const filename = `CLO_Master_Compilation_${report.program.code}_${report.semester.name.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Export successful!');
      setExportModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const exportData = buildExportRows();
      if (!exportData) return;
      const { selectedBatch, courseColumns, cqiSectionStart, rows } = exportData;
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('CLO Master Compilation', pageWidth / 2, 14, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`${report.program.name} | ${selectedBatch?.name || report.batch?.name || 'Selected Batch'} | ${report.semester.name}`, 14, 22);

      autoTable(pdf, {
        startY: 28,
        head: [['Sr.', 'Reg. No.', 'Student Name', ...courseColumns.map(({ course, clo }) => `${course.course_code} - ${clo.clo_code}`)]],
        body: rows.slice(8, 8 + report.students.length),
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 8, right: 8 },
      });

      autoTable(pdf, {
        startY: ((pdf as any).lastAutoTable?.finalY || 28) + 8,
        head: [['Metric', '', '', ...courseColumns.map(({ clo }) => clo.clo_code)]],
        body: rows.slice(8 + report.students.length + 1, 8 + report.students.length + 3),
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.4, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        margin: { left: 8, right: 8 },
      });

      pdf.addPage();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('CLO CQI Details', 14, 16);
      autoTable(pdf, {
        startY: 22,
        head: [rows[cqiSectionStart + 2]],
        body: rows.slice(cqiSectionStart + 3),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.6, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        margin: { left: 10, right: 10 },
      });

      pdf.save(`CLO_Master_Compilation_${report.program.code}_${report.semester.name.replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF exported successfully!');
      setExportModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    if (!selectedBatchId || !selectedSemesterId) return;

    const runRefresh = async () => {
      try {
        setLoading(true);
        await obeService.recalculateRetakeReports(selectedBatchId, selectedSemesterId);
        await loadReport(true);
        toast.success('Retake reports refreshed');
      } catch (error) {
        console.error(error);
        toast.error('Failed to refresh retake reports');
      } finally {
        setLoading(false);
      }
    };

    void runRefresh();
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FileBarChart className="w-6 h-6 text-indigo-600" />
              CLO Master Compilation
            </h2>
            <p className="text-gray-500 font-semibold mt-1">
              Semester-level live append of CLO attainment
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              <RotateCw className="w-4 h-4" />
              Refresh
            </button>
            {report && (
              <button
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
        </div>

        {/* Selection Area */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Program
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedSemesterId('');
                setSelectedBatchId('');
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="">Select a program</option>
              {allPrograms.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Batch Category
            </label>
            <select
              value={batchCategory}
              onChange={(e) => {
                setBatchCategory(e.target.value as BatchCategory);
                setSelectedBatchId('');
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="all">All Batches</option>
              <option value="ongoing">Ongoing</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value);
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="">Select Semester</option>
              {allSemesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (Semester {s.number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={!selectedProgramId}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all disabled:bg-gray-100"
            >
              <option value="">Select a batch</option>
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Framework Snapshot Banner */}
      <BatchFrameworkBanner
        batchId={selectedBatchId || null}
        batchName={selectedBatchName}
      />

      <ExportChoiceModal
        open={exportModalOpen}
        title="Export CLO Report"
        description="Choose PDF for sharing or Excel for a formatted workbook."
        exporting={exporting}
        onClose={() => setExportModalOpen(false)}
        onPdf={handleExportPDF}
        onExcel={handleExportExcel}
      />

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
        </div>
      )}

      {/* Report */}
      {!loading && report && (
        <>
          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border ${report.status.is_fully_compiled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-center gap-3">
              {report.status.is_fully_compiled ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <div className="font-black text-lg text-gray-800">
                  Courses Finalized: {report.status.finalized_count} / {report.status.total_count}
                </div>
                <div className="font-semibold text-gray-600">
                  {report.status.is_fully_compiled ? 'All courses finalized' : 'In Progress'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div 
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto w-full"
          >
            <div className="w-full">
            <table className="min-w-max text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50">
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-0 bg-gray-50 z-20">
                    Sr. No
                  </th>
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-[80px] bg-gray-50 z-20 min-w-[140px] w-auto">
                    Reg. No
                  </th>
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-[180px] bg-gray-50 z-20">
                    Name
                  </th>
                  {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                    <th key={course.course_id} colSpan={course.clos.length} className="px-4 py-3 text-xs font-black text-indigo-700 uppercase tracking-wide border border-gray-200 bg-indigo-50">
                      {course.course_code}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  {/* Empty placeholders for the sticky left columns */}
                  {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                    course.clos.map((clo) => {
                      const cohortPercentage = clo.cohort_percentage ?? 0;
                      const kpiTarget = clo.kpi_target ?? 0;
                      const isAchieved = cohortPercentage >= kpiTarget;
                      return (
                        <th key={`${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200">
                          <div className="flex flex-col items-center gap-1">
                            {/* CLO Code with Target */}
                            <div className="font-semibold">
                              {clo.clo_code} (Target: {kpiTarget}%)
                            </div>
                            {/* Cohort Percentage */}
                            <div className="text-gray-500 text-xs">
                              {cohortPercentage.toFixed(2)}%
                            </div>
                            {/* Status Badge */}
                            <div className={`text-xs px-2 py-0.5 rounded-full ${isAchieved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {isAchieved ? '✅ Achieved' : '❌ CQI Triggered'}
                            </div>
                            {/* CQI Info Button */}
                            {clo.cqi && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => toggleCqi(`${course.course_id}-${clo.clo_id}`)}
                                  className="p-1 rounded-full hover:bg-indigo-100 text-indigo-600 flex items-center gap-1"
                                  title="View CQI details"
                                >
                                  <Info size={14} />
                                  {expandedCqi.has(`${course.course_id}-${clo.clo_id}`) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>

                                {expandedCqi.has(`${course.course_id}-${clo.clo_id}`) && (
                                  <div className="absolute top-8 right-0 z-50 w-72 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left shadow-xl">
                                    <div className="mb-3 border-b border-amber-200 pb-2 text-xs font-black uppercase tracking-wider text-amber-800">
                                      CQI Details
                                    </div>
                                    <div className="space-y-3 text-xs normal-case tracking-normal">
                                      <div>
                                        <span className="font-bold text-gray-900">Reason:</span>
                                        <p className="mt-1 font-medium text-gray-700">{clo.cqi.reason}</p>
                                      </div>
                                      <div>
                                        <span className="font-bold text-gray-900">Action Plan:</span>
                                        <p className="mt-1 font-medium text-gray-700">{clo.cqi.action_plan}</p>
                                      </div>
                                      {clo.cqi.coordinator_comment && (
                                        <div>
                                          <span className="font-bold text-gray-900">Coordinator Comment:</span>
                                          <p className="mt-1 font-medium text-gray-700">{clo.cqi.coordinator_comment}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...(report.students || [])]
                  .sort((a: CLOMasterCompilationStudent, b: CLOMasterCompilationStudent) => 
                    (a.reg_no || '').localeCompare(b.reg_no || '')
                  )
                  .map((student: CLOMasterCompilationStudent, idx: number) => (
                    <React.Fragment key={student.sr_no}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-700 border border-gray-100 sticky left-0 bg-gray-50 z-10">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-700 border border-gray-100 sticky left-[80px] bg-gray-50 z-10 min-w-[140px] w-auto break-all">
                        {student.reg_no}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 border border-gray-100 sticky left-[180px] bg-gray-50 z-10">
                        {student.name}
                      </td>
                      {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                        course.clos.map((clo) => {
                          const courseData = student.courses[course.course_id];
                          const cloData = courseData ? courseData[clo.clo_code] : null;
                          return (
                            <td key={`${student.sr_no}-${course.course_id}-${clo.clo_id}`} className={`px-3 py-2 text-center border border-gray-100 font-bold ${cloData ? (cloData.achieved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'text-gray-400'}`}>
                              {cloData ? `${cloData.score}%` : '-'}
                            </td>
                          );
                        })
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
                {/* Summary Row 1: No. of Students Achieving CLOs KPI */}
                <tr className="border-t-2 border-gray-300 bg-indigo-50">
                  <td colSpan={3} className="px-4 py-3 font-black text-indigo-800 border border-gray-200 sticky left-0 bg-indigo-50 z-10">
                    No. of Students Achieving CLOs KPI (50%):
                  </td>
                  {report.finalized_courses.map((course) => 
                    course.clos.map((clo) => {
                      const achievedCount = typeof clo.cohort_achieved_count === 'number'
                        ? clo.cohort_achieved_count
                        : 0;
                      return (
                        <td key={`count-${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-center border border-gray-200 font-black text-indigo-800">
                          {achievedCount}
                        </td>
                      );
                    })
                  )}
                </tr>
                {/* Summary Row 2: Percentage of Students Achieving CLOs KPI */}
                <tr className="border-t border-gray-300 bg-indigo-50">
                  <td colSpan={3} className="px-4 py-3 font-black text-indigo-800 border border-gray-200 sticky left-0 bg-indigo-50 z-10">
                    % of Students Achieving CLOs at Cohort-Level (50%):
                  </td>
                  {report.finalized_courses.map((course) => 
                    course.clos.map((clo) => {
                      const percentage = typeof clo.cohort_percentage === 'number'
                        ? clo.cohort_percentage
                        : 0;
                      return (
                        <td key={`percentage-${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-center border border-gray-200 font-black text-indigo-800">
                          {percentage.toFixed(2)}%
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* Pending Courses */}
          {report.pending_courses.filter((pc) => {
            const s = String(pc.status || '').toUpperCase();
            return s !== 'ASSESSMENT_DONE' && s !== 'FINAL_SUBMITTED' && s !== 'INTERNAL_COMPLETE_AWAITING_FINAL';
          }).length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                Pending Courses
                <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
                  {report.pending_courses.filter((pc) => {
                    const s = String(pc.status || '').toUpperCase();
                    return s !== 'ASSESSMENT_DONE' && s !== 'FINAL_SUBMITTED' && s !== 'INTERNAL_COMPLETE_AWAITING_FINAL';
                  }).length}
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.pending_courses.filter((pc) => {
                  const s = String(pc.status || '').toUpperCase();
                  return s !== 'ASSESSMENT_DONE' && s !== 'FINAL_SUBMITTED' && s !== 'INTERNAL_COMPLETE_AWAITING_FINAL';
                }).map((pc) => {
                  const statusRaw = String(pc.status || 'INTERNAL_LOCK_PENDING').toUpperCase();
                  const isNoSession = statusRaw === 'NO_SESSION_CREATED';
                  const isFinalPending = statusRaw === 'FINAL_SUBMISSION_PENDING';
                  const isInternalPending = !isNoSession && !isFinalPending;
                  let statusLabel = 'Internal Lock Pending';
                  let cardBg = 'bg-amber-50 border-amber-100';
                  let textTitle = 'text-amber-800';
                  let textSub = 'text-amber-700';
                  let badgeBg = 'bg-amber-200 text-amber-900';
                  let iconColor = 'text-amber-500';
                  if (isNoSession) {
                    statusLabel = 'No Session Created';
                    cardBg = 'bg-rose-50 border-rose-100';
                    textTitle = 'text-rose-800';
                    textSub = 'text-rose-700';
                    badgeBg = 'bg-rose-200 text-rose-900';
                    iconColor = 'text-rose-500';
                  } else if (isFinalPending) {
                    statusLabel = 'Final Submission Pending';
                    cardBg = 'bg-sky-50 border-sky-100';
                    textTitle = 'text-sky-800';
                    textSub = 'text-sky-700';
                    badgeBg = 'bg-sky-200 text-sky-900';
                    iconColor = 'text-sky-500';
                  }
                  return (
                    <div
                      key={pc.course_id}
                      className={`rounded-xl p-4 flex items-center justify-between border ${cardBg}`}
                    >
                      <div>
                        <div className={`font-black ${textTitle}`}>
                          {pc.course_code} - {pc.course_name}
                        </div>
                        <div className={`text-sm font-semibold ${textSub}`}>
                          Instructor: {pc.instructor_name}
                        </div>
                        <span
                          className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeBg}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <AlertCircle className={`w-5 h-5 ${iconColor}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CoordinatorCLOReportModule;
