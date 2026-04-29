import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import TopbarProfileMenu from '../components/TopbarProfileMenu';

// Import Modular Components
import DashboardStats from '../views/modules/DashboardStats';
import HODManagementModule from '../views/modules/HODManagementModule';
import AnnouncementModule from '../views/modules/AnnouncementModule';
import PrincipalManagement from '../views/pages/PrincipalManagement';
// Import Existing Page Components
import StudentManagement from '../views/pages/StudentManagement';
import DepartmentManagement from '../views/pages/DepartmentManagement';
import TeacherManagement from '../views/pages/TeacherManagement';
import AdminManagement from '../views/pages/AdminManagement';
import { fetchCurrentProfile } from '../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../utils/profileHelpers';
// Import Dashboard Widgets
import SystemHealthWidget from '../components/widgets/dashboard/SystemHealthWidget';
import NotificationPanel from '../components/widgets/dashboard/NotificationPanel';
import QuickActions from '../components/widgets/dashboard/QuickActions';
import ActivityFeed from '../components/widgets/dashboard/ActivityFeed';
import CalendarWidget from '../components/widgets/dashboard/CalendarWidget';

type TabId = 'dashboard' | 'students' | 'instructors' | 'departments' | 'courses' | 'events' | 'announcements' | 'hod' | 'admin-management' | 'principal';
type AdminTab = { id: TabId; label: string; icon: string; permission?: string };

const ModularAdminDashboard = () => {
  const { currentUser, logout, hasPermission, isSAC } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [adminData, setAdminData] = useState({
    stats: {
      totalStudents: 0,
      totalInstructors: 0,
      totalHods: 0,
      totalAdmins: 0,
    },
  });
  const [adminProfile, setAdminProfile] = useState<any>(null);

  // Get auth token
  const authData = localStorage.getItem('auth');
  const token = authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;

  // Navigation tabs
  const tabs = useMemo(() => ([
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', permission: 'manage_students' },
    { id: 'instructors', label: 'Instructors', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', permission: 'manage_instructors' },
    { id: 'hod', label: 'HOD', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', permission: 'manage_hods' },
    { id: 'admin-management', label: 'Admin', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', permission: 'manage_jsc_users' },
    { id: 'principal', label: 'Principal', icon: 'M5 3v4h14V3H5zm0 7h14v11H5V10zm7 4a2 2 0 110-4 2 2 0 010 4z', permission: 'manage_principals' },
    { id: 'departments', label: 'Academia Units', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', permission: 'manage_departments' },
    { id: 'announcements', label: 'Announcements', icon: 'M3 10v4a1 1 0 001 1h3l4 3V6l-4 3H4a1 1 0 00-1 1z', permission: 'manage_announcements' },
  ] as AdminTab[]).filter((tab) => !tab.permission || isSAC || hasPermission(tab.permission)), [hasPermission, isSAC]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    const scopedPermissions = [
      'manage_students',
      'manage_instructors',
      'manage_hods',
      'manage_jsc_users',
      'manage_results',
      'manage_attendance',
      'manage_announcements',
    ];
    const hasDepartmentOnlyScope =
      hasPermission('manage_departments') &&
      !scopedPermissions.some((code) => hasPermission(code));

    if (hasDepartmentOnlyScope && activeTab === 'dashboard') {
      setActiveTab('departments');
    }
  }, [activeTab, hasPermission]);

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

      const statsResponse = await response.json();
      const statsData = statsResponse.data || {};

      setAdminData(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalStudents: statsData.total_students ?? 0,
          totalInstructors: statsData.total_instructors ?? 0,
          totalAdmins: statsData.total_admins ?? 0,
          totalHods: statsData.total_hods ?? 0,
        }
      }));
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
  const headerName = (headerProfile?.name || headerProfile?.username || 'Admin').trim();

  // Render navigation tabs
  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-indigo-600 via-purple-700 to-pink-800 text-white p-4 space-y-2 min-h-screen shadow-xl">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30">
          <svg xmlns="logo2" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">FGPG Admin</h3>
        <p className="text-xs text-blue-200">Collage Management</p>
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
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
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

      case 'hod':
        return <HODManagementModule token={token} />;

      case 'principal':
        return <PrincipalManagement />;

      case 'announcements':
        return <AnnouncementModule token={token} canCreate={true} />;

      case 'students':
        return <StudentManagement activeTab={activeTab} />;

      case 'instructors':
        return <Instructor Management activeTab={activeTab} />;

      case 'departments':
        return <DepartmentManagement activeTab={activeTab} />;

      case 'admin-management':
        return <AdminManagement activeTab={activeTab} />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      {renderTabs()}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-700 p-6 shadow-xl border-b border-white/20">
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
                  {activeTab === 'dashboard' ? 'Admin Dashboard' : 
                   tabs.find(tab => tab.id === activeTab)?.label || 'Admin Dashboard'}
                </h1>
                <p className="text-gray-600 text-sm">
                  {activeTab === 'dashboard' ? 'Collage Management System' :
                   `Manage ${tabs.find(tab => tab.id === activeTab)?.label || 'System'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <TopbarProfileMenu userData={adminProfile || currentUser} label="Admin" />
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
