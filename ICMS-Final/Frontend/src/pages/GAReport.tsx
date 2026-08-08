import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';
import obeService, { Batch, GACQIRecord } from '../api/obeService';

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
  const [saving, setSaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

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
          setSelectedBatchId(batchesData[0].id);
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
      return;
    }

    const fetchReport = async () => {
      const hasVisibleData = Boolean(reportData || readinessInfo);
      setLoading(!hasVisibleData);
      
      try {
        const data = await obeService.getBatchGAReport(selectedBatchId, {
          mode: 'cumulative',
          scope: viewMode === 'student-wise' ? 'all_students' : 'course_wise',
        });

        // Check if it's a readiness response
        if ('ready' in data && !data.ready) {
          setReadinessInfo(data);
        } else {
          setReportData(data as unknown as AllStudentsReportData);
          setReadinessInfo(null);
        }
      } catch (error) {
        console.error('Failed to fetch GA report:', error);
        toast.error('Failed to fetch GA report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedBatchId, viewMode, refreshTick]);

  // Fetch GA Status Row when program and batch are selected
  useEffect(() => {
    if (!selectedProgramId || !selectedBatchId) {
      setGAStatusRow([]);
      return;
    }
    const fetchGAStatusRow = async () => {
      try {
        const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
        setGAStatusRow(data);
      } catch (error) {
        console.error('Failed to fetch GA status row:', error);
      }
    };
    fetchGAStatusRow();
  }, [selectedProgramId, selectedBatchId, refreshTick]);

  useEffect(() => {
    if (!selectedBatchId) {
      return;
    }

    const bumpRefresh = () => setRefreshTick((tick) => tick + 1);
    const intervalId = window.setInterval(bumpRefresh, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        bumpRefresh();
      }
    };

    const handleFocus = () => bumpRefresh();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedBatchId]);

  // Handle Trigger CQI button click
  const handleTriggerCQI = async (ga: GAStatusRow) => {
    try {
      setSaving(true);
      // Re-fetch to get the latest record
      const data = await obeService.getGAStatusRow(selectedProgramId, selectedBatchId);
      setGAStatusRow(data);
      const updatedGA = data.find(g => g.ga_id === ga.ga_id);
      if (!updatedGA) {
        toast.error('GA not found');
        return;
      }
      setCurrentGA(updatedGA);
      // Reset fields first
      setIssueStatement('');
      setHodActionPlan('');
      setCurrentCQIRecord(null);
      // Fetch the actual CQI record if it exists
      if (updatedGA.cqi_record_id) {
        try {
          const record = await obeService.getGACQIRecord(updatedGA.cqi_record_id);
          setCurrentCQIRecord(record);
          setIssueStatement(record.issue_statement || '');
          setHodActionPlan(record.hod_action_plan || '');
        } catch (err) {
          console.error('Failed to fetch CQI record:', err);
        }
      }
      setModalOpen(true);
    } catch (error) {
      console.error('Failed to trigger CQI:', error);
      toast.error('Failed to trigger CQI');
    } finally {
      setSaving(false);
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

  const handleExport = async () => {
    if (!reportData) {
      toast.error('No report data to export');
      return;
    }

    try {
      const selectedBatch = batches.find((b) => b.id === selectedBatchId);
      const wb = XLSX.utils.book_new();
      const cqiRecords = selectedProgramId && selectedBatchId
        ? await obeService.getGACQIAdvisoryExport(selectedProgramId, selectedBatchId)
        : [];
      const rows: any[][] = [
        [selectedBatch?.program?.name || 'Program Name'],
        ['Department: ' + (selectedBatch?.program?.department || 'Computer Science')],
        ['Batch: ' + (selectedBatch?.name || 'Selected Batch')],
        [viewMode === 'student-wise' ? 'Student-wise Cohort Attainment' : 'Course-wise PLO Contribution'],
        ['Date: ' + new Date().toLocaleDateString()],
        [],
      ];

      // Header row
      const gas = reportData.gas || [];
      const header = viewMode === 'student-wise'
        ? ['Sr. No.', 'Reg. No.', 'Student Name', ...gas.map((g) => g.ga_code)]
        : ['Sr. No.', 'Course Code', 'Course Title', ...gas.map((g) => g.ga_code)];
      rows.push(header);

      const items = viewMode === 'student-wise' ? (reportData.students || []) : (reportData.courses || []);

      // Data rows
      items.forEach((item, idx) => {
        if ('name' in item) {
          // Student row
          const student = item as StudentReport;
          if (student.is_dropped || student.is_frozen) {
            const row = [
              idx + 1,
              student.registration_number,
              student.name,
              ...Array(reportData.gas.length).fill(student.is_dropped ? 'Dropped Out' : 'Semester Frozen'),
            ];
            rows.push(row);
          } else {
            const row = [
              idx + 1,
              student.registration_number,
              student.name,
              ...reportData.gas.map((g) => {
                const score = student.ga_scores.find((s) => s.ga_id === g.ga_id)?.direct_score;
                return formatPercent(score);
              }),
            ];
            rows.push(row);
          }
        } else {
          // Course row
          const course = item as CourseReport;
          const row = [
            idx + 1,
            course.course_code,
            course.course_title,
            ...reportData.gas.map((g) => {
              const score = course.ga_scores.find((s) => s.ga_id === g.ga_id)?.score;
              return formatPercent(score);
            }),
          ];
          rows.push(row);
        }
      });

      // Footer rows (4 summary rows)
      const cohortSummary = reportData.cohort_summary || [];
      const dividerRow = ['', '', '', ...Array(gas.length).fill('')];
      rows.push(dividerRow);
      rows.push([
        'Direct Attainment (%)',
        '(From Exams/Labs)',
        '',
        ...cohortSummary.map((s) => formatPercent(s.direct_attainment)),
      ]);
      rows.push([
        'Indirect Attainment (%)',
        '(From Surveys)',
        '',
        ...cohortSummary.map((s) => formatPercent(s.indirect_attainment)),
      ]);
      rows.push([
        'Final Combined Attainment (%)',
        '(80% Direct + 20% Indirect)',
        '',
        ...cohortSummary.map((s) => formatPercent(s.final_attainment)),
      ]);
      rows.push([
        'Status',
        '(Target KPI: 50%)',
        '',
        ...cohortSummary.map((s) => s.status),
      ]);

      const cqiSectionStart = rows.length;
      rows.push([]);
      rows.push(['CQI Details']);
      rows.push([
        'GA Code',
        'GA Title',
        'Status',
        'Issue / Problem Statement',
        'HOD Action Plan',
        'Saved By',
        'Saved At',
        'Root Cause',
        'Remedial Plan',
        'HOD Comment',
      ]);
      cqiRecords.forEach((record) => {
        rows.push([
          record.ga_code,
          record.ga_title,
          record.status,
          record.issue_statement || record.root_cause || '',
          record.hod_action_plan || record.remedial_plan || '',
          record.saved_by_hod_name || record.saved_by_hod?.full_name || record.saved_by_hod?.name || '',
          record.saved_at ? new Date(record.saved_at).toLocaleString() : '',
          record.root_cause || '',
          record.remedial_plan || '',
          record.hod_comment || '',
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);

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
      ];

      // Apply styles
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellAddress]) continue;

          if (R < 5) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: '1F7A6B' } },
              font: { color: { rgb: 'FFFFFF' }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === 6) {
            ws[cellAddress].s = {
              fill: { fgColor: { rgb: 'D9E1F2' } },
              font: { bold: true },
              alignment: { horizontal: 'center' },
            };
          } else if (R > 6 && R <= 6 + items.length && C > 2) {
            // Check if cell is below threshold
            let isBelow = false;
            if (viewMode === 'student-wise') {
              const studentIdx = R - 7;
              const gaIdx = C - 3;
              const student = items[studentIdx] as StudentReport;
              if (student && !student.is_dropped && !student.is_frozen) {
                const ga = reportData.gas[gaIdx];
                const score = student.ga_scores.find((s) => s.ga_id === ga?.ga_id);
                isBelow = score?.is_below_threshold ?? false;
              }
            } else {
              const courseIdx = R - 7;
              const gaIdx = C - 3;
              const course = items[courseIdx] as CourseReport;
              const gaScore = course.ga_scores.find((s) => s.ga_id === reportData.gas[gaIdx].ga_id);
              isBelow = gaScore?.is_below_threshold ?? false;
            }

            if (isBelow) {
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
              const summaryIdx = C - 3;
              const summary = reportData.cohort_summary[summaryIdx];
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
    } catch (error) {
      console.error('Failed to export GA report:', error);
      toast.error('Failed to export report');
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
              onChange={(e) => setSelectedBatchId(e.target.value)}
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
              onClick={handleExport}
              disabled={!reportData}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg"
            >
              Export to Excel
            </button>
          </div>
        </div>
      </div>

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
                      {(reportData.gas || []).map((ga) => (
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
                      {(reportData.gas || []).map((ga) => (
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
                  (reportData.students || []).map((student, idx) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{student.registration_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{student.name}</td>
                      {(reportData.gas || []).map((ga) => {
                        const score = (student.ga_scores || []).find((s) => s.ga_id === ga.ga_id);
                        const isBelow = score?.is_below_threshold;
                        return (
                          <td
                            key={ga.ga_id}
                            className={`px-4 py-3 text-center text-sm font-semibold ${
                              isBelow
                                ? 'bg-red-50 text-red-800'
                                : 'text-gray-900'
                            }`}
                          >
                        {student.is_dropped || student.is_frozen ? (
                              student.is_dropped ? 'Dropped Out' : 'Semester Frozen'
                            ) : (
                              formatPercent(score?.direct_score)
                            )}
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
                      {(reportData.gas || []).map((ga) => {
                        const gaScore = (course.ga_scores || []).find((s) => s.ga_id === ga.ga_id);
                        const isBelow = gaScore?.is_below_threshold;
                        return (
                          <td
                            key={ga.ga_id}
                            className={`px-4 py-3 text-center text-sm font-semibold ${
                              isBelow
                                ? 'bg-red-50 text-red-800'
                                : 'text-gray-900'
                            }`}
                          >
                            {formatPercent(gaScore?.score)}
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
                  {(reportData.gas || []).map((ga) => {
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
                  {(reportData.gas || []).map((ga) => {
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
                  {(reportData.gas || []).map((ga) => {
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
                  {(reportData.gas || []).map((ga) => {
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
                    CQI Action
                  </td>
                  {(reportData.gas || []).map((ga) => {
                    const gaStatus = gaStatusRow.find((s) => s.ga_id === ga.ga_id);
                    const isSaved = gaStatus?.cqi_status === 'SAVED';
                    return (
                      <td
                        key={ga.ga_id}
                        className={`px-4 py-3 text-center text-sm font-semibold border-t-4 border-gray-300 ${
                          gaStatus?.status === 'BELOW_TARGET'
                            ? 'bg-red-50'
                            : 'bg-gray-50'
                        }`}
                      >
                        {gaStatus?.status === 'BELOW_TARGET' ? (
                          <div className="mx-auto max-w-[220px] rounded-xl border-2 border-red-300 bg-white px-3 py-3 shadow-sm">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-600 mb-2">
                              BELOW_TARGET
                            </div>
                            {isSaved ? (
                              <button
                                className="text-green-700 hover:text-green-900 font-bold underline underline-offset-2"
                                onClick={() => handleTriggerCQI(gaStatus)}
                              >
                                ✅ CQI Recorded (View)
                              </button>
                            ) : (
                              <button
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                onClick={() => handleTriggerCQI(gaStatus)}
                              >
                                ⚠ Trigger CQI
                              </button>
                            )}
                          </div>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GAReport;

