import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OBEConfigurationModule, { OBEMappingSubTabId } from '../modules/coordinator/OBEConfigurationModule';
import PEOReport from '../../pages/PEOReport';
import CoordinatorGAReportModule from '../modules/coordinator/CoordinatorGAReportModule';
import CoordinatorCLOReportModule from '../modules/coordinator/CoordinatorCLOReportModule';
import OBEReportDashboard from '../modules/coordinator/OBEReportDashboardView';
import HODCQI from '../pages/HODCQI';
import HODPEOCQI from '../pages/HODPEOCQI';
import HODVisionMissionCQI from '../pages/HODVisionMissionCQI';
import HODCQIClosingAdvisory from '../pages/HODCQIClosingAdvisory';
import HODNotice from '../pages/HODNotice';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import { useAuth } from '../../context/AuthContext';
import HODFeedbackControl from '../pages/HODFeedbackControl';
import EnableResultEditing from '../pages/EnableResultEditing';
import HODExitSurveyControl from '../pages/HODExitSurveyControl';
import HODAlumniFeedbackControl from '../pages/HODAlumniFeedbackControl';
import ModularDashboardShell from '../../components/layout/ModularDashboardShell';
import DashboardStatCard from '../../components/layout/DashboardStatCard';
import { api } from '../../api/api';
import { coordinatorService } from '../../api/coordinatorService';
import obeService, {
  CQIClosingSummaryResponse,
  GACQIClosingSummaryItem,
  PEOCQIClosingSummaryItem,
  VisionMissionCQIClosingSummaryItem,
} from '../../api/obeService';

import {
  LayoutDashboard,
  ClipboardCheck,
  Bell,
  FileBarChart,
  Users,
  BookOpen,
  Settings,
  Target,
  Award,
  Info,
  LayoutGrid,
  FileSpreadsheet,
  GraduationCap,
  MessageSquare,
  Archive,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import HODBatchStructureView from '../modules/hod/HODBatchStructureView';

type TabId =
  | 'dashboard'
  | 'cqi'
  | 'ga-report'
  | 'clo-report'
  | 'obe-report'
  | 'notice'
  | 'feedback'
  | 'obe-management'
  | 'vision-mission'
  | 'peo'
  | 'ga'
  | 'po-keywords'
  | 'ga-peo'
  | 'peo-report'
  | 'student-obe'
  | 'result-editing'
  | 'clo-cqi'
  | 'ga-cqi'
  | 'exit-survey'
  | 'alumni-feedback'
  | 'peo-cqi'
  | 'vision-mission-cqi'
  | 'cqi-closing-advisory'
  | 'batch-dossier';

interface RecentBatchItem {
  id: string;
  name: string;
  semester: number | null;
  programName: string;
  exitSurveyEnabled: boolean;
  alumniFeedbackEnabled: boolean;
  responseRate: number | null;
}

interface CqiMetrics {
  totalClosed: number;
  gaClosed: number;
  peoClosed: number;
  vmClosed: number;
  vmReviews: number;
}

const extractList = (payload: unknown): any[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.results)) return record.results;
  }
  return [];
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const scoreValue = (...values: unknown[]): number => {
  const firstValue = values.map(toNumber).find((value): value is number => value !== null);
  if (firstValue === undefined) return 0;
  return Math.max(0, Math.min(100, Math.round(firstValue * 100) / 100));
};

const ModularHODDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hodProfile, setHodProfile] = useState<any>(null);
  const [dashboardSummary, setDashboardSummary] = useState({
    activeBatches: 0,
    totalBatches: 0,
    facultyStrength: 0,
    totalPrograms: 0,
    feedbackBatches: 0,
    exitSurveyEnabled: 0,
    alumniFeedbackEnabled: 0,
    focusBatchName: 'No active batch',
  });
  const [cqiClosingSummary, setCqiClosingSummary] = useState<CQIClosingSummaryResponse | null>(null);
  const [cqiMetrics, setCqiMetrics] = useState<CqiMetrics | null>(null);
  const [recentBatches, setRecentBatches] = useState<RecentBatchItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'obe-management': true,
    reports: true,
    cqi: true,
    engagement: true,
  });

  const sidebarGroups = [
    {
      id: 'obe-management',
      label: 'OBE Configuration',
      icon: Settings,
      children: [
        { id: 'vision-mission', label: 'Vision & Mission', icon: Target },
        { id: 'peo', label: 'PO Setup', icon: Award },
        { id: 'ga', label: 'GA Setup', icon: Info },
        { id: 'po-keywords', label: 'PO Keyword Mapping', icon: LayoutGrid },
        { id: 'ga-peo', label: 'GA-PO Mapping', icon: LayoutGrid },
      ],
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart,
      children: [
        { id: 'clo-report', label: 'CLO Reports', icon: BookOpen },
        { id: 'ga-report', label: 'GA Reports', icon: FileBarChart },
        { id: 'peo-report', label: 'PO Reports', icon: GraduationCap },
        { id: 'obe-report', label: 'OBE Report', icon: FileSpreadsheet },
      ],
    },
    {
      id: 'cqi',
      label: 'CQI',
      icon: ClipboardCheck,
      children: [
        { id: 'clo-cqi', label: 'CLO CQI', icon: ClipboardCheck },
        { id: 'ga-cqi', label: 'GA CQI', icon: FileBarChart },
        { id: 'peo-cqi', label: 'PO CQI', icon: Target },
        { id: 'vision-mission-cqi', label: 'Vision/Mission CQI', icon: Award },
      ],
    },
    {
      id: 'engagement',
      label: 'Feedback & Surveys',
      icon: MessageSquare,
      children: [
        { id: 'feedback', label: 'Feedback', icon: MessageSquare },
        { id: 'exit-survey', label: 'Exit Survey', icon: GraduationCap },
        { id: 'alumni-feedback', label: 'Alumni Feedback', icon: Users },
      ],
    },
  ];

  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'batch-dossier', label: 'Batch Structure', icon: Archive },
    { id: 'notice', label: 'Notice Board', icon: Bell },
    { id: 'result-editing', label: 'Result lock', icon: Settings },
  ];

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [batchesRes, instructorsRes, feedbackBatchesRes] = await Promise.allSettled([
        obeService.getAllBatches(),
        coordinatorService.getInstructors(),
        api.get('/feedback/hod/batches/'),
      ]);

      const batches = batchesRes.status === 'fulfilled' ? extractList(batchesRes.value) : [];
      const instructors = instructorsRes.status === 'fulfilled'
        ? extractList(instructorsRes.value?.data ?? instructorsRes.value)
        : [];
      const feedbackBatches = feedbackBatchesRes.status === 'fulfilled'
        ? extractList(feedbackBatchesRes.value?.data ?? feedbackBatchesRes.value)
        : [];

      const activeBatches = batches.filter((batch: any) =>
        batch?.is_active !== false
        && String(batch?.status || '').toLowerCase() !== 'archived'
        && String(batch?.status || '').toLowerCase() !== 'graduated'
      );

      const sortedActiveBatches = [...activeBatches].sort((a: any, b: any) =>
        String(b?.name || '').localeCompare(String(a?.name || ''))
      );

      const focusBatch = sortedActiveBatches[0] || batches[0] || null;

      const programSet = new Set<string>();
      batches.forEach((batch: any) => {
        if (batch?.program?.id) {
          programSet.add(String(batch.program.id));
        } else if (typeof batch?.program === 'string') {
          programSet.add(batch.program);
        }
      });

      const exitSurveyEnabled = activeBatches.filter((batch: any) => batch?.exit_survey_enabled).length;
      const alumniFeedbackEnabled = activeBatches.filter((batch: any) => batch?.alumni_feedback_enabled).length;

      const batchList: RecentBatchItem[] = sortedActiveBatches.slice(0, 4).map((batch: any) => ({
        id: String(batch.id),
        name: batch.name || batch.custom_id || 'Batch',
        semester: typeof batch.current_semester === 'number' ? batch.current_semester : null,
        programName: batch.program?.name || batch.program_name || '—',
        exitSurveyEnabled: Boolean(batch.exit_survey_enabled),
        alumniFeedbackEnabled: Boolean(batch.alumni_feedback_enabled),
        responseRate: toNumber(batch.alumni_feedback_response_rate),
      }));

      setRecentBatches(batchList);
      setDashboardSummary({
        activeBatches: activeBatches.length,
        totalBatches: batches.length,
        facultyStrength: instructors.length,
        totalPrograms: programSet.size,
        feedbackBatches: feedbackBatches.length || batches.length,
        exitSurveyEnabled,
        alumniFeedbackEnabled,
        focusBatchName: focusBatch?.name || focusBatch?.custom_id || 'No active batch',
      });
    } catch (err) {
      console.error('Failed to load HOD dashboard data:', err);
      setError('Dashboard data could not be loaded right now.');
      setRecentBatches([]);
      setDashboardSummary({
        activeBatches: 0,
        totalBatches: 0,
        facultyStrength: 0,
        totalPrograms: 0,
        feedbackBatches: 0,
        exitSurveyEnabled: 0,
        alumniFeedbackEnabled: 0,
        focusBatchName: 'No active batch',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    let cancelled = false;
    const loadCqiSummary = async () => {
      try {
        const data = await obeService.getCQIClosingSummary();
        if (cancelled) return;
        const summary = data as CQIClosingSummaryResponse;
        const totalClosed =
          (summary?.ga_cqi_closures?.length ?? 0) +
          (summary?.peo_cqi_closures?.length ?? 0) +
          (summary?.vision_mission_cqi_closures?.length ?? 0);
        const metrics: CqiMetrics = {
          totalClosed,
          gaClosed: summary?.ga_cqi_closures?.length ?? 0,
          peoClosed: summary?.peo_cqi_closures?.length ?? 0,
          vmClosed: summary?.vision_mission_cqi_closures?.length ?? 0,
          vmReviews: summary?.vision_mission_reviews?.length ?? 0,
        };
        setCqiMetrics(metrics);
        setCqiClosingSummary(summary);
      } catch (err) {
        console.error('Failed to load CQI closing summary:', err);
        if (!cancelled) {
          setCqiMetrics(null);
          setCqiClosingSummary(null);
        }
      }
    };
    const timer = setTimeout(() => void loadCqiSummary(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'hod');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setHodProfile(response.data);
        }
      } catch (profileError) {
        console.error('Failed to fetch HOD profile:', profileError);
        if (!cancelled) {
          setHodProfile(currentUser);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const headerProfile = hodProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'HOD').trim();

  const allTabLabels = (() => {
    const labels: Record<string, string> = {};
    mainItems.forEach((item) => { labels[item.id] = item.label; });
    sidebarGroups.forEach((group) => {
      labels[group.id] = group.id === 'cqi' ? 'CQI Closing Summary' : group.label;
      group.children.forEach((child) => { labels[child.id] = child.label; });
    });
    return labels;
  })();

  const activeTabLabel = activeTab === 'dashboard'
    ? 'HOD Dashboard'
    : (allTabLabels[activeTab] || 'HOD Dashboard');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabId);
  };

  const handleToggleGroup = (groupId: string) => {
    if (groupId === 'cqi') {
      setActiveTab('cqi');
    }
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const renderDashboard = () => {
    const hasDashboardData = dashboardSummary.activeBatches > 0
      || (cqiMetrics?.totalClosed ?? 0) > 0;

    if (loading && !hasDashboardData) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Loading HOD dashboard...</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            title="Active Batches"
            value={dashboardSummary.activeBatches}
            helper={`${dashboardSummary.totalBatches} total batches`}
            gradient="from-indigo-500 to-purple-600"
            icon={GraduationCap}
            delay={0}
          />
          <DashboardStatCard
            title="Faculty Strength"
            value={dashboardSummary.facultyStrength}
            helper="Registered instructors"
            gradient="from-teal-500 to-emerald-600"
            icon={Users}
            delay={0.05}
          />
          <DashboardStatCard
            title="Programs"
            value={dashboardSummary.totalPrograms}
            helper={`${dashboardSummary.activeBatches} active batches`}
            gradient="from-purple-500 to-violet-600"
            icon={LayoutGrid}
            delay={0.1}
          />
          <DashboardStatCard
            title="CQI Closed"
            value={cqiMetrics?.totalClosed ?? 0}
            helper={`${cqiMetrics?.gaClosed ?? 0} GA | ${cqiMetrics?.peoClosed ?? 0} PO | ${cqiMetrics?.vmClosed ?? 0} V/M`}
            gradient="from-amber-500 to-orange-600"
            icon={CheckCircle}
            delay={0.15}
            onClick={() => setActiveTab('cqi')}
          />
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Department CQI Overview</p>
              <h3 className="mt-1 text-xl font-black text-gray-900">Recently closed CQI loops across all programs</h3>
            </div>
            <span className="rounded-full bg-gradient-to-r from-indigo-50 to-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Department-wide
            </span>
          </div>

          {cqiClosingSummary ? (
            (() => {
              const gaClosures = cqiClosingSummary.ga_cqi_closures || [];
              const peoClosures = cqiClosingSummary.peo_cqi_closures || [];
              const vmClosures = cqiClosingSummary.vision_mission_cqi_closures || [];
              const vmReviews = cqiClosingSummary.vision_mission_reviews || [];

              const recentClosures = [
                ...gaClosures.map((item: GACQIClosingSummaryItem) => ({
                  type: 'GA',
                  item: item.flagged.ga_code,
                  title: item.flagged.ga_title || '',
                  batch: item.flagged.batch_name || item.closed_in_batch_name || '—',
                  implementedOn: item.closed_in_batch_name || '—',
                  actionTaken: item.action_taken || '—',
                  resultingAttainment: item.resulting_attainment,
                  closedBy: item.closed_by_name || '—',
                  closedDate: item.closed_date || '—',
                })),
                ...peoClosures.map((item: PEOCQIClosingSummaryItem) => ({
                  type: 'PO',
                  item: item.flagged.peo_code,
                  title: item.flagged.peo_title || '',
                  batch: item.flagged.batch_name || item.closed_in_batch_name || '—',
                  implementedOn: item.closed_in_batch_name || '—',
                  actionTaken: item.action_taken || '—',
                  resultingAttainment: item.resulting_attainment,
                  closedBy: item.closed_by_name || '—',
                  closedDate: item.closed_date || '—',
                })),
                ...vmClosures.map((item: VisionMissionCQIClosingSummaryItem) => ({
                  type: 'V/M',
                  item: `${item.flagged.statement_type?.[0] || 'V'} ${item.flagged.keyword || ''}`,
                  title: item.flagged.keyword || '',
                  batch: item.flagged.batch_name || item.closed_in_batch_name || '—',
                  implementedOn: item.closed_in_batch_name || '—',
                  actionTaken: item.action_taken || '—',
                  resultingAttainment: item.resulting_attainment,
                  closedBy: item.closed_by_name || '—',
                  closedDate: item.closed_date || '—',
                })),
              ].sort((a, b) => String(b.closedDate).localeCompare(String(a.closedDate))).slice(0, 10);

              const allClosures = [...gaClosures, ...peoClosures, ...vmClosures];

              return allClosures.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Type</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Item</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Batch</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Implemented On</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500">Action Taken</th>
                        <th className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 text-center">Resulting Attainment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClosures.map((row, idx) => (
                        <tr key={`${row.type}-${row.item}-${idx}`} className="border-t border-gray-100 align-top">
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              row.type === 'GA' ? 'bg-green-50 text-green-700' :
                              row.type === 'PO' ? 'bg-indigo-50 text-indigo-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900">{row.item}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{row.batch}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{row.implementedOn}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 truncate max-w-xs">{row.actionTaken}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 text-center">
                            {row.resultingAttainment !== null && row.resultingAttainment !== undefined
                              ? `${Number(row.resultingAttainment).toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white py-12 text-sm text-gray-500">
                  No closed CQI records found across the department.
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white py-12 text-sm text-gray-500">
              Loading CQI summary…
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Active Batches</p>
              <h3 className="mt-1 text-xl font-black text-gray-900">Department cohorts</h3>
            </div>
            {recentBatches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="rounded-lg border border-gray-100 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/50 p-4 shadow-sm"
                  >
                    <p className="font-semibold text-gray-900">{batch.name}</p>
                    {batch.semester ? (
                      <p className="mt-1 text-xs font-medium text-gray-500">Semester {batch.semester}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium text-gray-500">Program: {batch.programName}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        batch.exitSurveyEnabled
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        Exit survey {batch.exitSurveyEnabled ? 'on' : 'off'}
                      </span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        batch.alumniFeedbackEnabled
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        Alumni feedback {batch.alumniFeedbackEnabled ? 'on' : 'off'}
                      </span>
                      {batch.responseRate !== null ? (
                        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                          {scoreValue(batch.responseRate)}% response
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 text-center text-sm text-gray-500">
                No active batches found.
              </div>
            )}
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();

      case 'obe-management':
        return <OBEConfigurationModule initialSubTab="vision-mission" hideSubTabs />;

      case 'vision-mission':
      case 'peo':
      case 'ga':
      case 'po-keywords':
      case 'ga-peo':
        return <OBEConfigurationModule initialSubTab={activeTab as OBEMappingSubTabId} hideSubTabs />;

      case 'cqi':
        return <HODCQIClosingAdvisory />;

      case 'clo-cqi':
        return <HODCQI mode="clo" />;

      case 'ga-cqi':
        return <HODCQI mode="ga" />;

      case 'peo-cqi':
        return <HODPEOCQI />;

      case 'vision-mission-cqi':
        return <HODVisionMissionCQI />;

      case 'clo-report':
        return <CoordinatorCLOReportModule />;

      case 'ga-report':
        return <CoordinatorGAReportModule />;

      case 'peo-report':
        return <PEOReport />;

      case 'obe-report':
        return <OBEReportDashboard />;

      case 'notice':
        return <HODNotice />;

      case 'feedback':
        return (
          <div className="space-y-6">
            <HODFeedbackControl />
          </div>
        );

      case 'exit-survey':
        return <HODExitSurveyControl />;

      case 'alumni-feedback':
        return <HODAlumniFeedbackControl />;

      case 'result-editing':
        return <EnableResultEditing />;

      case 'batch-dossier':
        return <HODBatchStructureView />;

      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <ModularDashboardShell
      roleLabel="HOD"
      portalLabel="OBE Academic System"
      headerName={headerName}
      headerImageUrl={headerImageUrl}
      activeTab={activeTab}
      activeTabLabel={activeTabLabel}
      tabs={mainItems}
      tabGroups={sidebarGroups}
      expandedGroups={expandedGroups}
      onToggleGroup={handleToggleGroup}
      onTabChange={handleTabChange}
      onLogout={logout}
      profileData={headerProfile}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </ModularDashboardShell>
  );
};

export default ModularHODDashboard;
