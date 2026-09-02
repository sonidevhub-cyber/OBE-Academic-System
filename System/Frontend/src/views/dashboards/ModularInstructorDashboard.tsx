import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ClipboardCheck, Layers } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OBEModule from '../modules/OBEModule';
import MyCoursesModule from '../modules/MyCoursesModule';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import AssignedRetakesPanel from '../../features/retake/AssignedRetakesPanel';
import RetakeResultEntryPage from '../pages/RetakeResultEntryPage';
import ModularDashboardShell from '../../components/layout/ModularDashboardShell';
import DashboardStatCard from '../../components/layout/DashboardStatCard';
import { instructorCourseService, InstructorCourse } from '../../api/instructorCourseService';
import CourseHistoryModule from "../modules/CourseHistoryModule";

type TabId = 'dashboard' | 'courses' | 'obe' | 'history'| 'retakes';

const ModularInstructorDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [instructorProfile, setInstructorProfile] = useState<any>(null);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const retakeIdFromQuery = searchParams.get('retake_id');

  const loadInstructorCourses = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const response = await instructorCourseService.getMyCourses();
      const coursesData =
        response.data?.data ||
        response.data?.courses ||
        response.data;
      setInstructorCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (error) {
      console.error('Failed to load instructor courses:', error);
      setInstructorCourses([]);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'instructor');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setInstructorProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch instructor profile:', error);
        if (!cancelled) {
          setInstructorProfile(currentUser);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    void loadInstructorCourses();
  }, [loadInstructorCourses]);

  useEffect(() => {
    if (retakeIdFromQuery) {
      setActiveTab('retakes');
    }
  }, [retakeIdFromQuery]);

  const instructorHeaderProfile = instructorProfile || currentUser;
  const instructorHeaderImageUrl = getProfileImageUrl(instructorHeaderProfile);
  const instructorHeaderName = (
    instructorHeaderProfile?.full_name ||
    instructorHeaderProfile?.name ||
    instructorHeaderProfile?.first_name ||
    instructorHeaderProfile?.username ||
    'Instructor'
  ).trim();

  const handleLogout = () => {
    logout();
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'courses', label: 'My Courses', iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'obe', label: 'OBE Management', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'retakes', label: 'Assigned Retakes', iconPath: 'M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'history', label: 'Course History', iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'},
  ];

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Instructor Dashboard';
  const uniqueBatches = new Set(
    instructorCourses.map((course) => course.batch_name || course.batch_id || course.batch)
  ).size;

  const renderInstructorDashboard = () => {
    if (dashboardLoading) {
      return (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Loading instructor dashboard...</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[22px] bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <DashboardStatCard
            title="My Courses"
            value={instructorCourses.length}
            helper="Assigned teaching load"
            gradient="from-indigo-500 to-purple-600"
            icon={BookOpen}
            delay={0}
            onClick={() => setActiveTab('courses')}
          />
          <DashboardStatCard
            title="Active Batches"
            value={uniqueBatches}
            helper="Current cohort coverage"
            gradient="from-emerald-500 to-teal-600"
            icon={Layers}
            delay={0.05}
          />
          <DashboardStatCard
            title="Teaching Assignments"
            value={instructorCourses.length}
            helper="Approved course allocations"
            gradient="from-pink-500 to-rose-600"
            icon={ClipboardCheck}
            delay={0.1}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Teaching Snapshot</p>
                <h3 className="mt-1 text-lg font-black text-gray-900">Recent course assignments</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('courses')}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700"
              >
                View all
              </button>
            </div>

            {instructorCourses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {instructorCourses.slice(0, 4).map((course) => (
                  <div key={course.allocation_id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{course.course_code}</p>
                    <h4 className="mt-2 text-lg font-bold text-gray-900">{course.course_name}</h4>
                    <p className="mt-2 text-sm text-gray-600">Batch: {course.batch_name}</p>
                    {course.semester_no ? (
                      <p className="mt-1 text-sm text-gray-600">Semester: {course.semester_no}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-gray-500">Coordinator: {course.coordinator_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No course assignments found yet.
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[22px] shadow-sm border border-gray-100">
            <div className="mb-5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Quick Actions</p>
              <h3 className="mt-1 text-lg font-black text-gray-900">Jump to your work</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Open My Courses', helper: 'View full teaching load', tab: 'courses' as TabId, tone: 'bg-indigo-50 hover:bg-indigo-100' },
                { label: 'OBE Management', helper: 'CLOs, assessments, and mapping', tab: 'obe' as TabId, tone: 'bg-emerald-50 hover:bg-emerald-100' },
                { label: 'Assigned Retakes', helper: 'Pending result entry and retakes', tab: 'retakes' as TabId, tone: 'bg-violet-50 hover:bg-violet-100' },
              ].map((action) => (
                <button
                  key={action.tab}
                  onClick={() => setActiveTab(action.tab)}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${action.tone}`}
                >
                  <p className="font-bold text-gray-900">{action.label}</p>
                  <p className="mt-1 text-sm text-gray-600">{action.helper}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'courses':
        return <MyCoursesModule />;
      case 'dashboard':
        return renderInstructorDashboard();
      case 'obe':
        return <OBEModule />;
      case 'history':
  return (
    <CourseHistoryModule
      onViewReport={(course) => {
        console.log("Selected historical course:", course);

        // temporary test
        alert(
          `Course: ${course.course_name || course.course?.name}\n` +
          `Batch: ${course.batch_name || course.batch?.name}\n` +
          `Semester: ${course.semester_no || course.semester?.name}`
        );
      }}
    />
  );
      case 'retakes':
        if (retakeIdFromQuery) {
          return <RetakeResultEntryPage />;
        }
        return (
          <AssignedRetakesPanel
            onOpenResults={(group) => {
              const firstRetakeId = group.retakes[0]?.id;
              if (!firstRetakeId) return;

              navigate(`/teacher?retake_id=${encodeURIComponent(firstRetakeId)}&tab=retakes`, {
                state: {
                  retakeGroup: group,
                  retake: group.retakes[0],
                },
              });
            }}
          />
        );
      default:
        return renderInstructorDashboard();
    }
  };

  return (
    <ModularDashboardShell
        roleLabel="Instructor"
        portalLabel="OBE Academic System"
        headerName={instructorHeaderName}
        headerImageUrl={instructorHeaderImageUrl}
        activeTab={activeTab}
        activeTabLabel={activeTabLabel}
        tabs={tabs}
        onTabChange={(tabId) => setActiveTab(tabId as TabId)}
        onLogout={handleLogout}
        profileData={instructorProfile || currentUser}
      >
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </ModularDashboardShell>
  );
};

export default ModularInstructorDashboard;
