import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard,
  MessageSquare, 
  BookOpen, 
  Users, 
  
  User,
  GraduationCap, 
  CheckCircle,
  LogOut,
  FileBarChart,
  Award
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import CurriculumVersionListPage from '../modules/curriculum/CurriculumVersionListPage';
import CurriculumVersionDetailPage from '../modules/curriculum/CurriculumVersionDetailPage';
import CourseAllocationBulkModule from '../modules/coordinator/CourseAllocationBulkModule';
import TeacherManagement from '../pages/TeacherManagement';
import SacProgramSetup from '../pages/SacProgramSetup';
import CoordinatorCLOReportModule from '../modules/coordinator/CoordinatorCLOReportModule';
import CoordinatorGAReportModule from '../modules/coordinator/CoordinatorGAReportModule';
import { coordinatorService } from '../../api/coordinatorService';

import { api } from '../../api/api';
import CoordinatorFeedbackView from "../pages/CoordinatorFeedbackView";

type TabId = 'dashboard' | 'curriculum-versions' | 'course-allocations' | 'instructors' | 'programs' | 'clo-reports' | 'ga-reports' | 'feedback';

type DashboardMetric = {
  label: string;
  value: number | string;
  helper: string;
  accent: string;
  icon: React.ElementType;
};

const ModularCoordinatorDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [coordinatorProfile, setCoordinatorProfile] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardSnapshot, setDashboardSnapshot] = useState({
    programs: 0,
    batches: 0,
    activeBatches: 0,
    instructors: 0,
    curriculumVersions: 0,
    activeVersions: 0,
    allocations: 0,
    allocatedCourses: 0,
    pendingAllocations: 0,
    feedbackBatches: 0,
    focusBatchName: 'Loading...',
    focusProgramName: 'Loading...',
    latestVersionNo: 'N/A',
  });
  const [recentAllocations, setRecentAllocations] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    reports: true,
  });

  const extractList = (payload: any) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const loadDashboardData = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const [
        programsRes,
        batchesRes,
        instructorsRes,
        versionsRes,
        allocationsRes,
        feedbackBatchesRes,
      ] = await Promise.allSettled([
        coordinatorService.getPrograms(),
        coordinatorService.getBatches(),
        coordinatorService.getInstructors(),
        coordinatorService.getCurriculumVersions(),
        coordinatorService.getCourseAllocations(),
        api.get('/feedback/coordinator-batches/'),
      ]);

      const programs = programsRes.status === 'fulfilled' ? extractList(programsRes.value?.data ?? programsRes.value) : [];
      const batches = batchesRes.status === 'fulfilled' ? extractList(batchesRes.value?.data ?? batchesRes.value) : [];
      const instructors = instructorsRes.status === 'fulfilled' ? extractList(instructorsRes.value?.data ?? instructorsRes.value) : [];
      const versions = versionsRes.status === 'fulfilled' ? extractList(versionsRes.value?.data ?? versionsRes.value) : [];
      const allocations = allocationsRes.status === 'fulfilled' ? extractList(allocationsRes.value?.data ?? allocationsRes.value) : [];
      const feedbackBatches = feedbackBatchesRes.status === 'fulfilled' ? extractList(feedbackBatchesRes.value?.data ?? feedbackBatchesRes.value) : [];

      const activeBatches = batches.filter((batch: any) => batch?.is_active !== false && String(batch?.status || '').toLowerCase() !== 'archived');
      const activeVersions = versions.filter((version: any) => version?.is_active || String(version?.status || '').toLowerCase() === 'active');
      const pendingAllocations = allocations.filter((allocation: any) =>
        ['pending', 'proposed', 'draft'].includes(String(allocation?.status || '').toLowerCase())
      );

      const uniqueAllocatedCourses = new Set(
        allocations
          .map((allocation: any) => allocation?.course?.id || allocation?.course_id || allocation?.course)
          .filter(Boolean)
          .map((value: any) => String(value))
      );

      const latestVersion = [...versions].sort((a: any, b: any) => {
        const aDate = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const bDate = new Date(b?.updated_at || b?.created_at || 0).getTime();
        return bDate - aDate;
      })[0];

      const focusBatch = activeBatches[0] || batches[0] || null;
      const focusProgramName = focusBatch?.program_name || focusBatch?.program?.name || programs[0]?.name || 'Program not selected';

      setDashboardSnapshot({
        programs: programs.length,
        batches: batches.length,
        activeBatches: activeBatches.length,
        instructors: instructors.length,
        curriculumVersions: versions.length,
        activeVersions: activeVersions.length,
        allocations: allocations.length,
        allocatedCourses: uniqueAllocatedCourses.size,
        pendingAllocations: pendingAllocations.length,
        feedbackBatches: feedbackBatches.length,
        focusBatchName: focusBatch?.name || focusBatch?.batch_name || 'No active batch',
        focusProgramName,
        latestVersionNo: latestVersion?.version_no || latestVersion?.version || 'N/A',
      });

      setRecentAllocations(
        allocations.slice(0, 4).map((allocation: any) => ({
          courseName: allocation?.course_name || allocation?.course?.name || allocation?.course?.course_name || 'Course',
          courseCode: allocation?.course_code || allocation?.course?.code || allocation?.course?.course_code || '',
          instructorName: allocation?.instructor_name || allocation?.teacher_name || allocation?.teacher?.name || 'Unassigned',
          batchName: allocation?.batch_name || allocation?.batch?.name || focusBatch?.name || 'Batch',
          status: allocation?.status || 'active',
        }))
      );
    } catch (err) {
      console.error('Failed to load coordinator dashboard data:', err);
      setDashboardError('Dashboard data could not be loaded right now.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'coordinator');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setCoordinatorProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch coordinator profile:', error);
        if (!cancelled) {
          setCoordinatorProfile(currentUser);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    void loadDashboardData();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadDashboardData();
      }
    };

    const handleFocus = () => {
      void loadDashboardData();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    const intervalId = window.setInterval(() => {
      void loadDashboardData();
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [loadDashboardData]);

  const headerProfile = coordinatorProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'Coordinator').trim();
  const dashboardMetrics: DashboardMetric[] = [
    {
      label: 'Active Batches',
      value: dashboardSnapshot.activeBatches,
      helper: 'Batches currently active',
      accent: 'from-emerald-600 to-teal-500',
      icon: GraduationCap,
    },
    {
      label: 'Faculty Strength',
      value: dashboardSnapshot.instructors,
      helper: 'Registered instructors',
      accent: 'from-sky-600 to-cyan-500',
      icon: Users,
    },
    {
      label: 'Curriculum Versions',
      value: dashboardSnapshot.curriculumVersions,
      helper: `${dashboardSnapshot.activeVersions} active versions`,
      accent: 'from-violet-600 to-indigo-500',
      icon: BookOpen,
    },
    {
      label: 'Course Allocations',
      value: dashboardSnapshot.allocations,
      helper: `${dashboardSnapshot.allocatedCourses} unique courses`,
      accent: 'from-amber-600 to-orange-500',
      icon: CheckCircle,
    },
  ];

  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'curriculum-versions', label: 'Curriculum Versions', icon: BookOpen },
    { id: 'course-allocations', label: 'Course Allocation', icon: CheckCircle },
    { id: 'instructors', label: 'Instructors', icon: Users },
    { id: 'programs', label: 'Programs & Batches', icon: GraduationCap },
  ];

  const sidebarGroups = [
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart,
      children: [
        { id: 'clo-reports', label: 'CLO Reports', icon: FileBarChart },
        { id: 'ga-reports', label: 'GA Reports', icon: Award },
      ],
    },
  ];

  const renderDashboardLanding = () => {
    const allocationProgress = dashboardSnapshot.allocations > 0
      ? Math.min(100, Math.round((dashboardSnapshot.allocatedCourses / dashboardSnapshot.allocations) * 100))
      : 0;
    const curriculumProgress = dashboardSnapshot.curriculumVersions > 0
      ? Math.min(100, Math.round((dashboardSnapshot.activeVersions / dashboardSnapshot.curriculumVersions) * 100))
      : 0;

    if (dashboardLoading && dashboardSnapshot.activeBatches === 0 && dashboardSnapshot.allocations === 0) {
      return (
        <div className="space-y-4 p-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading coordinator dashboard...</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
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
        className="space-y-6 p-6"
      >
        {dashboardError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {dashboardError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Coordinator Landing Dashboard</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 md:text-3xl">
              Coordinator dashboard at a glance
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Live program, batch, allocation, and report data for {headerName} across {dashboardSnapshot.programs} programs and {dashboardSnapshot.batches} batches.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('course-allocations')}
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Open Allocation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clo-reports')}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 transition-transform hover:-translate-y-0.5"
            >
              View CLO Reports
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className={`h-2 bg-gradient-to-r ${card.accent}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <Icon className="h-6 w-6 text-slate-700" />
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      Updated
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-500">{card.helper}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Coordination Snapshot</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">Real-time operational readiness</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                Auto refresh enabled
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Active batches</span>
                  <span className="font-bold text-slate-900">{dashboardSnapshot.activeBatches} / {dashboardSnapshot.batches}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${dashboardSnapshot.batches > 0 ? Math.round((dashboardSnapshot.activeBatches / dashboardSnapshot.batches) * 100) : 0}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Curriculum versions</span>
                  <span className="font-bold text-slate-900">{dashboardSnapshot.activeVersions} active</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${curriculumProgress}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Course allocation coverage</span>
                  <span className="font-bold text-slate-900">{dashboardSnapshot.allocatedCourses} unique courses</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${allocationProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recent allocations</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">Latest course assignment activity</h3>
              </div>
            </div>

            {recentAllocations.length > 0 ? (
              <div className="space-y-3">
                {recentAllocations.map((allocation, index) => (
                  <div key={`${allocation.courseCode}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{allocation.courseName}</p>
                        {allocation.courseCode ? (
                          <p className="mt-1 text-xs font-medium text-slate-500">{allocation.courseCode}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-slate-600">Instructor: {allocation.instructorName}</p>
                        <p className="mt-1 text-xs text-slate-400">Batch: {allocation.batchName}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                        {String(allocation.status).replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No course allocation activity found yet.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboardLanding();
      case 'curriculum-versions':
        if (selectedVersionId) {
          return (
            <CurriculumVersionDetailPage 
              key={`version-${selectedVersionId}`}
              id={selectedVersionId} 
              onClose={() => setSelectedVersionId(null)} 
              onVersionCreated={(id: number) => setSelectedVersionId(String(id))}
            />
          );
        }
        return (
          <CurriculumVersionListPage 
            onViewVersion={(id) => setSelectedVersionId(id)}
            onCreateNew={() => setSelectedVersionId('new')}
          />
        );
      case 'course-allocations':
        return <CourseAllocationBulkModule />;
      case 'clo-reports':
        return <CoordinatorCLOReportModule />;
      case 'ga-reports':
        return <CoordinatorGAReportModule />;
      case 'instructors':
        return <TeacherManagement activeTab={activeTab} />;
      case 'programs':
        return <SacProgramSetup onManagePromotion={() => {}} />;
      case 'feedback':
        return <CoordinatorFeedbackView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F0FDF4] overflow-hidden">
      <Toaster position="top-right" reverseOrder={false} />
      {/* Sidebar - Reduced width */}
      <div className="w-56 bg-gradient-to-b from-green-700 via-emerald-800 to-teal-900 text-white p-3 space-y-2 flex-shrink-0 shadow-xl overflow-y-auto">
        <div className="mt-4 mb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-3 flex items-center justify-center border border-white/30 overflow-hidden shadow-md">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt="Coordinator" className="w-full h-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-white" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white truncate px-2 leading-tight">{headerName}</h3>
          <p className="mt-1 text-xs text-green-200 uppercase tracking-[0.2em]">Coordinator</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id as TabId);
                      setSelectedVersionId(null);
                    }}
                    className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === item.id 
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                        : 'text-green-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left font-semibold text-sm">{item.label}</span>
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 ${
                      groupActive
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-green-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center">
                      <GroupIcon className="h-4 w-4 mr-2" />
                      <span className="flex-1 text-left font-semibold text-sm">{group.label}</span>
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
                            onClick={() => {
                              setActiveTab(item.id as TabId);
                              setSelectedVersionId(null);
                            }}
                            className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                              isActive
                                ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                                : 'text-green-100 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <ItemIcon className="h-4 w-4 mr-2" />
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

          <div className="mt-4">
            <button
              onClick={() => {
                setActiveTab('feedback');
                setSelectedVersionId(null);
              }}
              className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                activeTab === 'feedback'
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                  : 'text-green-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left font-semibold text-sm">Feedback</span>
            </button>
          </div>

        </nav>

        <div className="mt-10 pt-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-lg text-sm"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content - Vertically scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700 p-4 shadow-xl border-b border-white/20 flex-shrink-0">
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden border-2 border-white shadow-lg">
                {headerImageUrl ? (
                  <img
                    src={headerImageUrl}
                    alt={headerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-base font-semibold text-white">
                    {headerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white capitalize">
                  {activeTab.replace('-', ' ')}
                </h1>
                <p className="text-green-100 text-xs opacity-80">
                  Coordinator Management Portal
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={coordinatorProfile || currentUser} showAvatar={false} />
            </div>
          </motion.div>
        </header>

        {/* Content - Scrollable */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedVersionId || '')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularCoordinatorDashboard;
