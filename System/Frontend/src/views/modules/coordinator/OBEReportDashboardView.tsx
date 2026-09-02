import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Users, Target, FileText, Search, BookOpen, TrendingUp, LoaderCircle, RefreshCw } from 'lucide-react';
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
import * as XLSX from 'xlsx-js-style';
import { toast } from 'react-hot-toast';
import OBEReportPDF from './OBEReportPDF';
import logo2 from '../../../assets/logo2.png';
import ExportChoiceModal from '../../../components/reports/ExportChoiceModal';
import academicStructureService, { Program } from '../../../api/academicStructureService';
import obeService, {
  Batch,
  BatchGAReportResponse,
  CLOCQIListItem,
  CLOReportResponse,
  CourseSession,
  GACQIRecord,
  GAReportItem,
  VisionMissionAnalyticsResponse,
  VisionMissionAnalyticsRow,
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
  implemented_on?: string | null;
  action_taken?: string | null;
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
  visionMissionAnalytics: VisionMissionAnalyticsResponse | null;
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardState | null>(null);
  const [cqiDrafts, setCqiDrafts] = useState<Record<string, string>>({});
  const [savingCqiKey, setSavingCqiKey] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    visionMission: true,
    courseClo: true,
    ga: true,
    po: true,
    cloCqi: false,
    gaCqi: false,
    poCqi: false,
  });
  const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});

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
    name: peo.id.replace(/^PEO-/, 'PO-'),
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
      const [
        gaReport,
        peoReport,
        sessionRes,
        studentRes,
        programPeos,
        peoCqiRecords,
        visionMissionAnalytics,
      ] = await Promise.all([
        obeService.getBatchGAReport(batchId, { mode: 'cumulative', scope: 'cohort' }),
        peoService.getPEOReports(batchId),
        obeService.getCourseSessions(batchId),
        obeService.getBatchStudents(batchId),
        currentBatch?.program?.id ? obeService.getProgramPEOs(currentBatch.program.id) : Promise.resolve([]),
        peoService.getPEOCQIRecords(batchId),
        obeService.getVisionMissionAnalytics(batchId),
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
              'Pending CQI action plan',
            status: latestRecord?.status || item.status,
            implemented_on: latestRecord?.implemented_in_batch_name || null,
            action_taken: latestRecord?.action_taken_description || null,
          };
        });

      const peoThresholdMap = new Map<string, number>();
      (programPeos || []).forEach((peo: any) => {
          peoThresholdMap.set(`PO-${peo.order_number}`, Number(peo.kpi_threshold ?? 70));
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
            item: `${(item.peo_code || item.peo_id).replace(/^PEO-/, 'PO-')} - ${item.peo_title}`,
            detail: `Final ${Number(item.final_score ?? 0).toFixed(1)}% / Target ${targetKpi.toFixed(1)}%`,
            reason: cqiRecord?.root_cause || `Below target at ${Number(item.final_score ?? 0).toFixed(1)}%`,
             remedy: cqiRecord?.action_taken_description || 'Pending CQI action plan',
            status: cqiRecord?.status || 'CQI_TRIGGERED',
            implemented_on: cqiRecord?.implemented_in_batch_name || null,
            action_taken: cqiRecord?.action_taken_description || null,
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
        visionMissionAnalytics,
      });

      const nextDrafts: Record<string, string> = {};
      [...(visionMissionAnalytics?.vision_rows || []), ...(visionMissionAnalytics?.mission_rows || [])].forEach((row) => {
        nextDrafts[`${row.keyword_type}-${row.keyword_id}`] = row.hod_action_plan || '';
      });
      setCqiDrafts(nextDrafts);
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

      if (loadedPrograms[0]) {
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

    if (selectedBatchId && !filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId('');
      setDashboard(null);
    }
  }, [selectedProgramId, filteredBatches, selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId && !filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId('');
      setDashboard(null);
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
    if (!dashboard) return;
    if (selectedSemester !== 'all' && !availableSemesters.includes(Number(selectedSemester))) {
      setSelectedSemester('all');
    }
  }, [dashboard, availableSemesters, selectedSemester]);

  const getVisionMissionCqiKey = (row: VisionMissionAnalyticsRow) => `${row.keyword_type}-${row.keyword_id}`;

  const handleVisionMissionCqiChange = (row: VisionMissionAnalyticsRow, value: string) => {
    setCqiDrafts((current) => ({
      ...current,
      [getVisionMissionCqiKey(row)]: value,
    }));
  };

  const handleSaveVisionMissionCqi = async (row: VisionMissionAnalyticsRow) => {
    if (!dashboard?.batch) {
      return;
    }

    const key = getVisionMissionCqiKey(row);
    setSavingCqiKey(key);
    try {
      const saved = await obeService.saveVisionMissionCQI(dashboard.batch.id, {
        keyword_type: row.keyword_type,
        keyword_id: row.keyword_id,
        hod_action_plan: cqiDrafts[key] || '',
        attainment_value: row.attainment_score,
        target_kpi: row.target_kpi,
        cqi_action_required: row.cqi_action_required,
      });

      setDashboard((current) => {
        if (!current?.visionMissionAnalytics) return current;
        const updateRow = (item: VisionMissionAnalyticsRow): VisionMissionAnalyticsRow =>
          item.keyword_type === row.keyword_type && item.keyword_id === row.keyword_id
            ? {
                ...item,
                hod_action_plan: saved.hod_action_plan,
                cqi_record_id: saved.id,
              }
            : item;

        return {
          ...current,
          visionMissionAnalytics: {
            ...current.visionMissionAnalytics,
            vision_rows: current.visionMissionAnalytics.vision_rows.map(updateRow),
            mission_rows: current.visionMissionAnalytics.mission_rows.map(updateRow),
          },
        };
      });

      toast.success('CQI action plan saved');
    } catch (err) {
      console.error('Failed to save Vision/Mission CQI:', err);
      toast.error('Failed to save CQI action plan');
    } finally {
      setSavingCqiKey(null);
    }
  };

  const handleExportPDF = async () => {
    if (!dashboard) {
      return;
    }

    const requiredVisionMissionRows = [
      ...(dashboard.visionMissionAnalytics?.vision_rows || []),
      ...(dashboard.visionMissionAnalytics?.mission_rows || []),
    ].filter((row) => row.cqi_action_required);

    const missingActionPlan = requiredVisionMissionRows.some((row) => {
      const key = getVisionMissionCqiKey(row);
      return !(cqiDrafts[key] || '').trim();
    });

    if (missingActionPlan) {
      toast.error('Please input the required CQI Action Plan notes before exporting the final report.');
      return;
    }

    const unfilledCqiRows = [...(dashboard.gaCqiRows || []), ...(dashboard.peoCqiRows || [])].filter(
      (row) => row.reason && row.reason.includes('Below target at') && row.remedy === 'Pending CQI action plan'
    );

    if (unfilledCqiRows.length > 0) {
      toast.error('Please fill in the root cause and action plan for the triggered CQI records before exporting.');
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
          visionMissionAnalytics={dashboard.visionMissionAnalytics}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OBE_Report_${batchName}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('OBE report PDF exported');
      setExportModalOpen(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const addStyledSheet = (wb: XLSX.WorkBook, name: string, rows: any[][], mergeRows: number[] = []) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const maxCol = Math.max(0, rows.reduce((max, row) => Math.max(max, row.length - 1), 0));
    ws['!merges'] = mergeRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: maxCol } }));
    ws['!cols'] = Array.from({ length: maxCol + 1 }, (_, index) => ({
      wch: index === 0 ? 18 : index === 1 ? 34 : 20,
    }));
    ws['!rows'] = rows.map((_, index) => ({ hpt: mergeRows.includes(index) ? 26 : 22 }));

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 0; R <= range.e.r; R += 1) {
      for (let C = 0; C <= range.e.c; C += 1) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[address]) continue;
        const isTitle = mergeRows.includes(R);
        const isHeader = rows[R]?.every((cell) => cell !== '') && R > 0 && rows[R - 1]?.length <= 1;
        ws[address].s = {
          fill: isTitle
            ? { fgColor: { rgb: '1E3A8A' } }
            : isHeader
              ? { fgColor: { rgb: 'DBEAFE' } }
              : undefined,
          font: {
            bold: isTitle || isHeader,
            color: isTitle ? { rgb: 'FFFFFF' } : isHeader ? { rgb: '1E3A8A' } : { rgb: '111827' },
          },
          alignment: {
            horizontal: isTitle || isHeader ? 'center' : C >= 2 ? 'center' : 'left',
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
    if (!dashboard) {
      toast.error('Select a batch and load a report first');
      return;
    }

    const requiredVisionMissionRows = [
      ...(dashboard.visionMissionAnalytics?.vision_rows || []),
      ...(dashboard.visionMissionAnalytics?.mission_rows || []),
    ].filter((row) => row.cqi_action_required);

    const missingActionPlan = requiredVisionMissionRows.some((row) => {
      const key = getVisionMissionCqiKey(row);
      return !(cqiDrafts[key] || '').trim();
    });

    if (missingActionPlan) {
      toast.error('Please input the required CQI Action Plan notes before exporting the final report.');
      return;
    }

    const unfilledCqiRows = [...(dashboard.gaCqiRows || []), ...(dashboard.peoCqiRows || [])].filter(
      (row) => row.reason && row.reason.includes('Below target at') && row.remedy === 'Pending CQI action plan'
    );

    if (unfilledCqiRows.length > 0) {
      toast.error('Please fill in the root cause and action plan for the triggered CQI records before exporting.');
      return;
    }

    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const batchName = selectedBatch?.name || 'Selected Batch';
      const programName = selectedProgram?.name || 'Program';
      const generatedAt = new Date().toLocaleString();

      addStyledSheet(wb, 'Executive Summary', [
        ['OBE Report Dashboard'],
        [`Program: ${programName}`],
        [`Batch: ${batchName}`],
        [`Generated: ${generatedAt}`],
        [],
        ['Metric', 'Value'],
        ['Students', dashboard.totalStudents],
        ['Program End Ready', dashboard.isProgramEndReady ? 'Yes' : 'No'],
        ['GA Metrics', dashboard.gaRows.length],
        ['PO Metrics', dashboard.peoRows.length],
        ['CLO CQI Rows', dashboard.cloCqiRows.length],
        ['GA CQI Rows', dashboard.gaCqiRows.length],
        ['PO CQI Rows', dashboard.peoCqiRows.length],
      ], [0, 1, 2, 3]);

      addStyledSheet(wb, 'CLO Attainment', [
        ['Course-wise CLO Attainment'],
        [`Program: ${programName} | Batch: ${batchName}`],
        [],
        ['Semester', 'Course Code', 'Course Name', 'CLO', 'Attainment %', 'Status'],
        ...dashboard.cloGroups.flatMap((group) =>
          group.courses.flatMap((course) =>
            course.clo_summary.map((clo) => [
              group.semester,
              course.code,
              course.name,
              clo.clo,
              Number(clo.percentage || 0).toFixed(1),
              clo.achieved ? 'Achieved' : 'Not Achieved',
            ])
          )
        ),
      ], [0, 1]);

      addStyledSheet(wb, 'GA Attainment', [
        ['GA Attainment'],
        [`Program: ${programName} | Batch: ${batchName}`],
        [],
        ['GA Code', 'Attribute', 'Direct %', 'Indirect %', 'Total %', 'Target KPI %', 'CQI Triggered'],
        ...dashboard.gaRows.map((ga) => [
          ga.ga_code,
          ga.ga_title,
          ga.directAttainment.toFixed(1),
          ga.indirectAttainment.toFixed(1),
          ga.totalAttainment.toFixed(1),
          ga.targetKpi.toFixed(1),
          ga.cqiTriggered,
        ]),
      ], [0, 1]);

      addStyledSheet(wb, 'PO Attainment', [
        ['PO Attainment'],
        [`Program: ${programName} | Batch: ${batchName}`],
        [],
        ['PO', 'Statement', 'Target KPI %', 'Direct %', 'Indirect %', 'Final %', 'Status'],
        ...dashboard.peoRows.map((peo) => [
          peo.id.replace(/^PEO-/, 'PO-'),
          peo.statement,
          peo.targetKpi.toFixed(1),
          peo.directScore.toFixed(1),
          peo.indirectScore.toFixed(1),
          peo.finalAttainment.toFixed(1),
          peo.status,
        ]),
      ], [0, 1]);

      addStyledSheet(wb, 'CQI Summary', [
        ['CQI Summary'],
        [`Program: ${programName} | Batch: ${batchName}`],
        [],
        ['Type', 'Item', 'Detail', 'Reason', 'Remedy', 'Implemented On', 'Action Taken', 'Status'],
        ...[...dashboard.cloCqiRows, ...dashboard.gaCqiRows, ...dashboard.peoCqiRows].map((row) => [
          row.type,
          row.item,
          row.detail,
          row.reason,
          row.remedy,
          row.implemented_on || '-',
          row.action_taken || '-',
          row.status || '-',
        ]),
      ], [0, 1]);

      const vmAnalytics = dashboard.visionMissionAnalytics;
      const vmRows: Array<{ type: string; row: any }> = [
        ...(vmAnalytics?.vision_rows || []).map((row) => ({ type: 'Vision', row })),
        ...(vmAnalytics?.mission_rows || []).map((row) => ({ type: 'Mission', row })),
      ];

      if (vmRows.length > 0) {
        addStyledSheet(wb, 'Vision/Mission CQI', [
          ['Vision / Mission CQI Details'],
          [`Program: ${programName} | Batch: ${batchName}`],
          [],
          ['Type', 'Keyword', 'Target KPI %', 'Attainment %', 'Status', 'HOD Action Plan', 'Implemented On', 'Action Taken'],
          ...vmRows.map(({ type, row }) => [
            type,
            row.keyword,
            row.target_kpi?.toFixed(1) || '-',
            row.attainment_score === null ? 'N/A' : Number(row.attainment_score).toFixed(1),
            row.status,
            row.hod_action_plan || '-',
            row.implemented_in_batch_name || '-',
            row.action_taken_description || '-',
          ]),
        ], [0, 1]);
      }

      XLSX.writeFile(wb, `OBE_Report_${batchName.replace(/\s+/g, '_')}.xlsx`);
      toast.success('OBE report Excel exported');
      setExportModalOpen(false);
    } catch (err) {
      console.error('Excel export failed:', err);
      toast.error('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const achievedCount = dashboard?.gaRows.filter((row) => row.cqiTriggered === 'No').length || 0;
  const gaAchievementRate =
    dashboard && dashboard.gaRows.length > 0
      ? Math.round((achievedCount / dashboard.gaRows.length) * 100)
      : 0;

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const toggleList = (listKey: string) => {
    setExpandedLists((current) => ({
      ...current,
      [listKey]: !current[listKey],
    }));
  };

  const renderSectionHeader = (
    sectionKey: string,
    icon: React.ReactNode,
    title: string,
    meta?: string
  ) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="mb-6 flex w-full items-center justify-between gap-4 text-left"
    >
      <span className="flex items-center gap-3">
        {icon}
        <span>
          <span className="block text-2xl font-black text-gray-900">{title}</span>
          {meta && <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-gray-400">{meta}</span>}
        </span>
      </span>
      <span className="rounded-xl border border-gray-200 p-2 text-gray-600">
        {expandedSections[sectionKey] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </span>
    </button>
  );

  const renderCqiSummarySection = (
    title: string,
    rows: DashboardCQIRow[],
    accentClassName: string,
    sectionKey: string
  ) => {
    if (!rows || rows.length === 0) {
      return null;
    }

    const expanded = Boolean(expandedSections[sectionKey]);
    const visibleRows = expanded ? rows : rows.slice(0, 3);

    return (
      <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 text-left text-lg font-black text-gray-900"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {title}
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${accentClassName}`}>
              {rows.length} item{rows.length === 1 ? '' : 's'}
            </span>
            {rows.length > 3 && (
              <button
                type="button"
                onClick={() => toggleSection(sectionKey)}
                className="text-xs font-black uppercase tracking-wider text-gray-500 hover:text-gray-900"
              >
                {expanded ? 'Show less' : 'See more'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="p-4 font-black text-xs uppercase tracking-wider">Item</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Detail</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Reason</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Remedy</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Implemented On</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={`${row.type}-${row.item}-${index}`} className="border-b border-gray-100 align-top">
                  <td className="p-4 font-semibold text-gray-900">{row.item}</td>
                  <td className="p-4 text-gray-700">{row.detail}</td>
                  <td className="p-4 text-gray-700">{row.reason}</td>
                  <td className="p-4 text-gray-700">{row.remedy}</td>
                  <td className="p-4 text-gray-700">{row.implemented_on || '—'}</td>
                  <td className="p-4 text-gray-700">{row.action_taken || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVisionMissionRows = (title: string, rows: VisionMissionAnalyticsRow[], listKey: string) => {
    const expanded = Boolean(expandedLists[listKey]);
    const visibleRows = expanded ? rows : rows.slice(0, 4);

    return (
    <div>
      <h3 className="mb-3 text-lg font-black text-gray-900">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
              <th className="p-4 font-black text-xs uppercase tracking-wider">Keyword</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Target KPI %</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Attainment Score %</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider text-center">Evaluation Status</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider">HOD Corrective Measures / CQI Action Plan</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider">Implemented On</th>
              <th className="p-4 font-black text-xs uppercase tracking-wider">Action Taken</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-5 text-center font-semibold text-gray-400">
                  No approved keywords are available.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const key = getVisionMissionCqiKey(row);
                const draftValue = cqiDrafts[key] ?? row.hod_action_plan ?? '';
                const isEditable = Boolean(dashboard?.visionMissionAnalytics?.is_hod && row.cqi_action_required);

                return (
                  <tr key={key} className="border-b border-gray-100 align-top">
                    <td className="p-4">
                      <p className="font-black text-gray-900">{row.keyword}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        {row.mapped_count} mapped item{row.mapped_count === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="p-4 text-center font-semibold text-gray-700">{row.target_kpi.toFixed(1)}</td>
                    <td className="p-4 text-center font-black text-gray-900">
                      {row.attainment_score === null ? 'N/A' : row.attainment_score.toFixed(1)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex px-4 py-1 rounded-full text-xs font-black uppercase ${
                          row.status === 'Achieved'
                            ? 'bg-green-100 text-green-700'
                            : row.status === 'Not Achieved'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 min-w-[280px]">
                      {row.cqi_action_required ? (
                        isEditable ? (
                          <div className="space-y-2">
                            <textarea
                              value={draftValue}
                              onChange={(event) => handleVisionMissionCqiChange(row, event.target.value)}
                              onBlur={() => {
                                if ((draftValue || '').trim() !== (row.hod_action_plan || '').trim()) {
                                  void handleSaveVisionMissionCqi(row);
                                }
                              }}
                              className="min-h-[92px] w-full rounded-xl border border-red-100 bg-red-50/40 p-3 text-sm font-semibold text-gray-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveVisionMissionCqi(row)}
                              disabled={savingCqiKey === key}
                              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                            >
                              {savingCqiKey === key ? 'Saving...' : 'Save CQI Entry'}
                            </button>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
                            {draftValue || 'Pending HOD action plan'}
                          </p>
                        )
                      ) : (
                        <p className="text-sm font-semibold text-gray-400">No CQI action required</p>
                      )}
                    </td>
                    <td className="p-4 text-gray-700">{row.implemented_in_batch_name || '—'}</td>
                    <td className="p-4 text-gray-700 whitespace-pre-wrap">{row.action_taken_description || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 4 && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => toggleList(listKey)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-600 hover:border-gray-300 hover:text-gray-900"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? 'Show less' : `See ${rows.length - visibleRows.length} more`}
          </button>
        </div>
      )}
    </div>
    );
  };

  const renderVisionMissionExecutiveOverview = () => {
    const analytics = dashboard?.visionMissionAnalytics;
    if (!analytics) {
      return null;
    }

    return (
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        {renderSectionHeader(
          'visionMission',
          <FileText className="w-8 h-8 text-slate-700" />,
          'Vision and Mission Executive Summary',
          `${analytics.vision_rows.length + analytics.mission_rows.length} keyword metric${analytics.vision_rows.length + analytics.mission_rows.length === 1 ? '' : 's'}`
        )}

        {expandedSections.visionMission && (
          <>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Program Vision</p>
            <p className="text-sm font-semibold leading-6 text-gray-700">
              {analytics.vision.statement || 'No active Vision statement configured.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {analytics.vision.keywords.map((keyword) => (
                <span key={keyword.id} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                  {keyword.text}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Program Mission</p>
            <p className="text-sm font-semibold leading-6 text-gray-700">
              {analytics.mission.statement || 'No active Mission statement configured.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {analytics.mission.keywords.map((keyword) => (
                <span key={keyword.id} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                  {keyword.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {renderVisionMissionRows('Vision Keyword Attainment', analytics.vision_rows, 'visionRows')}
          {renderVisionMissionRows('Mission Keyword Attainment', analytics.mission_rows, 'missionRows')}
        </div>
          </>
        )}
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
                onClick={() => setExportModalOpen(true)}
                disabled={exporting || !dashboard}
                className="shrink-0 flex items-center gap-2 rounded-xl border border-white/15 bg-gradient-to-r from-blue-700/90 via-indigo-800/85 to-blue-900/90 px-6 py-2.5 font-semibold text-white shadow-xl shadow-blue-950/15 backdrop-blur-md transition-all hover:border-white/25 hover:from-blue-600/95 hover:via-indigo-700/90 hover:to-blue-800/95 disabled:opacity-60"
              >
                <FileText size={18} />
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ExportChoiceModal
        open={exportModalOpen}
        title="Export OBE Report"
        description="Choose a professional PDF or a formatted Excel workbook."
        exporting={exporting}
        onClose={() => setExportModalOpen(false)}
        onPdf={handleExportPDF}
        onExcel={handleExportExcel}
      />

      {!selectedBatchId ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-500">
          Select a batch to view OBE reports and CQI summaries.
        </div>
      ) : null}

      {selectedBatchId && (
      <>
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

      {renderVisionMissionExecutiveOverview()}

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        {renderSectionHeader(
          'courseClo',
          <BookOpen className="w-8 h-8 text-purple-600" />,
          'Course wise CLO Attainment',
          `${filteredCLOGroups.reduce((count, group) => count + group.courses.length, 0)} course report${filteredCLOGroups.reduce((count, group) => count + group.courses.length, 0) === 1 ? '' : 's'}`
        )}

        {expandedSections.courseClo && (
          <>
        <div className="flex items-center justify-end mb-6">
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
          'bg-purple-100 text-purple-700',
          'cloCqi'
        )}
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        {renderSectionHeader(
          'ga',
          <Target className="w-8 h-8 text-green-600" />,
          'GA Attainment',
          `${dashboard?.gaRows.length || 0} GA metric${(dashboard?.gaRows.length || 0) === 1 ? '' : 's'}`
        )}

        {expandedSections.ga && (
          <>
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
          'bg-green-100 text-green-700',
          'gaCqi'
        )}
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        {renderSectionHeader(
          'po',
          <Target className="w-8 h-8 text-indigo-600" />,
          'PO Attainment',
          `${dashboard?.peoRows.length || 0} PO metric${(dashboard?.peoRows.length || 0) === 1 ? '' : 's'}`
        )}

        {expandedSections.po && (
          <>
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
                <th className="p-4 font-black text-xs uppercase tracking-wider">PO ID</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider">PO Statement</th>
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
                  <td className="p-4 font-semibold text-gray-900">{peo.id.replace(/^PEO-/, 'PO-')}</td>
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
          'PO CQI Summary',
          dashboard?.peoCqiRows || [],
          'bg-indigo-100 text-indigo-700',
          'poCqi'
        )}
          </>
        )}
      </div>

      </>
      )}

    </div>
  );
};

export default OBEReportDashboard;
