import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  User,
  GraduationCap, 
  Settings,
  CheckCircle,
  LogOut,
  LayoutGrid,
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
import CoordinatorOBEMappingModule from '../modules/coordinator/CoordinatorOBEMappingModule';
import TeacherManagement from '../pages/TeacherManagement';
import SacProgramSetup from '../pages/SacProgramSetup';
import GAReport from '../../pages/GAReport';
import PEOReport from '../../pages/PEOReport';
import StudentOBEList from '../../pages/StudentOBEList';

type TabId = 'dashboard' | 'curriculum-versions' | 'course-allocations' | 'obe-mapping' | 'instructors' | 'programs' | 'ga-report' | 'peo-report' | 'student-obe';

const ModularCoordinatorDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [coordinatorProfile, setCoordinatorProfile] = useState<any>(null);

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

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'curriculum-versions', label: 'Curriculum Versions', icon: BookOpen },
    { id: 'course-allocations', label: 'Course Allocation', icon: CheckCircle },
    { id: 'obe-mapping', label: 'OBE Mapping', icon: LayoutGrid },
    { id: 'ga-report', label: 'GA Report', icon: FileBarChart },
    { id: 'peo-report', label: 'PEO Report', icon: Award },
    { id: 'student-obe', label: 'Student OBE', icon: Users },
    { id: 'instructors', label: 'Instructors', icon: Users },
    { id: 'programs', label: 'Programs & Batches', icon: GraduationCap },
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
      case 'obe-mapping':
        return <CoordinatorOBEMappingModule />;
      case 'ga-report':
        return <GAReport />;
      case 'peo-report':
        return <PEOReport />;
      case 'student-obe':
        return <StudentOBEList />;
      case 'instructors':
        return <TeacherManagement activeTab={activeTab} />;
      case 'programs':
        return <SacProgramSetup onManagePromotion={() => {}} />; // Coordinator might not manage promotion but can see setup
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F0FDF4]">
      <Toaster position="top-right" reverseOrder={false} />
      {/* Sidebar */}
      <div className="w-72 bg-gradient-to-b from-green-700 via-emerald-800 to-teal-900 text-white p-4 space-y-2 min-h-screen shadow-xl">
        <div className="mb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt="Coordinator" className="w-full h-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-white" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white truncate px-2">{headerName}</h3>
          <p className="text-xs text-green-200 uppercase tracking-widest">Coordinator</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id as TabId);
                      setSelectedVersionId(null);
                    }}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === item.id 
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                        : 'text-green-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span className="flex-1 text-left font-semibold">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8 pt-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700 p-6 shadow-xl border-b border-white/20">
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
                <p className="text-green-100 text-sm opacity-80">
                  Coordinator Management Portal
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={coordinatorProfile || currentUser} />
            </div>
          </motion.div>
        </header>

        {/* Content */}
        <div className="p-6">
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

