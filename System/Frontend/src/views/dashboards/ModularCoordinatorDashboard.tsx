import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Users,
  GraduationCap,
  CheckCircle,
  FileBarChart,
  Award,
  Layers,
  Archive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import ModularDashboardShell from '../../components/layout/ModularDashboardShell';
import DashboardStatCard from '../../components/layout/DashboardStatCard';
import CurriculumVersionListPage from '../modules/curriculum/CurriculumVersionListPage';
import CurriculumVersionDetailPage from '../modules/curriculum/CurriculumVersionDetailPage';
import CourseAllocationBulkModule from '../modules/coordinator/CourseAllocationBulkModule';
import CoordinatorCLOReportModule from '../modules/coordinator/CoordinatorCLOReportModule';
import CoordinatorGAReportModule from '../modules/coordinator/CoordinatorGAReportModule';
import { coordinatorService } from '../../api/coordinatorService';

import { api } from '../../api/api';
import CoordinatorFeedbackView from "../pages/CoordinatorFeedbackView";
import CoordinatorBatchStructureView from '../modules/coordinator/CoordinatorBatchStructureView';
import SACElectiveEnrollmentReview from '../pages/SACElectiveEnrollmentReview';

type TabId = 'dashboard' | 'curriculum-versions' | 'course-allocations' | 'batch-structure' | 'instructors' | 'programs' | 'clo-reports' | 'ga-reports' | 'feedback' | 'elective-enrollments';

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

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabId);
    setSelectedVersionId(null);
  };

  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'elective-enrollments', label: 'Elective Enrollments', icon: Users },
    { id: 'curriculum-versions', label: 'Curriculum Versions', icon: BookOpen },
    { id: 'course-allocations', label: 'Course Allocation', icon: CheckCircle },
    { id: 'batch-structure', label: 'Batch Structure', icon: Archive },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
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

  const allTabLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    mainItems.forEach((item) => { labels[item.id] = item.label; });
    sidebarGroups.forEach((group) => group.children.forEach((child) => { labels[child.id] = child.label; }));
    return labels;
  }, []);

  const activeTabLabel = activeTab === 'dashboard'
    ? 'Coordinator Dashboard'
    : (allTabLabels[activeTab] || 'Coordinator Dashboard');

  const renderDashboardLanding = () => {
    if (dashboardLoading && dashboardSnapshot.activeBatches === 0 && dashboardSnapshot.allocations === 0) {
      return (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Loading coordinator dashboard...</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[22px] bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {dashboardError ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {dashboardError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <DashboardStatCard
            title="Active Batches"
            value={dashboardSnapshot.activeBatches}
            helper={`${dashboardSnapshot.batches} total batches`}
            gradient="from-indigo-500 to-purple-600"
            icon={GraduationCap}
            delay={0}
            onClick={() => setActiveTab('programs')}
          />
          <DashboardStatCard
            title="Faculty Strength"
            value={dashboardSnapshot.instructors}
            helper="Registered instructors"
            gradient="from-emerald-500 to-teal-600"
            icon={Users}
            delay={0.05}
            onClick={() => setActiveTab('instructors')}
          />
          <DashboardStatCard
            title="Curriculum Versions"
            value={dashboardSnapshot.curriculumVersions}
            helper={`${dashboardSnapshot.activeVersions} active versions`}
            gradient="from-pink-500 to-rose-600"
            icon={BookOpen}
            delay={0.1}
            onClick={() => setActiveTab('curriculum-versions')}
          />
          <DashboardStatCard
            title="Course Allocations"
            value={dashboardSnapshot.allocations}
            helper={`${dashboardSnapshot.allocatedCourses} unique courses`}
            gradient="from-cyan-500 to-blue-600"
            icon={Layers}
            delay={0.15}
            onClick={() => setActiveTab('course-allocations')}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100">
            <div className="mb-5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Coordination Snapshot</p>
              <h3 className="mt-1 text-lg font-black text-gray-900">Operational readiness</h3>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">Active batches</span>
                  <span className="font-bold text-gray-900">{dashboardSnapshot.activeBatches} / {dashboardSnapshot.batches}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${dashboardSnapshot.batches > 0 ? Math.round((dashboardSnapshot.activeBatches / dashboardSnapshot.batches) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">Curriculum versions</span>
                  <span className="font-bold text-gray-900">{dashboardSnapshot.activeVersions} active</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500" style={{ width: `${dashboardSnapshot.curriculumVersions > 0 ? Math.round((dashboardSnapshot.activeVersions / dashboardSnapshot.curriculumVersions) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-700">Pending allocations</span>
                  <span className="font-bold text-gray-900">{dashboardSnapshot.pendingAllocations}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${dashboardSnapshot.allocations > 0 ? Math.round(((dashboardSnapshot.allocations - dashboardSnapshot.pendingAllocations) / dashboardSnapshot.allocations) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100">
            <div className="mb-5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Recent Allocations</p>
              <h3 className="mt-1 text-lg font-black text-gray-900">Latest course assignments</h3>
            </div>
            {recentAllocations.length > 0 ? (
              <div className="space-y-3">
                {recentAllocations.map((allocation, index) => (
                  <div key={`${allocation.courseCode}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <p className="font-semibold text-gray-900">{allocation.courseName}</p>
                    {allocation.courseCode ? (
                      <p className="mt-1 text-xs font-medium text-gray-500">{allocation.courseCode}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-gray-600">Instructor: {allocation.instructorName}</p>
                    <p className="mt-1 text-xs text-gray-400">Batch: {allocation.batchName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
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
      case 'elective-enrollments':
        return <SACElectiveEnrollmentReview />;
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
      case 'batch-structure':
        return <CoordinatorBatchStructureView />;
      case 'clo-reports':
        return <CoordinatorCLOReportModule />;
      case 'ga-reports':
        return <CoordinatorGAReportModule />;
      case 'feedback':
        return <CoordinatorFeedbackView />;
      default:
        return null;
    }
  };

  return (
    <ModularDashboardShell
      roleLabel="Coordinator"
      portalLabel="OBE Academic System"
      headerName={headerName}
      headerImageUrl={headerImageUrl}
      activeTab={activeTab}
      activeTabLabel={activeTabLabel}
      tabs={mainItems}
      tabGroups={sidebarGroups}
      expandedGroups={expandedGroups}
      onToggleGroup={(groupId) =>
        setExpandedGroups((prev) => ({
          ...prev,
          [groupId]: !prev[groupId],
        }))
      }
      onTabChange={handleTabChange}
      onLogout={logout}
      profileData={coordinatorProfile || currentUser}
    >
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
    </ModularDashboardShell>
  );
};

export default ModularCoordinatorDashboard;
