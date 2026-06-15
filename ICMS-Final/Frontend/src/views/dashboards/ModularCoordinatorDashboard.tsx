import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CoordinatorCQIReport from '../pages/CoordinatorCQIReport';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  User,
  GraduationCap, 
  Settings,
  CheckCircle,
  LogOut,
  LayoutGrid
} from 'lucide-react';
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
import { api } from '../../api/api';

type TabId = 'dashboard' | 'curriculum-versions' | 'course-allocations' | 'obe-mapping' | 'instructors' | 'programs'| 'clo-reports';

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
  const [courses, setCourses] = useState<any[]>([]);
  useEffect(() => {
  const fetchData = async () => {
    try {
      const [courseRes, batchRes] = await Promise.all([
        api.get("courses/"),
        api.get("batches/all/"),
        
      ]);

      // ✅ SAFE HANDLING
      setCourses(
        Array.isArray(courseRes.data)
          ? courseRes.data
          : courseRes.data.results || []
      );

      setBatches(
        Array.isArray(batchRes.data)
          ? batchRes.data
          : batchRes.data.results || []
      );

      

      // 🔍 DEBUG (optional but useful)
      console.log("Courses:", courseRes.data);
      console.log("Batches:", batchRes.data);
      

    } catch (err) {
      console.error("Dropdown error:", err);
    }
  };

  fetchData();
}, []);
//   useEffect(() => {
//   const fetchData = async () => {
//     try {
//       const courseRes = await api.get("courses/");

//       setCourses(courseRes.data.results || courseRes.data || []);

//       console.log("Courses:", courseRes.data);

//     } catch (err: any) {
//       console.error("Dropdown error:", err.response?.data || err);
//     }
//   };

//   fetchData();
// }, []);
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
    { id: 'instructors', label: 'Instructors', icon: Users },
    { id: 'programs', label: 'Programs & Batches', icon: GraduationCap },
    { id: 'clo-reports', label: 'Clo-Reports', icon: CheckCircle },
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
              id={selectedVersionId} 
              onClose={() => setSelectedVersionId(null)} 
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
      case 'instructors':
        return <TeacherManagement activeTab={activeTab} />;
      case 'programs':
        return <SacProgramSetup onManagePromotion={() => {}} />; // Coordinator might not manage promotion but can see setup
    case 'clo-reports':
  return (
    <>
      {/* 🔽 FILTER UI */}
      <div className="p-6 bg-white rounded-xl shadow mb-4">
        <h2 className="font-bold mb-3">Select Filters</h2>

        <div className="flex gap-4 flex-wrap">

          {/* ✅ COURSE */}
          <select
            className="border p-2 rounded"
            onChange={(e) => setSelectedCourse({ id: e.target.value })}
          >
            <option value="">Select Course</option>
            {courses.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name || c.code}
              </option>
            ))}
          </select>

          {/* ✅ BATCH */}
          <select
            className="border p-2 rounded"
            onChange={(e) => {
              const batch = batches.find(b => b.id === e.target.value);
              setSelectedBatch(batch);

              // 🔥 AUTO SET SEMESTER
              if (batch) {
                setSelectedSemester({
                  id: batch.current_semester,
                  name: `Semester ${batch.current_semester}`
                });
              }
            }}
          >
            <option value="">Select Batch</option>
            {batches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* ✅ SEMESTER (AUTO + MANUAL BOTH) */}
          <select
            className="border p-2 rounded"
            value={selectedSemester?.id || ''}
            onChange={(e) =>
              setSelectedSemester({
                id: e.target.value,
                name: `Semester ${e.target.value}`
              })
            }
          >
            <option value="">Select Semester</option>

            {selectedBatch &&
              Array.from(
                { length: selectedBatch.current_semester },
                (_, i) => i + 1
              ).map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
          </select>

        </div>

        {/* ✅ SHOW CURRENT SEM */}
        {selectedBatch && (
          <p className="text-sm text-gray-600 mt-2">
            Current Semester: Semester {selectedBatch.current_semester}
          </p>
        )}
      </div>

      {/* 🔒 CONDITION */}
      {!selectedCourse?.id || !selectedBatch?.id || !selectedSemester?.id ? (
        <div className="p-6 text-center text-gray-500">
          Please select Course, Batch and Semester
        </div>
      ) : (
        <CoordinatorCQIReport
          courseId={selectedCourse.id}
          batchId={selectedBatch.id}
          semesterId={String(selectedSemester.id)} // ✅ FINAL FIX
        />
      )}
    </>
  );
        default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#F0FDF4]">
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

