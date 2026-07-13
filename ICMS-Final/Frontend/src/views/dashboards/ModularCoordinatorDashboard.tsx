import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CoordinatorCQIReport from '../pages/CoordinatorCQIReport';
import { 
  LayoutDashboard,
  MessageSquare, 
  BookOpen, 
  Users, 
  
  User,
  GraduationCap, 
  Settings,
  CheckCircle,
  LogOut,
  FileBarChart,
  Award,
  FileSpreadsheet,
  ClipboardList
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
import OBEReportDashboard from '../modules/coordinator/OBEReportDashboard';
import PEOReport from '../../pages/PEOReport';
import CoordinatorExitSurveySetup from '../modules/coordinator/CoordinatorExitSurveySetup';

import { api } from '../../api/api';
import CoordinatorFeedbackView from "../pages/CoordinatorFeedbackView";

type TabId = 'dashboard' | 'curriculum-versions' | 'course-allocations' | 'instructors' | 'programs' | 'clo-reports' | 'ga-reports' | 'obe-report' | 'peo-report' | 'student-obe' | 'feedback';

const ModularCoordinatorDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [coordinatorProfile, setCoordinatorProfile] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<any>(null);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    reports: true,
    feedback: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseRes, batchRes, allocRes] = await Promise.all([
          api.get("courses/"),
          api.get("batches/all/"),
          api.get("coordinators/"),
        ]);

        const extractArrayData = (res: any) => {
          if (Array.isArray(res.data)) return res.data;
          if (Array.isArray(res.data?.data)) return res.data.data;
          if (Array.isArray(res.data?.results)) return res.data.results;
          return [];
        };

        const courses = extractArrayData(courseRes);
        const batches = extractArrayData(batchRes);
        const allocs = extractArrayData(allocRes);

        setAllCourses(courses);
        setBatches(batches);
        setAllocations(allocs);
        setFilteredCourses(courses);
      } catch (err) {
        console.error("❌ Dropdown error:", err);
        setAllCourses([]);
        setBatches([]);
        setAllocations([]);
        setFilteredCourses([]);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedBatch) {
      setFilteredCourses(allCourses);
      setSelectedCourse(null);
      return;
    }

    const allocatedCourseIds = new Set(
      allocations
        .filter((alloc: any) => {
          const allocBatchId = alloc.batch?.id || alloc.batch_id;
          return allocBatchId === selectedBatch.id;
        })
        .map((alloc: any) => {
          return alloc.course?.id || alloc.course_id;
        })
    );

    let filtered = allCourses;
    if (allocatedCourseIds.size > 0) {
      filtered = allCourses.filter((course: any) =>
        allocatedCourseIds.has(course.id)
      );
    }

    setFilteredCourses(filtered);
    
    if (selectedCourse && !filtered.find((c: any) => c.id === selectedCourse.id)) {
      setSelectedCourse(null);
    }
  }, [selectedBatch, allCourses, allocations]);

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

  const headerProfile = coordinatorProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'Coordinator').trim();

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
        { id: 'peo-report', label: 'PEO Report', icon: FileSpreadsheet },
        { id: 'obe-report', label: 'OBE Report', icon: FileSpreadsheet },
      ],
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: MessageSquare,
      children: [
        { id: 'feedback', label: 'Feedback', icon: MessageSquare },
      ],
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6"
          >
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Active Versions</h3>
              <p className="text-4xl font-black text-gray-900 mt-2">12</p>
              <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[70%]" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Pending Allocations</h3>
              <p className="text-4xl font-black text-orange-600 mt-2">5</p>
              <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 w-[40%]" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Courses</h3>
              <p className="text-4xl font-black text-blue-600 mt-2">48</p>
              <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[85%]" />
              </div>
            </div>
          </motion.div>
        );
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
      case 'obe-report':
        return <OBEReportDashboard />;
      case 'peo-report':
        return <PEOReport />;
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
        <div className="mb-6 text-center">
          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt="Coordinator" className="w-full h-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-white" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-white truncate px-2">{headerName}</h3>
          <p className="text-xs text-green-200 uppercase tracking-widest">Coordinator</p>
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
        </nav>

        <div className="mt-6 pt-4 border-t border-white/10">
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
              <TopbarProfileMenu userData={coordinatorProfile || currentUser} />
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
