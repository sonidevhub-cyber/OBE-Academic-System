import React, { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import obeService, { Batch, GACQIRecord } from '../api/obeService';
import BatchFrameworkBanner from '../components/obe/BatchFrameworkBanner';
import ExportChoiceModal from '../components/reports/ExportChoiceModal';

type ViewMode = 'student-wise' | 'course-wise';

interface GA {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  ga_kpi_threshold: number;
}

interface StudentGA {
  ga_id: string;
  ga_code: string;
  direct_score: number | null;
  is_below_threshold: boolean;
}

interface StudentReport {
  id: string;
  name: string;
  registration_number: string;
  ga_scores: StudentGA[];
  is_dropped?: boolean;
  is_frozen?: boolean;
  frozen_at_semester?: number | null;
  frozen_date?: string | null;
}

interface CourseGA {
  ga_id: string;
  ga_code: string;
  score: number | null;
  is_below_threshold: boolean;
}

interface CourseReport {
  course_id: string;
  course_code: string;
  course_title: string;
  semester: number | null;
  ga_scores: CourseGA[];
}

interface CohortSummary {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  ga_kpi_threshold: number;
  direct_attainment: number | null;
  indirect_attainment: number | null;
  final_attainment: number | null;
  status: 'ACHIEVED' | 'BELOW_TARGET' | 'NOT_ASSESSED';
}

interface GAStatusRow {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  cohort_score: number | null;
  kpi_threshold: number;
  status: 'ACHIEVED' | 'BELOW_TARGET' | 'NOT_ASSESSED';
  cqi_record_id: string | null;
  cqi_status: string | null;
}

interface AllStudentsReportData {
  is_program_end_ready: boolean;
  gas: GA[];
  students?: StudentReport[];
  courses?: CourseReport[];
  cohort_summary: CohortSummary[];
}

type BatchCategory = 'all' | 'ongoing' | 'graduated';

const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : `${value.toFixed(1)}%`;

const getCodeNumber = (code: string | null | undefined): number => {
  const match = String(code || '').match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const sortByCodeNumber = <T extends { ga_code?: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const numberDiff = getCodeNumber(a.ga_code) - getCodeNumber(b.ga_code);
    return numberDiff || String(a.ga_code || '').localeCompare(String(b.ga_code || ''));
  });

const recordedCqiStatuses = new Set([
  'SAVED',
  'EXPORTED',
  'FULLY_APPROVED',
  'APPROVED',
  'CLOSED_IMPLEMENTED',
]);

const GAReport: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('student-wise');
  const [reportData, setReportData] = useState<AllStudentsReportData | null>(null);
  const [readinessInfo, setReadinessInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [batchCategory, setBatchCategory] = useState<BatchCategory>('all');
  const [gaStatusRow, setGAStatusRow] = useState<GAStatusRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentGA, setCurrentGA] = useState<GAStatusRow | null>(null);
  const [currentCQIRecord, setCurrentCQIRecord] = useState<GACQIRecord | null>(null);
  const [issueStatement, setIssueStatement] = useState('');
  const [hodActionPlan, setHodActionPlan] = useState('');
  const [implementedInBatch, setImplementedInBatch] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRequestRef = useRef(0);
  const statusRequestRef = useRef(0);

  const resetReportState = () => {
    setReportData(null);
    setReadinessInfo(null);
    setGAStatusRow([]);
  };

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const batchesData = await obeService.getAllBatches({ alumni_feedback: 'all' });
        console.log('=== Fetched batches:', batchesData); // Log to see what each batch has!
        setBatches(batchesData);
        const uniquePrograms = Array.from(
          new Map(
            batchesData.map((batch) => [batch.program?.id, batch.program])
          ).values()
        ).filter(Boolean);
        setPrograms(uniquePrograms as any[]);
        
        if (batchesData.length > 0) {
          setSelectedProgramId(batchesData[0].program?.id || '');
          setSelectedBatchId('');
        }
      } catch (error) {
        console.error('Failed to fetch batches:', error);
        toast.error('Failed to fetch batches');
      }
    };

    fetchBatches();
  }, []);

  // Auto-generate report when batch or view mode changes
  useEffect(() => {
    if (!selectedBatchId) {
      reportRequestRef.current += 1;
      resetReportState();
      return;
    }

    const fetchReport = async () => {
      const requestId = reportRequestRef.current + 1;
      reportRequestRef.current = requestId;
      setLoading(true);
      
      try {
        const data = await obeService.getBatchGAReport(selectedBatchId, {
          mode: 'cumulative',
          scope: viewMode === 'student-wise' ? 'all_students' : 'course_wise',
        });

        if (reportRequestRef.current !== requestId) {
          return;
        }

        // Check if it's a readiness response
        if ('ready' in data && !data.ready) {
          setReadinessInfo(data);
          setReportData(null);
        } else {
          setReportData(data as unknown as AllStudentsReportData);
          setReadinessInfo(null);
        }
      } catch (error) {
        if (reportRequestRef.current !== requestId) {
          return;
        }
        console.error('Failed to fetch GA report:', error);
        toast.error('Failed to fetch GA report');
      } finally {
        if (reportRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    fetchReport();
  }, [selectedBatchId, viewMode, refreshTick]);

  // Fetch GA Status Row when program and batch are selected
  useEffect(() => {
    if (!selectedProgramId || !selectedBatchId) {
      statusRequestRef.current += 1;
      setGAStatusRow([]);
      return;
    }
    const fetchGAStatusRow = async () => {
      const requestId = statusRequestRef.current + 1;
      statusRequestRef.current = requestId;
      try {
        const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
        if (statusRequestRef.current !== requestId) {
          return;
        }
        setGAStatusRow(data);
      } catch (error) {
        if (statusRequestRef.current !== requestId) {
          return;
        }
        console.error('Failed to fetch GA status row:', error);
      }
    };
    fetchGAStatusRow();
  }, [selectedProgramId, selectedBatchId, refreshTick]);

  const handleRefreshReport = () => {
    if (!selectedBatchId) {
      toast.error('Select a batch first');
      return;
    }
    setRefreshTick((tick) => tick + 1);
  };

  // Handle Manage CQI button click
  const handleTriggerCQI = async (ga: GAStatusRow) => {
    try {
      setSaving(true);
      const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
      setGAStatusRow(data);
      const updatedGA = data.find(g => g.ga_id === ga.ga_id);
      if (!updatedGA) {
        toast.error('GA not found');
        return;
      }
      setCurrentGA(updatedGA);
      setIssueStatement('');
      setHodActionPlan('');
      setImplementedInBatch('');
      setActionTaken('');
      setCurrentCQIRecord(null);
      if (updatedGA.cqi_record_id) {
        try {
          const record = await obeService.getGACQIRecord(updatedGA.cqi_record_id);
          setCurrentCQIRecord(record);
          setIssueStatement(record.issue_statement || '');
          setHodActionPlan(record.hod_action_plan || '');
          setImplementedInBatch(record.implemented_in_batch || '');
          setActionTaken(record.action_taken_description || '');
        } catch (err) {
          console.error('Failed to fetch CQI record:', err);
        }
      }
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to load CQI:', error);
      toast.error('Failed to load CQI');
    } finally {
      setSaving(false);
    }
  };

  // Handle close CQI
  const handleCloseCQI = async () => {
    if (!currentGA?.cqi_record_id) {
      toast.error('No CQI record found');
      return;
    }
    if (!implementedInBatch) {
      toast.error('Implemented In Batch is required');
      return;
    }
    if (actionTaken.trim().length < 20) {
      toast.error('Action Taken must be at least 20 characters');
      return;
    }
    setClosing(true);
    try {
      await obeService.closeGACQI(currentGA.cqi_record_id, {
        implemented_in_batch: implementedInBatch,
        action_taken_description: actionTaken.trim(),
      });
      toast.success('CQI closed successfully');
      setModalOpen(false);
      const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
      setGAStatusRow(data);
    } catch (error) {
      console.error('Failed to close CQI:', error);
      toast.error('Failed to close CQI');
    } finally {
      setClosing(false);
    }
  };

  // Handle save CQI
  const handleSaveCQI = async () => {
    if (!currentGA?.cqi_record_id) {
      toast.error('No CQI record found');
      return;
    }
    if (hodActionPlan.trim().length < 20) {
      toast.error('HOD Action Plan must be at least 20 characters');
      return;
    }
    setSaving(true);
    try {
      await obeService.saveGACQI(currentGA.cqi_record_id, {
        hod_action_plan: hodActionPlan.trim(),
        issue_statement: issueStatement.trim()
      });
      toast.success('Saved. This will appear in Advisory Export.');
      setModalOpen(false);
      // Re-fetch status row
      const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
      setGAStatusRow(data);
    } catch (error) {
      console.error('Failed to save CQI:', error);
      toast.error('Failed to save CQI');
    } finally {
      setSaving(false);
    }
  };

  const filteredBatches = selectedProgramId
    ? batches.filter((b) => {
        if (b.program?.id !== selectedProgramId) return false;
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      })
    : batches.filter((b) => {
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      });

  useEffect(() => {
    if (!selectedBatchId && filteredBatches.length > 0) {
      setSelectedBatchId(filteredBatches[0].id);
    }
  }, [filteredBatches, selectedBatchId]);

  const selectedBatchName = useMemo(() => {
    const batch = batches.find((b) => b.id === selectedBatchId);
    return batch?.name || null;
  }, [batches, selectedBatchId]);

  const sortedGas = useMemo(() => sortByCodeNumber(reportData?.gas || []), [reportData]);

  const getSelectedBatch = () => batches.find((b) => b.id === selectedBatchId);

  const getProgramDepartmentName = (batch?: Batch) => {
    const program = batch?.program || {};
    const department = program.department;
    if (typeof department === 'object' && department !== null) {
      return department.name || department.department_name || department.title || department.code || 'Computer Science';
    }
    return program.department_name || program.department_title || program.department_code || 'Computer Science';
  };

  const getSummaryForGa = (gaId: string) =>
    (reportData?.cohort_summary || []).find((summary) => summary.ga_id === gaId);

  const getExportRows = async () => {
    if (!reportData) {
      toast.error('No report data to export');
      return null;
    }

    const selectedBatch = getSelectedBatch();
    const cqiRecords = selectedProgramId && selectedBatchId
      ? await obeService.getGACQIAdvisoryExport(selectedProgramId, selectedBatchId)
      : [];

    const pendingCqiRecords = cqiRecords.filter(
      (r) => r.status !== 'CLOSED_IMPLEMENTED' && r.status !== 'FULLY_APPROVED'
    );
    if (pendingCqiRecords.length > 0) {
      toast.error(
        `Please close the CQI loop for ${pendingCqiRecords.length} GA(s) before exporting. ` +
        `Pending: ${pendingCqiRecords.map((r) => r.ga_code).join(', ')}`
      );
      return null;
    }

    const gas = sortedGas;
    const rows: any[][] = [
      [selectedBatch?.program?.name || 'Program Name'],
      ['Department: ' + getProgramDepartmentName(selectedBatch)],
      ['Batch: ' + (selectedBatch?.name || 'Selected Batch')],
      [viewMode === 'student-wise' ? 'Student-wise Cohort Attainment' : 'Course-wise PLO Contribution'],
      ['Date: ' + new Date().toLocaleDateString()],
      [],
    ];

    const header = viewMode === 'student-wise'
      ? ['Sr. No.', 'Reg. No.', 'Student Name', ...gas.map((g) => g.ga_code)]
      : ['Sr. No.', 'Course Code', 'Course Title', ...gas.map((g) => g.ga_code)];
    rows.push(header);

    const items = viewMode === 'student-wise' ? (reportData.students || []) : (reportData.courses || []);

    items.forEach((item, idx) => {
      if ('name' in item) {
        const student = item as StudentReport;
        if (student.is_dropped) {
          rows.push([
            idx + 1,
            student.registration_number,
            student.name,
            ...Array(gas.length).fill('Dropped Out'),
          ]);
        } else {
          const frozenSuffix = student.is_frozen
            ? ` (Frozen - Sem ${student.frozen_at_semester || 'N/A'})`
            : '';
          rows.push([
            idx + 1,
            student.registration_number,
            `${student.name}${frozenSuffix}`,
            ...gas.map((g) => {
              const score = student.ga_scores.find((s) => s.ga_id === g.ga_id)?.direct_score;
              return formatPercent(score);
            }),
          ]);
        }
      } else {
        const course = item as CourseReport;
        rows.push([
          idx + 1,
          course.course_code,
          course.course_title,
          ...gas.map((g) => {
            const score = course.ga_scores.find((s) => s.ga_id === g.ga_id)?.score;
            return formatPercent(score);
          }),
        ]);
      }
    });

    rows.push(['', '', '', ...Array(gas.length).fill('')]);
    rows.push(['Direct Attainment (%)', '(From Exams/Labs)', '', ...gas.map((g) => formatPercent(getSummaryForGa(g.ga_id)?.direct_attainment))]);
    rows.push(['Indirect Attainment (%)', '(From Surveys)', '', ...gas.map((g) => formatPercent(getSummaryForGa(g.ga_id)?.indirect_attainment))]);
    rows.push(['Final Combined Attainment (%)', '(80% Direct + 20% Indirect)', '', ...gas.map((g) => formatPercent(getSummaryForGa(g.ga_id)?.final_attainment))]);
    rows.push(['Status', '(Target KPI: 50%)', '', ...gas.map((g) => getSummaryForGa(g.ga_id)?.status || 'NOT_ASSESSED')]);

    const cqiSectionStart = rows.length;
    rows.push([]);
    rows.push(['CQI Details']);
    rows.push(['GA Code', 'GA Title', 'Status', 'Issue / Problem Statement', 'HOD Action Plan', 'Saved By', 'Saved At', 'Root Cause', 'HOD Comment', 'Implemented On', 'Action Taken', 'Resulting Attainment']);
    cqiRecords.forEach((record) => {
      rows.push([
        record.ga_code,
        record.ga_title,
        record.status,
        record.issue_statement || record.root_cause || '',
        record.hod_action_plan || '',
        record.saved_by_hod_name || record.saved_by_hod?.full_name || record.saved_by_hod?.name || '',
        record.saved_at ? new Date(record.saved_at).toLocaleString() : '',
        record.root_cause || '',
        record.hod_comment || '',
        record.implemented_in_batch_name || record.implemented_in_batch || '',
        record.action_taken_description || '',
        record.resulting_attainment !== null && record.resulting_attainment !== undefined
          ? `${Number(record.resulting_attainment).toFixed(2)}%`
          : '',
      ]);
    });

    return { selectedBatch, rows, gas, items, cqiSectionStart };
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const exportData = await getExportRows();
      if (!exportData || !reportData) return;
      const { selectedBatch, rows, gas, items, cqiSectionStart } = exportData;
      const wb = XLSX.utils.book_new();

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const maxCol = Math.max(12, rows.reduce((max, row) => Math.max(max, row.length - 1), 0));
      ws['!merges'] = [
        ...[0, 1, 2, 3, 4].map((r) => ({ s: { r, c: 0 }, e: { r, c: maxCol } })),
        { s: { r: cqiSectionStart + 1, c: 0 }, e: { r: cqiSectionStart + 1, c: 12 } },
      ];
      ws['!freeze'] = { xSplit: 3, ySplit: 7 };
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 6, c: 0 }, e: { r: 6 + items.length, c: Math.max(2, 2 + gas.length) } }) };

      // Set column widths
      const colWidths = viewMode === 'student-wise'
        ? [{ wch: 10 }, { wch: 15 }, { wch: 25 }, ...gas.map(() => ({ wch: 12 }))]
        : [{ wch: 10 }, { wch: 15 }, { wch: 30 }, ...gas.map(() => ({ wch: 12 }))];
      ws['!cols'] = [
        ...colWidths,
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 30 },
        { wch: 30 },
        { wch: 18 },
        { wch: 22 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 26 },
        { wch: 30 },
        { wch: 24 },
      ];
      ws['!rows'] = rows.map((_, index) => ({ hpt: index < 5 ? 24 : index === 6 || index === cqiSectionStart + 2 ? 32 : 22 }));

      // Apply styles
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellAddress]) continue;

          const baseBorder = {
            top: { style: 'thin', color: { rgb: 'D1D5DB' } },
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
            left: { style: 'thin', color: { rgb: 'D1D5DB' } },
            right: { style: 'thin', color: { rgb: 'D1D5DB' } },
          };

          if (R < 5) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: '1F7A6B' } },
              font: { color: { rgb: 'FFFFFF' }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: baseBorder,
            };
          } else if (R === 6) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: 'D9E1F2' } },
              font: { bold: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: baseBorder,
            };
          } else if (R > 6 && R <= 6 + items.length && C > 2) {
            // Check if cell is below threshold
            let isBelow = false;
            if (viewMode === 'student-wise') {
              const studentIdx = R - 7;
              const gaIdx = C - 3;
              const student = items[studentIdx] as StudentReport;
              if (student && !student.is_dropped) {
                const ga = sortedGas[gaIdx];
                const score = student.ga_scores.find((s) => s.ga_id === ga?.ga_id);
                isBelow = score?.is_below_threshold ?? false;
              }
            } else {
              const courseIdx = R - 7;
              const gaIdx = C - 3;
              const course = items[courseIdx] as CourseReport;
              const gaScore = course.ga_scores.find((s) => s.ga_id === sortedGas[gaIdx]?.ga_id);
              isBelow = gaScore?.is_below_threshold ?? false;
            }

            const cellValue = ws[cellAddress].v;
            const isNA = typeof cellValue === 'string' && cellValue === 'N/A';

            if (isNA) {
              ws[cellAddress].s = {
                fill: { fgColor: { rgb: 'F3F4F6' } },
                font: { color: { rgb: '9CA3AF' }, italic: true },
                alignment: { horizontal: 'center' },
                border: baseBorder,
              };
            } else if (isBelow) {
              ws[cellAddress].s = {
                fill: { fgColor: { rgb: 'FFC7CE' } },
                font: { color: { rgb: '9C0006' }, bold: true },
                alignment: { horizontal: 'center' },
              };
            } else {
              ws[cellAddress].s = { alignment: { horizontal: 'center' } };
            }
          } else if (R > 6 + items.length + 1 && R < cqiSectionStart) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: 'E2EFDA' } },
              font: { bold: true },
              alignment: { horizontal: 'center' },
            };
          } else if (R === cqiSectionStart + 1) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: 'DBEAFE' } },
              font: { bold: true, color: { rgb: '1E3A8A' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === cqiSectionStart + 2) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: 'DBEAFE' } },
              font: { bold: true, color: { rgb: '1E3A8A' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            };
          } else if (R > cqiSectionStart + 2) {
            ws[cellAddress].s = {
              alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
            };
          } else if (R > 6 + items.length + 1 && R <= 6 + items.length + 5) {
            // Summary rows
            if (C === 0 || C === 1) {
              ws[cellAddress].s = {
                fill: { fgColor: { rgb: 'E2EFDA' } },
                font: { bold: true },
                alignment: { horizontal: 'left' },
              };
            } else if (R === 6 + items.length + 5) {
              // Status row
              const gaIdx = C - 3;
              const ga = sortedGas[gaIdx];
              const summary = ga ? (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id) : undefined;
              if (summary) {
                ws[cellAddress].s = {
                  fill: {
                    fgColor: {
                      rgb:
                        summary.status === 'ACHIEVED'
                          ? 'C6EFCE'
                          : summary.status === 'BELOW_TARGET'
                            ? 'FFC7CE'
                            : 'E5E7EB',
                    },
                  },
                  font: {
                    color: {
                      rgb:
                        summary.status === 'ACHIEVED'
                          ? '006100'
                          : summary.status === 'BELOW_TARGET'
                            ? '9C0006'
                            : '374151',
                    },
                    bold: true,
                  },
                  alignment: { horizontal: 'center' },
                };
              }
            } else {
              ws[cellAddress].s = {
                  bold: true,
                  alignment: { horizontal: 'center' },
                };
            }
          } else {
            ws[cellAddress].s = { alignment: { horizontal: 'center' } };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'GA Report');

      const filename = `${viewMode === 'student-wise' ? 'Student_Wise' : 'Course_Wise'}_GA_Report_${selectedBatch?.name?.replace(/\s+/g, '_') || 'Selected_Batch'}_${new Date()
        .toISOString()
        .split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Report exported successfully');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Failed to export GA report:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const exportData = await getExportRows();
      if (!exportData || !reportData) return;
      const { selectedBatch, gas, items, cqiSectionStart, rows } = exportData;
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('GA Attainment Report', pageWidth / 2, 14, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`${selectedBatch?.program?.name || 'Program'} | ${selectedBatch?.name || 'Selected Batch'} | ${new Date().toLocaleString()}`, 14, 22);

      const header = viewMode === 'student-wise'
        ? ['Sr.', 'Reg. No.', 'Student Name', ...gas.map((g) => g.ga_code)]
        : ['Sr.', 'Course Code', 'Course Title', ...gas.map((g) => g.ga_code)];
      const body = rows.slice(7, 7 + items.length);
      autoTable(pdf, {
        startY: 28,
        head: [header],
        body,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [31, 122, 107], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 10, right: 10 },
      });

      autoTable(pdf, {
        startY: ((pdf as any).lastAutoTable?.finalY || 28) + 8,
        head: [['Metric', 'Detail', ...gas.map((g) => g.ga_code)]],
        body: rows.slice(7 + items.length + 1, 7 + items.length + 5).map((r) => [r[0], r[1], ...r.slice(3)]),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.6, overflow: 'linebreak' },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        margin: { left: 10, right: 10 },
      });

      const cqiRows = rows.slice(cqiSectionStart + 3);
      if (cqiRows.length) {
        pdf.addPage();
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.text('GA CQI Details', 14, 16);
        autoTable(pdf, {
          startY: 22,
          head: [rows[cqiSectionStart + 2]],
          body: cqiRows,
          theme: 'grid',
          styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak', valign: 'top' },
          headStyles: { fillColor: [30, 58, 138], textColor: 255 },
          margin: { left: 10, right: 10 },
        });
      }

      pdf.save(`GA_Report_${selectedBatch?.name?.replace(/\s+/g, '_') || 'Selected_Batch'}.pdf`);
      toast.success('PDF exported successfully');
      setExportModalOpen(false);
    } catch (error) {
      console.error('Failed to export GA PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 mb-6">Unified Cohort Analytics Engine</h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {/* Program Select */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Program
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedBatchId('');
                resetReportState();
              }}
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Category Select */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Batch Category
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={batchCategory}
              onChange={(e) => {
                setBatchCategory(e.target.value as BatchCategory);
                setSelectedBatchId('');
                resetReportState();
              }}
            >
              <option value="all">All Batches</option>
              <option value="ongoing">Ongoing</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          {/* Batch Select */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Batch
            </label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => {
                const nextBatchId = e.target.value;
                const nextBatch = batches.find((batch) => batch.id === nextBatchId);
                setSelectedBatchId(nextBatchId);
                if (nextBatch?.program?.id) {
                  setSelectedProgramId(nextBatch.program.id);
                }
                resetReportState();
              }}
              disabled={!selectedProgramId}
            >
              <option value="">Select a batch</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              View Mode
            </label>
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${
                  viewMode === 'student-wise'
                    ? 'bg-white text-indigo-600 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setViewMode('student-wise')}
              >
                Student-wise
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${
                  viewMode === 'course-wise'
                    ? 'bg-white text-indigo-600 shadow'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setViewMode('course-wise')}
              >
                Course-wise
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-end gap-3">
            <button
              onClick={handleRefreshReport}
              disabled={!selectedBatchId || loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
            >
              Refresh
            </button>
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={!reportData}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      <ExportChoiceModal
        open={exportModalOpen}
        title="Export GA Report"
        description="Choose PDF for a printable report or Excel for a formatted workbook."
        exporting={exporting}
        onClose={() => setExportModalOpen(false)}
        onPdf={handleExportPDF}
        onExcel={handleExportExcel}
      />

      {/* Framework Snapshot Banner */}
      <BatchFrameworkBanner
        batchId={selectedBatchId || null}
        batchName={selectedBatchName}
      />

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-bold text-gray-600">Generating report...</p>
        </div>
      )}

      {/* Readiness State */}
      {!loading && readinessInfo && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="text-amber-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Report not ready</h3>
          <p className="text-gray-600 mb-2">Please finalize all course assessments first.</p>
          <p className="text-sm text-gray-500">
            Finalized: {readinessInfo.finalized_courses} / {readinessInfo.total_courses}
          </p>
          {readinessInfo.missing_courses && readinessInfo.missing_courses.length > 0 && (
            <p className="text-sm text-amber-700 mt-2">
              Missing courses: {readinessInfo.missing_courses.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Report Display */}
      {!loading && !readinessInfo && reportData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Header */}
              <thead className="bg-gray-50">
                <tr>
                  {viewMode === 'student-wise' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Sr. No.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Reg. No.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Student Name
                      </th>
                      {sortedGas.map((ga) => (
                        <th
                          key={ga.ga_id}
                          title={`${ga.ga_code}: ${ga.ga_title}`}
                          className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200"
                        >
                          {ga.ga_code}
                          <div className="text-gray-400 font-normal text-xs mt-1 truncate max-w-[120px]">
                            {ga.ga_title}
                          </div>
                        </th>
                      ))}
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Sr. No.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Course Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200">
                        Course Title
                      </th>
                      {sortedGas.map((ga) => (
                        <th
                          key={ga.ga_id}
                          title={`${ga.ga_code}: ${ga.ga_title}`}
                          className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-200"
                        >
                          {ga.ga_code}
                        </th>
                      ))}
                    </>
                  )}
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-gray-200">
                {viewMode === 'student-wise' ? (
                  (reportData.students || [])
                    .sort((a, b) => (a.registration_number || '').localeCompare(b.registration_number || ''))
                    .map((student, idx) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.registration_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                        <div className="flex flex-col gap-1">
                          <span>{student.name}</span>
                          {student.is_frozen && (
                            <span className="inline-flex w-fit rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                              Frozen - Sem {student.frozen_at_semester || 'N/A'}
                              {student.frozen_date ? ` (since ${new Date(student.frozen_date).toLocaleDateString()})` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      {sortedGas.map((ga) => {
                        const score = (student.ga_scores || []).find((s) => s.ga_id === ga.ga_id);
                        const isBelow = score?.is_below_threshold;
                        const displayVal = student.is_dropped ? 'Dropped Out' : formatPercent(score?.direct_score);
                        const isNA = displayVal === 'N/A';
                        return (
                          <td
                            key={ga.ga_id}
                            className={`px-4 py-3 text-center text-sm font-semibold ${
                              isNA
                                ? 'bg-gray-50 text-gray-400 italic'
                                : isBelow
                                ? 'bg-red-50 text-red-800'
                                : 'text-gray-900'
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  (reportData.courses || []).map((course, idx) => (
                    <tr key={course.course_id}>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{course.course_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{course.course_title}</td>
                      {sortedGas.map((ga) => {
                        const gaScore = (course.ga_scores || []).find((s) => s.ga_id === ga.ga_id);
                        const isBelow = gaScore?.is_below_threshold;
                        const displayVal = formatPercent(gaScore?.score);
                        const isNA = displayVal === 'N/A';
                        return (
                          <td
                            key={ga.ga_id}
                            className={`px-4 py-3 text-center text-sm font-semibold ${
                              isNA
                                ? 'bg-gray-50 text-gray-400 italic'
                                : isBelow
                                ? 'bg-red-50 text-red-800'
                                : 'text-gray-900'
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>

              {/* Footer (4 summary rows + CQI row) */}
              <tfoot>
                <tr className="border-t-4 border-gray-300">
                  <td
                    colSpan={3}
                    className="px-4 py-3 bg-green-50 text-sm font-bold text-green-800"
                  >
                    Direct Attainment (%)
                  </td>
                  {sortedGas.map((ga) => {
                    const summary = (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id);
                    return (
                      <td
                        key={ga.ga_id}
                        className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-green-50"
                      >
                        {formatPercent(summary?.direct_attainment)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 bg-yellow-50 text-sm font-bold text-yellow-800"
                  >
                    Indirect Attainment (%) (From Surveys)
                  </td>
                  {sortedGas.map((ga) => {
                    const summary = (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id);
                    return (
                      <td
                        key={ga.ga_id}
                        className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-yellow-50"
                      >
                        {formatPercent(summary?.indirect_attainment)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 bg-blue-50 text-sm font-bold text-blue-800"
                  >
                    Final Combined Attainment (%) (80% Direct + 20% Indirect)
                  </td>
                  {sortedGas.map((ga) => {
                    const summary = (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id);
                    return (
                      <td
                        key={ga.ga_id}
                        className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-blue-50"
                      >
                        {formatPercent(summary?.final_attainment)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 bg-gray-100 text-sm font-bold text-gray-800"
                  >
                    Status (Target KPI: 50%)
                  </td>
                  {sortedGas.map((ga) => {
                    const summary = (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id);
                    return (
                      <td
                        key={ga.ga_id}
                        className={`px-4 py-3 text-center text-sm font-black uppercase ${
                          summary?.status === 'ACHIEVED'
                            ? 'bg-green-100 text-green-800'
                            : summary?.status === 'BELOW_TARGET'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {summary?.status ?? 'NOT ASSESSED'}
                      </td>
                    );
                  })}
                </tr>
                 <tr>
                   <td
                     colSpan={3}
                     className="px-4 py-3 bg-gray-200 text-sm font-bold text-gray-800"
                   >
                     CQI Status
                   </td>
                   {sortedGas.map((ga) => {
                     const gaStatus = gaStatusRow.find((s) => s.ga_id === ga.ga_id);
                     const summary = (reportData.cohort_summary || []).find((s) => s.ga_id === ga.ga_id);
                     const effectiveStatus = summary?.status ?? gaStatus?.status;
                     const cqiStatus = gaStatus?.cqi_status;
                     const hasCqiRecord = Boolean(gaStatus?.cqi_record_id);
                     const isClosed = cqiStatus === 'CLOSED_IMPLEMENTED' || cqiStatus === 'SAVED' && hasCqiRecord;
                     const isSaved = Boolean(
                       cqiStatus && recordedCqiStatuses.has(cqiStatus)
                     );
                     const isPending = cqiStatus && cqiStatus !== 'CLOSED_IMPLEMENTED' && !recordedCqiStatuses.has(cqiStatus);
                     return (
                       <td
                         key={ga.ga_id}
                         className={`px-4 py-3 text-center text-sm font-semibold border-t-4 border-gray-300 ${
                           effectiveStatus === 'BELOW_TARGET'
                             ? 'bg-red-50'
                             : 'bg-gray-50'
                         }`}
                       >
                          {effectiveStatus === 'BELOW_TARGET' && hasCqiRecord ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isClosed
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}>
                              {isClosed ? 'Closed' : isPending ? 'In Progress' : 'Recorded'}
                            </span>
                          ) : effectiveStatus === 'BELOW_TARGET' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                              Need CQI
                            </span>
                          ) : effectiveStatus === 'NOT_ASSESSED' ? (
                            <span className="text-xs font-bold text-gray-500">NOT ASSESSED</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                       </td>
                     );
                   })}
                 </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CQI Modal */}
      {modalOpen && currentGA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  GA-CQI: {currentGA.ga_code} ({currentGA.ga_title}) - Batch {batches.find(b => b.id === selectedBatchId)?.name}
                </h3>
                {currentGA.cqi_status === 'SAVED' && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">
                    View Only
                  </span>
                )}
              </div>
              {currentCQIRecord && (
                <p className="mt-2 text-sm text-gray-500">
                  Saved by {currentCQIRecord.saved_by_hod?.full_name || currentCQIRecord.saved_by_hod?.name || 'HOD'}
                  {currentCQIRecord.saved_at ? ` on ${new Date(currentCQIRecord.saved_at).toLocaleString()}` : ''}
                </p>
              )}
               {currentCQIRecord?.closed_by_name && (
                 <p className="mt-1 text-sm text-gray-500">
                   Closed by {currentCQIRecord.closed_by_name}
                   {currentCQIRecord.closed_at ? ` on ${new Date(currentCQIRecord.closed_at).toLocaleString()}` : ''}
                 </p>
               )}
              </div>
            <div className="p-6 space-y-4">
              {/* Issue Statement */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Issue <span className="text-gray-400">(auto-filled, editable)</span>
                </label>
                <textarea
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    currentGA.cqi_status === 'SAVED' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                  }`}
                  rows={3}
                  value={issueStatement}
                  onChange={(e) => setIssueStatement(e.target.value)}
                  disabled={currentGA.cqi_status === 'SAVED'}
                />
              </div>
              
              {/* HOD Action Plan */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  HOD Action Plan <span className="text-red-600">*</span>
                </label>
                <textarea
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    currentGA.cqi_status === 'SAVED' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                  }`}
                  rows={4}
                  value={hodActionPlan}
                  onChange={(e) => setHodActionPlan(e.target.value)}
                  disabled={currentGA.cqi_status === 'SAVED'}
                  placeholder="Enter your action plan here... (minimum 20 characters)"
                />
              </div>

              {/* Closing-loop fields - shown when status is SAVED */}
              {currentGA.cqi_status === 'SAVED' && (
                <>
                  {/* Implemented On */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Implemented On <span className="text-red-600">*</span>
                    </label>
                    <select
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        currentCQIRecord?.status === 'CLOSED_IMPLEMENTED' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                      value={implementedInBatch}
                      onChange={(e) => setImplementedInBatch(e.target.value)}
                      disabled={currentCQIRecord?.status === 'CLOSED_IMPLEMENTED'}
                    >
                      <option value="">Select a batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}
                        </option>
                      ))}
                    </select>
                    {currentCQIRecord?.implemented_in_batch_name && (
                      <p className="mt-1 text-xs text-gray-500">
                        Currently: {currentCQIRecord.implemented_in_batch_name}
                      </p>
                    )}
                  </div>

                  {/* Action Taken */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Action Taken <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        currentCQIRecord?.status === 'CLOSED_IMPLEMENTED' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                      rows={3}
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      disabled={currentCQIRecord?.status === 'CLOSED_IMPLEMENTED'}
                      placeholder="Describe the action taken and its outcome... (minimum 20 characters)"
                    />
                    {currentCQIRecord?.action_taken_description && (
                      <p className="mt-1 text-xs text-gray-500">
                        Current: {currentCQIRecord.action_taken_description}
                      </p>
                    )}
                  </div>

                  {currentCQIRecord?.resulting_attainment !== null && currentCQIRecord?.resulting_attainment !== undefined && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <span className="text-xs font-black uppercase tracking-wider text-green-700">Resulting Attainment:</span>
                      <span className="ml-2 text-sm font-bold text-green-800">{Number(currentCQIRecord.resulting_attainment).toFixed(2)}%</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {currentGA.cqi_status === 'SAVED' ? 'Close' : 'Cancel'}
              </button>
              {currentGA.cqi_status !== 'SAVED' && (
                <button
                  onClick={handleSaveCQI}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  Save CQI Record
                </button>
              )}
              {currentGA.cqi_status === 'SAVED' && currentCQIRecord?.status !== 'CLOSED_IMPLEMENTED' && (
                <button
                  onClick={handleCloseCQI}
                  disabled={closing}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  {closing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : null}
                  Close CQI Loop
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GAReport;

