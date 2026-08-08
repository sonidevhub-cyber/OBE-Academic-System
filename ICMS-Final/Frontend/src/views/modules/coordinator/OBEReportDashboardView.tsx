import React, { useEffect, useRef, useState } from 'react';
import { Users, Target, FileText, Search, BookOpen, TrendingUp, LoaderCircle, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import html2canvas from 'html2canvas';
import { pdf } from '@react-pdf/renderer';
import OBEReportPDF from './OBEReportPDF';
import logo2 from '../../../assets/logo2.png';
import academicStructureService, { Program } from '../../../api/academicStructureService';
import obeService, {
  Batch,
  BatchGAReportResponse,
  CLOCQIListItem,
  CLOReportResponse,
  CourseSession,
  GACQIRecord,
  GAReportItem,
} from '../../../api/obeService';
import peoService, { PEOCQIRecord, PEOReportItem } from '../../../api/peoService';

type SemesterFilter = 'all' | string;
type BatchCategory = 'all' | 'ongoing' | 'graduated';

interface DashboardGAItem {
  ga_id: string;
  ga_code: string;
  ga_title: string;
  directAttainment: number;
  indirectAttainment: number;
  totalAttainment: number;
  targetKpi: number;
  cqiTriggered: 'Yes' | 'No';
}

interface DashboardPEOItem {
  id: string;
  statement: string;
  targetKpi: number;
  directScore: number;
  indirectScore: number;
  finalAttainment: number;
  status: 'Met' | 'Not Met';
}

interface DashboardCLOCourse {
  id: string;
  code: string;
  name: string;
  semester: number;
  clo_summary: Array<{
    clo: string;
    percentage: number;
    achieved: boolean;
  }>;
  overall_status: string;
}

interface DashboardCQIRow {
  type: 'CLO' | 'GA' | 'PEO';
  item: string;
  detail: string;
  reason: string;
  remedy: string;
  status?: string;
  courseId?: string;
  semester?: number;
}

interface DashboardCLOGroup {
  semester: number;
  courses: DashboardCLOCourse[];
}

interface DashboardState {
  batch: Batch | null;
  totalStudents: number;
  isProgramEndReady: boolean;
  readiness: {
    ready: boolean;
    finalized_courses: number;
    total_courses: number;
    pending_courses: string[];
  } | null;
  gaRows: DashboardGAItem[];
  peoRows: DashboardPEOItem[];
  cloGroups: DashboardCLOGroup[];
  cloCqiRows: DashboardCQIRow[];
  gaCqiRows: DashboardCQIRow[];
  peoCqiRows: DashboardCQIRow[];
}

const OBEReportDashboard: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [batchCategory, setBatchCategory] = useState<BatchCategory>('all');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<SemesterFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);

  const gaChartRef = useRef<HTMLDivElement>(null);
  const peoChartRef = useRef<HTMLDivElement>(null);

  const filteredBatches = selectedProgramId
    ? batches.filter((batch) => {
        if (batch.program?.id !== selectedProgramId) return false;
        if (batchCategory === 'ongoing') return batch.status === 'active';
        if (batchCategory === 'graduated') return batch.status === 'graduated';
        return true;
      })
    : batches.filter((batch) => {
        if (batchCategory === 'ongoing') return batch.status === 'active';
        if (batchCategory === 'graduated') return batch.status === 'graduated';
        return true;
      });

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) || null;
  const selectedProgram =
    programs.find((program) => program.id === selectedProgramId) ||
    (selectedBatch?.program ? (selectedBatch.program as Program) : null);

  const availableSemesters = Array.from(
    new Set(dashboard?.cloGroups.map((group) => String(group.semester)) || [])
  )
    .map((semester) => Number(semester))
    .filter((semester) => !Number.isNaN(semester))
    .sort((a, b) => a - b);

  const filteredCLOGroups = (dashboard?.cloGroups || [])
    .filter((group) => selectedSemester === 'all' || String(group.semester) === selectedSemester)
    .map((group) => ({
      semester: group.semester,
      courses: group.courses.filter(
        (course) =>
          course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.courses.length > 0)
    .sort((a, b) => a.semester - b.semester);

  const visibleCourseIds = new Set(filteredCLOGroups.flatMap((group) => group.courses.map((course) => course.id)));
  const filteredCloCqiRows = (dashboard?.cloCqiRows || []).filter(
    (row) => !row.courseId || visibleCourseIds.has(row.courseId)
  );

  const gaRadarData = dashboard?.gaRows.map((ga) => ({
    ga: ga.ga_code,
    Attainment: ga.totalAttainment,
    Target: ga.targetKpi,
  })) || [];

  const peoChartData = dashboard?.peoRows.map((peo) => ({
    name: peo.id,
    Attainment: peo.finalAttainment,
    Target: peo.targetKpi,
  })) || [];

  const loadDashboard = async (batchId: string) => {
    if (!batchId) {
      setDashboard(null);
      return;
    }

    setRefreshing(Boolean(dashboard));
    try {
      const currentBatch = batches.find((batch) => batch.id === batchId) || selectedBatch;
      const [gaReport, peoReport, sessionRes, studentRes, programPeos, peoCqiRecords] = await Promise.all([
        obeService.getBatchGAReport(batchId, { mode: 'cumulative', scope: 'cohort' }),
        peoService.getPEOReports(batchId),
        obeService.getCourseSessions(batchId),
        obeService.getBatchStudents(batchId),
        currentBatch?.program?.id ? obeService.getProgramPEOs(currentBatch.program.id) : Promise.resolve([]),
        peoService.getPEOCQIRecords(batchId),
      ]);

      const sessions = sessionRes.sessions || [];
      const courseReports = await Promise.all(
        sessions.map(async (session: CourseSession) => {
          try {
            const report = (await obeService.getCourseCLOReport(session.id)) as CLOReportResponse;
            const cloSummary = (report.clo_summary || []).map((clo) => ({
              clo: clo.clo_code,
              percentage: clo.overall_attainment ?? 0,
              achieved: clo.status === 'ACHIEVED',
            }));

            return {
              semester: session.semester?.number ?? report.course.semester ?? 0,
              course: {
                id: session.id,
                code: report.course.code,
                name: report.course.title,
                semester: session.semester?.number ?? report.course.semester ?? 0,
                clo_summary: cloSummary,
                overall_status:
                  cloSummary.length === 0
                    ? 'Not Assessed'
                    : cloSummary.every((item) => item.achieved)
                      ? 'Achieved'
                      : 'Not Achieved',
              },
              cqiList: report.cqi_list || [],
            };
          } catch (courseErr) {
            console.warn(`Skipping CLO report for session ${session.id}`, courseErr);
            return null;
          }
        })
      );

      const cloGroupsMap = new Map<number, DashboardCLOCourse[]>();
      courseReports
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .forEach(({ semester, course }) => {
          if (!semester) return;
          if (!cloGroupsMap.has(semester)) {
            cloGroupsMap.set(semester, []);
          }
          cloGroupsMap.get(semester)?.push(course);
        });

      const cloGroups: DashboardCLOGroup[] = Array.from(cloGroupsMap.entries())
        .map(([semester, courses]) => ({
          semester,
          courses: courses.sort((a, b) => a.code.localeCompare(b.code)),
        }))
        .sort((a, b) => a.semester - b.semester);

      const cloCqiRows: DashboardCQIRow[] = [];
      courseReports
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .forEach(({ semester, course, cqiList }) => {
          const cqiByClo = new Map<string, CLOCQIListItem[]>();
          (cqiList || []).forEach((cqi) => {
            const existing = cqiByClo.get(cqi.clo_code) || [];
            existing.push(cqi);
            cqiByClo.set(cqi.clo_code, existing);
          });

          course.clo_summary
            .filter((clo) => !clo.achieved)
            .forEach((clo) => {
              const matches = cqiByClo.get(clo.clo) || [];
              if (matches.length === 0) {
                cloCqiRows.push({
                  type: 'CLO',
                  item: `${course.code} - ${clo.clo}`,
                  detail: `${course.name} | Attainment ${clo.percentage.toFixed(1)}%`,
                  reason: `Below target at ${clo.percentage.toFixed(1)}%`,
                  remedy: 'Pending CQI action plan',
                  courseId: course.id,
                  semester,
                  status: 'BELOW_TARGET',
                });
                return;
              }

              matches.forEach((cqi) => {
                cloCqiRows.push({
                  type: 'CLO',
                  item: `${course.code} - ${cqi.clo_code}`,
                  detail: cqi.instructor ? `${course.name} | ${cqi.instructor}` : course.name,
                  reason: cqi.reason || `Below target at ${clo.percentage.toFixed(1)}%`,
                  remedy: cqi.action_plan || 'Pending CQI action plan',
                  courseId: course.id,
                  semester,
                  status: cqi.status,
                });
              });
            });
        });

      const gaReportData = gaReport as BatchGAReportResponse;
      const gaReportItems: GAReportItem[] = gaReportData?.ga_reports || [];
      const gaRows: DashboardGAItem[] = gaReportItems.map(
        (item: GAReportItem) => ({
          ga_id: item.ga_id,
          ga_code: item.ga_code,
          ga_title: item.ga_title,
          directAttainment: Number(item.direct_score ?? 0),
          indirectAttainment: Number(item.indirect_score ?? 0),
          totalAttainment: Number(item.ga_attainment ?? 0),
          targetKpi: Number(item.ga_kpi_threshold ?? item.kpi_threshold ?? 0),
          cqiTriggered: item.status === 'BELOW_TARGET' ? 'Yes' : 'No',
        })
      );

      const gaCqiRows: DashboardCQIRow[] = gaReportItems
        .filter((item) => item.status === 'BELOW_TARGET')
        .map((item) => {
          const activeRecords = (item.ga_cqi_records || []).filter((record) => record.is_active !== false);
          const sourceRecords = activeRecords.length > 0 ? activeRecords : item.ga_cqi_records || [];
          const latestRecord = [...sourceRecords].sort(
            (a: GACQIRecord, b: GACQIRecord) =>
              new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
          )[0];

          return {
            type: 'GA',
            item: `${item.ga_code} - ${item.ga_title}`,
            detail: `Attainment ${Number(item.ga_attainment ?? 0).toFixed(1)}% / Target ${Number(item.ga_kpi_threshold ?? item.kpi_threshold ?? 0).toFixed(1)}%`,
            reason:
              latestRecord?.issue_statement ||
              latestRecord?.root_cause ||
              `Below target at ${Number(item.ga_attainment ?? 0).toFixed(1)}%`,
            remedy:
              latestRecord?.hod_action_plan ||
              latestRecord?.remedial_plan ||
              'Pending CQI action plan',
            status: latestRecord?.status || item.status,
          };
        });

      const peoThresholdMap = new Map<string, number>();
      (programPeos || []).forEach((peo: any) => {
        peoThresholdMap.set(`PEO-${peo.order_number}`, Number(peo.kpi_threshold ?? 70));
      });

      const peoCqiById = new Map<string, PEOCQIRecord>();
      const peoCqiByCode = new Map<string, PEOCQIRecord>();
      (peoCqiRecords || []).forEach((record) => {
        peoCqiById.set(record.peo, record);
        peoCqiByCode.set(record.peo_code, record);
      });

      const peoRows: DashboardPEOItem[] = (peoReport || []).map((item: PEOReportItem) => {
        const targetKpi = Number(
          peoThresholdMap.get(item.peo_code || '') ?? item.breakdown?.target_kpi ?? 70
        );

        return {
          id: item.peo_code || item.peo_id || item.peo_title,
          statement: item.peo_title,
          targetKpi,
          directScore: Number(item.direct_score ?? 0),
          indirectScore: Number(item.indirect_score ?? 0),
          finalAttainment: Number(item.final_score ?? 0),
          status:
            item.final_score !== null && Number(item.final_score) >= targetKpi
              ? 'Met'
              : 'Not Met',
        };
      });

      const peoCqiRows: DashboardCQIRow[] = (peoReport || [])
        .filter((item: PEOReportItem) => {
          const targetKpi = Number(
            peoThresholdMap.get(item.peo_code || '') ?? item.breakdown?.target_kpi ?? 70
          );
          return item.final_score === null || Number(item.final_score) < targetKpi;
        })
        .map((item: PEOReportItem) => {
          const targetKpi = Number(
            peoThresholdMap.get(item.peo_code || '') ?? item.breakdown?.target_kpi ?? 70
          );
          const cqiRecord = peoCqiById.get(item.peo_id) || peoCqiByCode.get(item.peo_code);

          return {
            type: 'PEO',
            item: `${item.peo_code || item.peo_id} - ${item.peo_title}`,
            detail: `Final ${Number(item.final_score ?? 0).toFixed(1)}% / Target ${targetKpi.toFixed(1)}%`,
            reason: cqiRecord?.root_cause || `Below target at ${Number(item.final_score ?? 0).toFixed(1)}%`,
            remedy: cqiRecord?.remedial_plan || 'Pending CQI action plan',
            status: cqiRecord?.status || 'CQI_TRIGGERED',
          };
        });

      setDashboard({
        batch: batches.find((batch) => batch.id === batchId) || null,
        totalStudents: studentRes.length || 0,
        isProgramEndReady: Boolean(gaReportData?.is_program_end_ready),
        readiness: gaReportData?.readiness
          ? {
              ready: Boolean(gaReportData.readiness.ready),
              finalized_courses: Number(gaReportData.readiness.finalized_courses || 0),
              total_courses: Number(gaReportData.readiness.total_courses || 0),
              pending_courses: gaReportData.readiness.pending_courses || [],
            }
          : null,
        gaRows,
        peoRows,
        cloGroups,
        cloCqiRows,
        gaCqiRows,
        peoCqiRows,
      });
    } catch (err) {
      console.error('Failed to load batch report data:', err);
      setError('Failed to load live report data for the selected batch.');
      setDashboard(null);
    } finally {
      setRefreshing(false);
    }
  };

  const loadInitialData = async () => {
    setError(null);
    try {
      const [programRes, batchRes] = await Promise.all([
        academicStructureService.getPrograms(),
        obeService.getAllBatches({ alumni_feedback: 'all' }),
      ]);

      const loadedPrograms = programRes.data || [];
      const loadedBatches = batchRes || [];

      setPrograms(loadedPrograms);
      setBatches(loadedBatches);

      const defaultBatch = loadedBatches[0] || null;
      if (defaultBatch) {
        setSelectedBatchId(defaultBatch.id);
        setSelectedProgramId(defaultBatch.program?.id || loadedPrograms[0]?.id || '');
      } else if (loadedPrograms[0]) {
        setSelectedProgramId(loadedPrograms[0].id);
      }
    } catch (err) {
      console.error('Failed to load OBE dashboard data:', err);
      setError('Failed to load report dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProgramId || filteredBatches.length === 0) {
      return;
    }

    if (!filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(filteredBatches[0].id);
    }
  }, [selectedProgramId, filteredBatches, selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId && !filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(filteredBatches[0]?.id || '');
    }
  }, [batchCategory, filteredBatches, selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId) {
      return;
    }

    const batch = batches.find((item) => item.id === selectedBatchId);
    if (batch?.program?.id && batch.program.id !== selectedProgramId) {
      setSelectedProgramId(batch.program.id);
    }

    void loadDashboard(selectedBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedSemester !== 'all' && !availableSemesters.includes(Number(selectedSemester))) {
      setSelectedSemester('all');
    }
  }, [availableSemesters, selectedSemester]);

  const handleExportPDF = async () => {
    if (!dashboard) {
      return;
    }

    setExporting(true);
    try {
      let gaChartImage = '';
      let peoChartImage = '';

      if (gaChartRef.current) {
        const canvas = await html2canvas(gaChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        gaChartImage = canvas.toDataURL('image/png');
      }

      if (peoChartRef.current) {
        const canvas = await html2canvas(peoChartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        peoChartImage = canvas.toDataURL('image/png');
      }

      const programName = selectedProgram?.name || 'All Programs';
      const batchName = selectedBatch?.name || 'Selected Batch';

      const doc = (
        <OBEReportPDF
          logoUrl={logo2}
          programName={programName}
          batchName={batchName}
          cloGroups={dashboard.cloGroups.map((group) => ({
            semester: group.semester,
            courses: group.courses,
          }))}
          gaData={dashboard.gaRows.map((ga) => ({
            id: ga.ga_code,
            name: ga.ga_title,
            directAttainment: ga.directAttainment,
            indirectAttainment: ga.indirectAttainment,
            totalAttainment: ga.totalAttainment,
            cqiTriggered: ga.cqiTriggered,
          }))}
          gaChartImage={gaChartImage}
          peoData={dashboard.peoRows.map((peo) => ({
            id: peo.id,
            statement: peo.statement,
            targetKpi: peo.targetKpi,
            directScore: peo.directScore,
            indirectScore: peo.indirectScore,
            finalAttainment: peo.finalAttainment,
            status: peo.status,
          }))}
          peoChartImage={peoChartImage}
          cloCqiRows={dashboard.cloCqiRows}
          gaCqiRows={dashboard.gaCqiRows}
          peoCqiRows={dashboard.peoCqiRows}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OBE_Report_${batchName}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const achievedCount = dashboard?.gaRows.filter((row) => row.cqiTriggered === 'No').length || 0;
  const gaAchievementRate =
    dashboard && dashboard.gaRows.length > 0
      ? Math.round((achievedCount / dashboard.gaRows.length) * 100)
      : 0;

  // CHANGED: returns null (renders nothing) when there are no CQI rows —
  // no heading, no card, no "no entries found" message
  const renderCqiSummarySection = (
    title: string,
    rows: DashboardCQIRow[],
    accentClassName: string
  ) => {
    if (!rows || rows.length === 0) {
      return null;
    }

    return (
      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-black text-gray-900">{title}</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${accentClassName}`}>
            {rows.length} item{rows.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">Item</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Detail</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Reason</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Remedy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.type}-${row.item}-${index}`} className="border-b border-gray-100 align-top">
                  <td className="p-4 font-semibold text-gray-900">{row.item}</td>
                  <td className="p-4 text-gray-700">{row.detail}</td>
                  <td className="p-4 text-gray-700">{row.reason}</td>
                  <td className="p-4 text-gray-700">{row.remedy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
        <div className="h-12 w-12 animate-spin mx-auto mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-xl font-bold text-gray-600">Loading live OBE reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {refreshing && !error && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm font-semibold text-indigo-700 flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Refreshing live report data...
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Program
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Batch Category
            </label>
            <select
              value={batchCategory}
              onChange={(e) => {
                setBatchCategory(e.target.value as BatchCategory);
                setSelectedBatchId('');
              }}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Batches</option>
              <option value="ongoing">Ongoing</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Batch</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex items-center justify-end gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => void loadDashboard(selectedBatchId)}
                disabled={!selectedBatchId || refreshing}
                className="shrink-0 flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-blue-800/90 via-blue-900/80 to-indigo-900/90 px-4 py-2.5 font-semibold text-white shadow-xl shadow-blue-950/15 backdrop-blur-md transition-all hover:border-white/25 hover:from-blue-700/95 hover:via-blue-800/90 hover:to-indigo-800/95 disabled:opacity-60"
              >
                <RefreshCw size={18} />
                Refresh
              </button>

              <button
                onClick={handleExportPDF}
                disabled={exporting || !dashboard}
                className="shrink-0 flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-blue-700/90 via-indigo-800/85 to-blue-900/90 px-6 py-2.5 font-semibold text-white shadow-xl shadow-blue-950/15 backdrop-blur-md transition-all hover:border-white/25 hover:from-blue-600/95 hover:via-indigo-700/90 hover:to-blue-800/95 disabled:opacity-60"
              >
                <FileText size={18} />
                {exporting ? 'Generating PDF...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Batch</p>
              <p className="text-2xl font-black text-gray-900">{selectedBatch?.name || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Students</p>
              <p className="text-2xl font-black text-gray-900">{dashboard?.totalStudents ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Overall KPI Status</p>
              <p className="text-2xl font-black text-gray-900">
                {dashboard?.gaRows.length
                  ? `${gaAchievementRate}% Achieved`
                  : dashboard?.isProgramEndReady
                    ? 'Program ready'
                    : 'No GA data'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-black text-gray-900">Course wise CLO Attainment</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-gray-50 border-none rounded-xl px-4 py-2 font-semibold text-gray-700 focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Semesters</option>
              {availableSemesters.map((semester) => (
                <option key={semester} value={String(semester)}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredCLOGroups.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-semibold rounded-2xl border border-gray-100">
            No course reports found for the selected batch.
          </div>
        ) : (
          filteredCLOGroups.map((group) => {
            const cloLabels = Array.from(
              new Set(group.courses.flatMap((course) => course.clo_summary.map((item) => item.clo)))
            ).sort();

            return (
              <div key={group.semester} className="mb-8 last:mb-0">
                <h3 className="text-lg font-black text-purple-700 mb-3">Semester {group.semester}</h3>

                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                        <th className="p-4 font-black text-xs uppercase tracking-wider">Course Code</th>
                        <th className="p-4 font-black text-xs uppercase tracking-wider">Course Name</th>
                        {cloLabels.map((clo) => (
                          <th key={clo} className="p-4 font-black text-xs uppercase tracking-wider text-center">
                            {clo}
                          </th>
                        ))}
                        <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.courses.map((course) => (
                        <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-semibold text-gray-900">{course.code}</td>
                          <td className="p-4 text-gray-700">{course.name}</td>
                          {cloLabels.map((cloLabel) => {
                            const match = course.clo_summary.find((item) => item.clo === cloLabel);
                            if (!match) {
                              return (
                                <td key={cloLabel} className="p-4 text-center text-gray-300">
                                  —
                                </td>
                              );
                            }
                            return (
                              <td
                                key={cloLabel}
                                className={`p-4 text-center font-bold ${
                                  match.achieved ? 'text-green-700' : 'text-red-600'
                                }`}
                              >
                                {match.percentage.toFixed(1)}%
                              </td>
                            );
                          })}
                          <td className="p-4 text-center">
                            <span
                              className={`px-4 py-1 rounded-full text-xs font-black uppercase ${
                                course.overall_status === 'Achieved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {course.overall_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}

        {renderCqiSummarySection(
          'CLO CQI Summary',
          filteredCloCqiRows,
          'bg-purple-100 text-purple-700'
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-8 h-8 text-green-600" />
          <h2 className="text-2xl font-black text-gray-900">GA Attainment</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Total GAs</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{dashboard?.gaRows.length || 0}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Achieved</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{achievedCount}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">CQI Triggered</p>
            <p className="text-2xl font-black text-gray-900 mt-1">
              {dashboard?.gaRows.filter((row) => row.cqiTriggered === 'Yes').length || 0}
            </p>
          </div>
        </div>

        <div ref={gaChartRef} className="mb-8 p-6 bg-white rounded-2xl border border-gray-100">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
            Attainment vs target
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <RadarChart data={gaRadarData} outerRadius="75%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="ga" tick={{ fill: '#374151', fontSize: 13, fontWeight: 600 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} tickCount={5} />
              <Radar
                name="Attainment"
                dataKey="Attainment"
                stroke="#059669"
                strokeWidth={2}
                fill="#10b981"
                fillOpacity={0.35}
                dot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
              />
              <Radar
                name="Target"
                dataKey="Target"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="5 3"
                fill="#f59e0b"
                fillOpacity={0.08}
                dot={{ r: 3, fill: '#d97706', strokeWidth: 0 }}
              />
              <Legend wrapperStyle={{ fontSize: 13, fontWeight: 600, paddingTop: 12 }} iconType="circle" />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">GA ID</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Attribute Name</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">
                  Direct Attainment (%)
                </th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">
                  Indirect Attainment (%)
                </th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">
                  Total Attainment (%)
                </th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">CQI Triggered</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.gaRows.map((ga) => (
                <tr key={ga.ga_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-semibold text-gray-900">{ga.ga_code}</td>
                  <td className="p-4 text-gray-700">{ga.ga_title}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">
                    {ga.directAttainment.toFixed(1)}
                  </td>
                  <td className="p-4 text-center font-semibold text-gray-700">
                    {ga.indirectAttainment.toFixed(1)}
                  </td>
                  <td className="p-4 text-center font-black text-gray-900">
                    {ga.totalAttainment.toFixed(1)}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-4 py-1 rounded-full text-xs font-black uppercase ${
                        ga.cqiTriggered === 'Yes'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {ga.cqiTriggered}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderCqiSummarySection(
          'GA CQI Details',
          dashboard?.gaCqiRows || [],
          'bg-green-100 text-green-700'
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-8 h-8 text-indigo-600" />
          <h2 className="text-2xl font-black text-gray-900">PEO Attainment</h2>
        </div>

        <div
          ref={peoChartRef}
          className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl border border-indigo-100"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peoChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Attainment" fill="#4f46e5" />
              <Bar dataKey="Target" fill="#a5b4fc" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">PEO ID</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">PEO Statement</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Target KPI (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Direct Score (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Indirect Score (%)</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">
                  Final Attainment (%)
                </th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard?.peoRows.map((peo) => (
                <tr key={peo.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-semibold text-gray-900">{peo.id}</td>
                  <td className="p-4 text-gray-700 max-w-xs truncate">{peo.statement}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.targetKpi.toFixed(1)}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.directScore.toFixed(1)}</td>
                  <td className="p-4 text-center font-semibold text-gray-700">{peo.indirectScore.toFixed(1)}</td>
                  <td className="p-4 text-center font-black text-gray-900">
                    {peo.finalAttainment.toFixed(1)}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-4 py-1 rounded-full text-xs font-black uppercase ${
                        peo.status === 'Met' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {peo.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderCqiSummarySection(
          'PEO CQI Summary',
          dashboard?.peoCqiRows || [],
          'bg-indigo-100 text-indigo-700'
        )}
      </div>

    </div>
  );
};

export default OBEReportDashboard;