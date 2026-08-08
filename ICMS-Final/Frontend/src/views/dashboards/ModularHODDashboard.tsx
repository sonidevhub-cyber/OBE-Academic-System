import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import CoordinatorOBEMappingModule from '../modules/coordinator/CoordinatorOBEMappingModule';

import PEOReport from '../../pages/PEOReport';
import CoordinatorGAReportModule from '../modules/coordinator/CoordinatorGAReportModule';
import CoordinatorCLOReportModule from '../modules/coordinator/CoordinatorCLOReportModule';
import OBEReportDashboard from '../modules/coordinator/OBEReportDashboardView';
import HODCQI from '../pages/HODCQI';
import HODNotice from '../pages/HODNotice';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import { Toaster } from 'react-hot-toast';
import { adminService } from '../../api/adminService';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import { useAuth } from '../../context/AuthContext';
import { feedbackService } from '../../api/FeedbackServices';
import HODFeedbackControl from "../pages/HODFeedbackControl";
import EnableResultEditing from "../pages/EnableResultEditing";
import HODExitSurveyControl from "../pages/HODExitSurveyControl";
import HODAlumniFeedbackControl from "../pages/HODAlumniFeedbackControl";
import HODCQIAdvisoryExport from "../pages/HODCQIAdvisoryExport";
import { api } from '../../api/api';
import obeService from '../../api/obeService';

import {
  LayoutDashboard,
  ClipboardCheck,
  Bell,
  MessageSquare,
  User,
  LogOut,
  FileBarChart,
  Users,
  BookOpen,
  Settings,
  FileSpreadsheet,
  GraduationCap,
  TrendingUp
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

interface DashboardAlertRow {
  source: 'GA' | 'CLO';
  code: string;
  title: string;
  attainment: number | null;
  threshold: number | null;
  status: string;
  action: string;
  owner?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractApiData = (response: any) => response?.data ?? response ?? [];

type TabId = "dashboard" | "cqi" | "ga-report" | "clo-report" | "obe-report" | "notice" | "feedback" | "obe-management" | "peo-report" | "peo-cqi" | "student-obe" | "result-editing" | "exit-survey" | "alumni-feedback" | "ga-cqi-advisory";

const ModularHODDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hodProfile, setHodProfile] = useState<any>(null);
  const [dashboardAlerts, setDashboardAlerts] = useState<DashboardAlertRow[]>([]);
  const [dashboardTrend, setDashboardTrend] = useState<Array<{ label: string; courseExit: number; alumniFeedback: number }>>([]);
  const [dashboardGaSeries, setDashboardGaSeries] = useState<Array<{ label: string; target: number; direct: number }>>([]);
  const [dashboardSummary, setDashboardSummary] = useState({
    activeBatches: 0,
    facultyStrength: 0,
    pendingCqi: 0,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    reports: true,
    cqi: true,
    engagement: true,
  });
  const loadSequenceRef = useRef(0);

  const sidebarGroups = [
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart,
      children: [
        { id: 'clo-report', label: 'CLO Reports', icon: BookOpen },
        { id: 'ga-report', label: 'GA Reports', icon: FileBarChart },
        { id: 'peo-report', label: 'PEO Reports', icon: TrendingUp },
        { id: 'obe-report', label: 'OBE Report', icon: FileSpreadsheet },
      ],
    },
    {
      id: 'cqi',
      label: 'CQI',
      icon: ClipboardCheck,
      children: [
        { id: 'cqi', label: 'CLO CQI Control', icon: ClipboardCheck },
        { id: 'ga-cqi-advisory', label: 'CQI Advisory Export', icon: ClipboardCheck },
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
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "obe-management", label: "PEO/GA Setup", icon: Settings },
    { id: "notice", label: "Notice Board", icon: Bell },
    { id: "result-editing", label: "Result lock", icon: Settings },
  ];

  const loadFeedbackTrend = useCallback(async (batches: any[], loadSequence: number) => {
    if (!batches.length) return;

    try {
      const comparisonResults = await Promise.allSettled(
        batches.map((batch: any) => feedbackService.getComparison(String(batch.id)))
      );

      if (loadSequence !== loadSequenceRef.current) return;

      const comparisonTrend = batches.map((batch: any, index: number) => {
        const comparisonPayload = comparisonResults[index];
        const rows = comparisonPayload.status === 'fulfilled' ? extractApiData(comparisonPayload.value) : [];
        const items = Array.isArray(rows?.results) ? rows.results : Array.isArray(rows) ? rows : [];
        const directAvg = items.length
          ? items.reduce((sum: number, item: any) => sum + toNumber(item?.direct, 0), 0) / items.length
          : 0;
        const indirectAvg = items.length
          ? items.reduce((sum: number, item: any) => sum + toNumber(item?.indirect, 0), 0) / items.length
          : 0;
        return {
          label: batch?.name || `Batch ${index + 1}`,
          courseExit: Number(directAvg.toFixed(2)),
          alumniFeedback: Number(indirectAvg.toFixed(2)),
        };
      });

      setDashboardTrend(comparisonTrend);
    } catch (err) {
      if (loadSequence !== loadSequenceRef.current) return;
      console.error('Failed to load dashboard trend data:', err);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    const loadSequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const [hodBatchesResponse, alumniBatchesResponse, instructorStatsResponse, cloCqiResponse] = await Promise.allSettled([
        api.get('/feedback/hod/batches/'),
        obeService.getAlumniFeedbackBatches(),
        adminService.getAdminStats(),
        api.get('/assessments/hod-cqi/'),
      ]);

      if (loadSequence !== loadSequenceRef.current) return;

      const hodBatchItems = hodBatchesResponse.status === 'fulfilled' ? extractApiData(hodBatchesResponse.value) : [];
      const hodBatchIds = new Set((Array.isArray(hodBatchItems) ? hodBatchItems : []).map((item: any) => String(item?.id)));

      const allBatches = alumniBatchesResponse.status === 'fulfilled' ? extractApiData(alumniBatchesResponse.value) : [];
      const batches = Array.isArray(allBatches)
        ? allBatches.filter((batch: any) => {
            if (hodBatchIds.size === 0) return true;
            return hodBatchIds.has(String(batch?.id));
          })
        : [];

      const instructorStats = instructorStatsResponse.status === 'fulfilled' ? extractApiData(instructorStatsResponse.value) : null;
      const facultyStrength = toNumber(instructorStats?.stats?.total_instructors ?? instructorStats?.total_instructors, 0);

      const activeBatches = Array.isArray(batches) ? batches.filter((batch: any) => batch?.is_active !== false) : [];
      const sortedBatches = [...activeBatches].sort((a: any, b: any) => {
        const endYearDelta = toNumber(b?.end_year) - toNumber(a?.end_year);
        if (endYearDelta !== 0) return endYearDelta;
        return String(b?.name || '').localeCompare(String(a?.name || ''));
      });
      const focusBatch = sortedBatches[0] || activeBatches[0] || batches[0] || null;

      let gaItems: any[] = [];

      const [gaReportResponse] = focusBatch?.id
        ? await Promise.allSettled([
            obeService.getBatchGAReport(focusBatch.id, { mode: 'cumulative', scope: 'cohort' }),
          ])
        : [null as any];

      if (loadSequence !== loadSequenceRef.current) return;

      if (gaReportResponse && gaReportResponse.status === 'fulfilled') {
        const gaPayload = gaReportResponse.value;
        if (Array.isArray(gaPayload)) {
          gaItems = gaPayload;
        } else if (gaPayload?.ga_reports) {
          gaItems = gaPayload.ga_reports;
        }
      }

      const cloCqiPayload = cloCqiResponse.status === 'fulfilled' ? extractApiData(cloCqiResponse.value) : [];
      const cloCqiItems = Array.isArray(cloCqiPayload)
        ? cloCqiPayload
        : Array.isArray(cloCqiPayload?.results)
          ? cloCqiPayload.results
          : [];

      const pendingCloCqiItems: DashboardAlertRow[] = cloCqiItems
        .filter((item: any) => String(item?.status || '').toLowerCase() === 'pending')
        .map((item: any, index: number) => ({
          source: 'CLO',
          code: item.clo_display || `CLO-${index + 1}`,
          title: item.reason || item.action_plan || 'CLO CQI pending review',
          attainment: null,
          threshold: null,
          status: 'pending',
          action: 'HOD review required',
          owner: item.instructor_name || 'Unassigned',
        }));

      const outcomeSeries = (gaItems.length > 0 ? gaItems : []).slice(0, 12).map((item: any, index: number) => ({
        label: item.ga_code || `GA-${index + 1}`,
        target: toNumber(item.kpi_threshold ?? item.ga_kpi_threshold ?? 60, 60),
        direct: clamp(toNumber(item.ga_attainment ?? item.cohort_score ?? item.direct_score ?? 0, 0), 0, 100),
      }));

      setDashboardAlerts(pendingCloCqiItems);
      setDashboardTrend([
        { label: 'Loading...', courseExit: 0, alumniFeedback: 0 },
      ]);
      setDashboardGaSeries(outcomeSeries);
      setDashboardSummary({
        activeBatches: activeBatches.length,
        facultyStrength,
        pendingCqi: pendingCloCqiItems.length,
      });

      setLoading(false);

      const trendBatches = sortedBatches.slice(0, 4);
      const scheduleTrendLoad = () => void loadFeedbackTrend(trendBatches, loadSequence);
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(scheduleTrendLoad);
      } else {
        globalThis.setTimeout(scheduleTrendLoad, 0);
      }
      return;
    } catch (err) {
      if (loadSequence !== loadSequenceRef.current) return;
      console.error('Failed to load HOD dashboard data:', err);
      setDashboardAlerts([]);
      setDashboardTrend([
        { label: 'Batch 1', courseExit: 64, alumniFeedback: 61 },
        { label: 'Batch 2', courseExit: 68, alumniFeedback: 63 },
        { label: 'Batch 3', courseExit: 72, alumniFeedback: 69 },
        { label: 'Batch 4', courseExit: 75, alumniFeedback: 71 },
      ]);
      setDashboardGaSeries(Array.from({ length: 12 }, (_, index) => ({
        label: `GA-${index + 1}`,
        target: 50,
        direct: 55 + (index % 5) * 6,
      })));
      setDashboardSummary({
        activeBatches: 1,
        facultyStrength: 1,
        pendingCqi: 1,
      });
    } finally {
      if (loadSequence === loadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [loadFeedbackTrend]);

  useEffect(() => {
    loadDashboardData();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    };

    const handleFocus = () => {
      loadDashboardData();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    const intervalId = window.setInterval(() => {
      loadDashboardData();
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [loadDashboardData]);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'hod');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        console.log('=== Full Profile Response ===', response);
        console.log('=== Response Data ===', response.data);
        
        if (response.data) {
          console.log('=== ALL DATA FIELDS AND VALUES ===');
          for (const key in response.data) {
            console.log(`- ${key}:`, response.data[key]);
          }
          
          // Also check currentUser in case profile didn't load
          console.log('=== CURRENT USER FROM AUTH CONTEXT ===');
          for (const key in currentUser) {
            console.log(`- ${key}:`, currentUser[key]);
          }
        }
        
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setHodProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch HOD profile:', error);
        if (!cancelled) {
          setHodProfile(currentUser);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const headerProfile = hodProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'HOD').trim();

  const handleLogout = () => {
    logout();
  };

  const renderDashboard = () => {
    const gaChartData = {
      labels: dashboardGaSeries.map((item) => item.label),
      datasets: [
        {
          label: 'Target',
          data: dashboardGaSeries.map((item) => item.target),
          backgroundColor: 'rgba(148, 163, 184, 0.85)',
          borderColor: 'rgba(100, 116, 139, 1)',
          borderWidth: 1,
          borderRadius: 10,
        },
        {
          label: 'Current Direct Attainment',
          data: dashboardGaSeries.map((item) => item.direct),
          backgroundColor: 'rgba(79, 70, 229, 0.95)',
          borderColor: 'rgba(67, 56, 202, 1)',
          borderWidth: 1,
          borderRadius: 10,
        },
      ],
    };

    const feedbackChartData = {
      labels: dashboardTrend.map((item) => item.label),
      datasets: [
        {
          label: 'Course Exit Surveys',
          data: dashboardTrend.map((item) => item.courseExit),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
          pointBorderColor: '#fff',
          pointRadius: 4,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Alumni Feedback',
          data: dashboardTrend.map((item) => item.alumniFeedback),
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          pointBackgroundColor: 'rgba(99, 102, 241, 1)',
          pointBorderColor: '#fff',
          pointRadius: 4,
          tension: 0.35,
          fill: true,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded' as const,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 12,
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: (value: string | number) => `${value}%`,
          },
        },
      },
    } as const;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-700 to-slate-900 p-6 text-white shadow-2xl border border-white/10">
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage:
                   'radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 28%), radial-gradient(circle at bottom left, rgba(255,255,255,0.18), transparent 24%)',
               }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] backdrop-blur">
                HOD Landing Dashboard
              </div>
              <div>
                <h2 className="text-3xl font-black leading-tight md:text-4xl">
                  Department analytics at a glance
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-indigo-100 md:text-base">
                  A live overview of batches, faculty, CQI alerts, and feedback movement across the department.
                </p>
              </div>
            </div>
            <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm md:grid-cols-2">
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Active Batches</p>
                <p className="mt-2 text-2xl font-black">{dashboardSummary.activeBatches}</p>
                <p className="mt-1 text-xs text-indigo-100">Department wide</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Pending CQIs</p>
                <p className="mt-2 text-2xl font-black">{dashboardSummary.pendingCqi}</p>
                <p className="mt-1 text-xs text-indigo-100">CQI reviews</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: 'Total Active Batches',
              value: dashboardSummary.activeBatches,
              helper: 'Batches currently active in the system',
              accent: 'from-indigo-600 to-indigo-500',
              icon: Users,
            },
            {
              title: 'Faculty Strength',
              value: dashboardSummary.facultyStrength,
              helper: 'Registered instructors and teaching staff',
              accent: 'from-emerald-600 to-emerald-500',
              icon: User,
            },
            {
              title: 'Pending CQIs',
              value: dashboardSummary.pendingCqi,
              helper: 'CQI items requiring action',
              accent: 'from-rose-600 to-orange-500',
              icon: Bell,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className={`h-2 bg-gradient-to-r ${card.accent}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <Icon className="h-6 w-6 text-slate-700" />
                    </div>
                    {card.title === 'Pending CQIs' ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-rose-700">
                        Action Required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">{card.title}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Cohort GA Attainment Overview</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">Grouped GA attainment vs target</h3>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                GA-1 to GA-12
              </span>
            </div>
            <div className="h-[360px]">
              {dashboardGaSeries.length > 0 ? (
                <Bar data={gaChartData} options={chartOptions} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  No GA attainment data available for the selected batch.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Survey Feedback Trend</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">Course exit and alumni feedback</h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Last 4 batches
              </span>
            </div>
            <div className="h-[360px]">
              {dashboardTrend.length > 0 ? (
                <Line data={feedbackChartData} options={chartOptions} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  No feedback trend data available for the latest batches.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recent Active CQI Alerts</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">CQI items requiring attention</h3>
            </div>
            <div className="p-5">
              {dashboardAlerts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {dashboardAlerts.map((alert) => (
                    <div key={`${alert.source}-${alert.code}-${alert.title}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-indigo-700">
                              CQI
                            </span>
                          </div>
                          <div className="mt-3 font-semibold text-slate-900">{alert.code}</div>
                          <div className="mt-1 text-sm text-slate-600">{alert.title}</div>
                          {alert.owner ? <div className="mt-1 text-xs text-slate-400">{alert.owner}</div> : null}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            {alert.attainment !== null ? `${alert.attainment.toFixed(2)}%` : 'Pending'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {alert.threshold !== null ? `Target ${alert.threshold.toFixed(2)}%` : 'CLO review'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-rose-700">
                          {alert.action}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No CQI alerts detected.
                </div>
              )}
            </div>
        </div>
      </motion.div>
    );
  };

  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-indigo-800 to-purple-900 text-white p-4 min-h-screen shadow-xl flex flex-col">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
          {headerImageUrl ? (
            <img src={headerImageUrl} alt={headerName} className="w-full h-full object-cover" />
          ) : (
            <User className="h-10 w-10" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-white truncate px-2">{headerName}</h3>
        <p className="text-xs text-purple-200 uppercase tracking-widest">HOD</p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {mainItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-2">
          {sidebarGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = expandedGroups[group.id] ?? false;
            const groupActive = group.children.some((child) => child.id === activeTab);

            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.id]: !prev[group.id],
                    }))
                  }
                  className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all duration-200 ${
                    groupActive ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' : 'text-purple-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center">
                    <GroupIcon className="w-5 h-5 mr-3" />
                    <span className="font-semibold text-sm">{group.label}</span>
                  </span>
                  <span className="text-xs">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="ml-3 space-y-1 border-l border-white/10 pl-2">
                    {group.children.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id as TabId)}
                          className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                              : 'text-purple-100 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4 mr-3" />
                          <span className="flex-1 text-left font-semibold text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 rounded-lg text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </div>
  );

  const renderContent = () => {
    const hasDashboardData = dashboardSummary.activeBatches > 0 || dashboardAlerts.length > 0 || dashboardGaSeries.length > 0 || dashboardTrend.length > 0;
    if (loading && !hasDashboardData) return <div className="p-4">Loading HOD Dashboard...</div>;
    if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();

      case 'obe-management':
        return <CoordinatorOBEMappingModule />;

      case 'cqi':
        return <HODCQI />;

      case 'clo-report':
        return <CoordinatorCLOReportModule />;

      case 'ga-report':
        return <CoordinatorGAReportModule />;

      case 'ga-cqi-advisory':
        return <HODCQIAdvisoryExport />;

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

      case "result-editing":
        return <EnableResultEditing />;

      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8] overflow-x-hidden">
      <Toaster position="top-right" reverseOrder={false} />
      {renderTabs()}
      <div className="flex-1 min-w-0">
        <header className="bg-gradient-to-r from-indigo-700 to-purple-700 p-6 shadow-xl border-b border-white/20">
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden border-2 border-white shadow-lg">
                {headerImageUrl ? (
                  <img
                    src={headerImageUrl}
                    alt={headerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-white">
                    {headerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white capitalize">
                  {activeTab.replace('-', ' ')}
                </h1>
                <p className="text-purple-100 text-sm opacity-80">
                  HOD Management Portal
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={headerProfile} showAvatar={false} />
            </div>
          </motion.div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularHODDashboard;
