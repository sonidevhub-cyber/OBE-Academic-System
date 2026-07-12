import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import TopbarProfileMenu from '../components/TopbarProfileMenu';

// Import Modular Components
import DashboardStats from '../views/modules/DashboardStats';
// import HODManagementModule from '../views/modules/HODManagementModule';
import AnnouncementModule from '../views/modules/AnnouncementModule';
import SacProgramSetup from '../views/pages/SacProgramSetup';
import PendingTransfers from '../views/pages/PendingTransfers';
import ManagePromotion from '../views/pages/ManagePromotion';
import Users from './sac/Users';
import CurriculumVersionListPage from '../views/modules/curriculum/CurriculumVersionListPage';
import CurriculumVersionDetailPage from '../views/modules/curriculum/CurriculumVersionDetailPage';
import RetakeManagementPanel from '../features/retake/RetakeManagementPanel';
// Import Existing Page Components
import StudentManagement from '../views/pages/StudentManagement';
import TeacherManagement from '../views/pages/TeacherManagement';
import { fetchCurrentProfile, updateProfile } from '../api/profileService';
import { adminService } from '../api/adminService';
import { toast } from 'react-toastify';
import { getEffectiveRole, getProfileImageUrl } from '../utils/profileHelpers';
// Import Dashboard Widgets
import SystemHealthWidget from '../components/widgets/dashboard/SystemHealthWidget';
import NotificationPanel from '../components/widgets/dashboard/NotificationPanel';
import QuickActions from '../components/widgets/dashboard/QuickActions';
import ActivityFeed from '../components/widgets/dashboard/ActivityFeed';
import CalendarWidget from '../components/widgets/dashboard/CalendarWidget';

type TabId = 'dashboard' | 'students' | 'instructors' | 'program-setup' | 'curriculum' | 'courses' | 'events' | 'announcements' | 'hod' | 'profile' | 'pending-transfers' | 'promotion-management' | 'users' | 'retake-management';
type AdminTab = { id: TabId; label: string; icon: string; permission?: string; sacOnly?: boolean; badgeCount?: number };

const ModularAdminDashboard = () => {
  const { currentUser, logout, hasPermission, isSAC } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [promotionParams, setPromotionParams] = useState<{programId: string, batchId: string} | null>(null);
  const [adminData, setAdminData] = useState({
    stats: {
      totalStudents: 0,
      totalInstructors: 0,
      totalHods: 0,
      totalAlumni: 0,
      totalBatches: 0,
    },
  });
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [pendingTransfersCount, setPendingTransfersCount] = useState(0);

  // Get auth token
  const authData = localStorage.getItem('auth');
  const token = authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;

  // Navigation tabs
  const tabs = useMemo(() => ([
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', permission: 'manage_students' },
    { id: 'program-setup', label: 'Program Setup', icon: 'M4 6h16M4 12h16M4 18h16', sacOnly: true },
    { id: 'curriculum', label: 'Curriculum', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', sacOnly: true },
    { id: 'users', label: 'Faculty', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', sacOnly: true },
    { id: 'pending-transfers', label: 'Pending Transfers', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', sacOnly: true, badgeCount: pendingTransfersCount },
    { id: 'retake-management', label: 'Retakes', icon: 'M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z', sacOnly: true },
    { id: 'announcements', label: 'Announcements', icon: 'M3 10v4a1 1 0 001 1h3l4 3V6l-4 3H4a1 1 0 00-1 1z', permission: 'manage_announcements' },
  ] as AdminTab[]).filter((tab) => (!tab.permission || isSAC || hasPermission(tab.permission)) && (!tab.sacOnly || isSAC)), [hasPermission, isSAC, pendingTransfersCount]);

  useEffect(() => {
    // Allow 'promotion-management' and 'pending-transfers' as valid tabs even if not in the sidebar list
    const hiddenTabs: TabId[] = ['promotion-management', 'pending-transfers'];
    if (!tabs.some((tab) => tab.id === activeTab) && !hiddenTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, tabs]);

  // Fetch data including actual counts
  const fetchAdminData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/admins/stats/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load dashboard stats: ${response.status}`);
      }

      const responseData = await response.json();
      // Handle both wrapped {data: ...} and unwrapped responses
      const statsData = responseData.data || responseData;

      // Fetch batch count
      let totalBatches = 0;
      try {
        const batchResponse = await fetch('http://localhost:8000/api/batches/all/', {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          totalBatches = Array.isArray(batchData) ? batchData.length : (batchData.data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching batches count:', err);
      }

      setAdminData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalStudents: statsData.total_students ?? 0,
          totalInstructors: statsData.total_instructors ?? 0,
          totalHods: statsData.total_hods ?? 0,
          totalAlumni: statsData.total_alumni ?? 0,
          totalBatches: totalBatches,
        }
      }));

      // Fetch pending transfers count
      try {
        const transfersResponse = await fetch('http://localhost:8000/api/students/pending-transfers/', {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (transfersResponse.ok) {
          const transfersData = await transfersResponse.json();
          setPendingTransfersCount(transfersData.length || 0);
        }
      } catch (err) {
        console.error('Error fetching pending transfers:', err);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
    // fetchHodRequestsData();
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'admin');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled) {
          setAdminProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch admin profile:', error);
        if (!cancelled) {
          setAdminProfile(currentUser);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const headerProfile = adminProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'Admin').trim();

  // Define styles
  const sidebarGradient = "from-indigo-600 via-purple-700 to-pink-800";
  const headerGradient = "from-indigo-600 via-purple-600 to-pink-700";
  const accentColor = "text-blue-200";
  const hoverColor = "hover:bg-white/10";

  // Render navigation tabs
  const renderTabs = () => (
    <div className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-4 space-y-2 min-h-screen shadow-xl`}>
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
          {headerImageUrl ? (
            <img src={headerImageUrl} alt="Admin" className="w-full h-full object-cover" />
          ) : (
            <svg xmlns="logo2" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-white truncate px-2">{headerName}</h3>
        <p className={`text-xs ${accentColor} uppercase tracking-widest`}>{isSAC ? 'SAC' : (headerProfile?.role || 'Admin')}</p>
      </div>

      <nav>
        <ul className="space-y-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                    : `text-white/80 ${hoverColor} hover:text-white`
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="flex-1 text-left font-semibold">{tab.label}</span>
                {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm border border-red-400">
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <button
            onClick={logout}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </nav>
    </div>
  );

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <DashboardStats 
              stats={adminData.stats} 
              onNavigate={setActiveTab}
            />
            
            {pendingTransfersCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl shadow-sm border border-amber-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-200">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-amber-900 font-bold text-lg">Pending Transfers</h3>
                    <p className="text-amber-700">{pendingTransfersCount} students are repeating and waiting for batch transfer.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('pending-transfers')}
                  className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-md shadow-amber-200"
                >
                  View Pending Transfers
                </button>
              </motion.div>
            )}

            <motion.div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <NotificationPanel />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <SystemHealthWidget />
              </motion.div>
              <motion.div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
                <QuickActions />
              </motion.div>
            </div>

            <motion.div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <ActivityFeed />
            </motion.div>

            <motion.div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20">
              <CalendarWidget />
            </motion.div>
          </motion.div>
        );

      case 'users':
        return <Users />;


      case 'program-setup':
        return <SacProgramSetup onManagePromotion={(programId, batchId) => {
          setPromotionParams({ programId, batchId });
          setActiveTab('promotion-management');
        }} />;

      case 'curriculum':
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

      case 'promotion-management':
        return promotionParams ? (
          <ManagePromotion 
            programId={promotionParams.programId} 
            batchId={promotionParams.batchId} 
            onBack={() => {
              setActiveTab('program-setup');
              setPromotionParams(null);
            }} 
          />
        ) : <Navigate to="/admin" />;

      case 'pending-transfers':
        return <PendingTransfers />;

      case 'announcements':
        return <AnnouncementModule token={token} canCreate={true} />;

      case 'retake-management':
        return <RetakeManagementPanel />;

      case 'students':
        return <StudentManagement activeTab={activeTab} />;

      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      <Toaster position="top-right" reverseOrder={false} />
      {renderTabs()}
      <div className="flex-1">
        {/* Header */}
        <header className={`bg-gradient-to-r ${headerGradient} p-6 shadow-xl border-b border-white/20`}>
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
                <h1 className="text-2xl font-bold text-white">
                  {activeTab === 'dashboard' ? (isSAC ? 'SAC Dashboard' : 'Admin Dashboard') : 
                   tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}
                </h1>
                <p className="text-indigo-100 text-sm opacity-80">
                  {activeTab === 'dashboard' ? 'College Management System' :
                   `Manage ${tabs.find(tab => tab.id === activeTab)?.label || 'System'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <TopbarProfileMenu userData={adminProfile || currentUser} />
            </div>
          </motion.div>
        </header>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularAdminDashboard;
