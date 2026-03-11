import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { multiRoleService } from '../../api/multiRoleService';

// Import Modular Components
import DashboardStats from '../modules/DashboardStats';
import HODManagementModule from '../modules/HODManagementModule';
import TimetableModule from '../modules/TimetableModule';
import AnnouncementModule from '../modules/AnnouncementModule';
import ResultsModule from '../modules/ResultsModule';

// Import Existing Page Components
import StudentManagement from '../pages/StudentManagement';
import DepartmentManagement from '../pages/DepartmentManagement';
import CourseManagement from '../pages/CourseManagement';
import TeacherManagement from '../pages/TeacherManagement';
import EventManagement from '../pages/EventManagement';
import AdminAttendanceManagement from '../../components/attendance/AdminAttendanceManagement';
import AdminManagement from '../pages/AdminManagement';

// Import Dashboard Widgets
import SystemHealthWidget from '../widgets/SystemHealthWidget';
import NotificationPanel from '../widgets/NotificationPanel';
import QuickActions from '../widgets/QuickActions';
import ActivityFeed from '../widgets/ActivityFeed';
import CalendarWidget from '../widgets/CalendarWidget';

type TabId = 'dashboard' | 'students' | 'instructors' | 'departments' | 'courses' | 'results' | 'attendance' | 'events' | 'announcements' | 'hod' | 'admin-management';
type AdminTab = { id: TabId; label: string; icon: string; permission?: string };

const ModularAdminDashboard = () => {
  const { currentUser, logout, hasPermission, isSAC } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [adminData, setAdminData] = useState({
    stats: {
      totalUsers: 1200,
      activeUsers: 850,
      totalDepartments: 25,
      totalCourses: 40,
      totalStudents: 1000,
      totalStaff: 200,
    },
  });
  const [hodRequests, setHodRequests] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  // Get auth token
  const authData = localStorage.getItem('auth');
  const token = authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;

  // Navigation tabs
  const tabs = useMemo(() => ([
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z', permission: 'manage_students' },
    { id: 'instructors', label: 'Instructors', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', permission: 'manage_instructors' },
    { id: 'hod', label: 'HOD', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', permission: 'manage_hods' },
    { id: 'admin-management', label: 'Admin', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', permission: 'manage_jsc_users' },
    { id: 'departments', label: 'Departments', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', permission: 'manage_departments' },
    { id: 'results', label: 'Results', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permission: 'manage_results' },
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', permission: 'manage_attendance' },
    { id: 'announcements', label: 'Announcements', icon: 'M3 10v4a1 1 0 001 1h3l4 3V6l-4 3H4a1 1 0 00-1 1z', permission: 'manage_announcements' },
    { id: 'events', label: 'Events', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', permission: 'manage_events' },
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
      'manage_events',
    ];
    const hasDepartmentOnlyScope =
      hasPermission('manage_departments') &&
      !scopedPermissions.some((code) => hasPermission(code));

    if (hasDepartmentOnlyScope && activeTab === 'dashboard') {
      setActiveTab('departments');
    }
  }, [activeTab, hasPermission]);

  // HOD Request Action Handler
  const handleHodRequestAction = async (requestId: number, action: string) => {
    const reason = action === 'reject' ? prompt('Rejection reason (optional):') : undefined;
    try {
      const response = await fetch(`http://localhost:8000/api/hods/admin/requests/${requestId}/action/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, reason })
      });
      if (response.ok) {
        fetchHodRequestsData();
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
    }
  };

  // Fetch HOD requests data
  const fetchHodRequestsData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/hods/admin/requests/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setHodRequests(data.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching HOD requests:', error);
    }
  };

  useEffect(() => {
    // Commented out - endpoint /api/hods/admin/requests/ does not exist
    // fetchHodRequestsData();
  }, [token]);

  // Render navigation tabs
  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-indigo-600 via-purple-700 to-pink-800 text-white p-4 space-y-2 min-h-screen shadow-xl">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">FGPG Admin</h3>
        <p className="text-xs text-blue-200">University Management</p>
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
        <div className="mt-8 space-y-2">
          <div className="text-xs text-blue-200 mb-2 px-2">Role Management</div>
          <button
            onClick={async () => {
              try {
                await multiRoleService.enableInstructorRole();
                await multiRoleService.switchRole('hod');
                navigate('/hod-dashboard');
              } catch (error) {
                console.error('Error switching to HOD:', error);
                navigate('/hod-dashboard');
              }
            }}
            className="w-full flex items-center px-3 py-2 rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Enable HOD Multi-Role</span>
          </button>
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
              hodRequests={hodRequests}
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
        return <HODManagementModule token={token} onRequestAction={handleHodRequestAction} />;

      case 'results':
        return <ResultsModule token={token} />;

      case 'announcements':
        return <AnnouncementModule token={token} canCreate={true} />;

      case 'students':
        return <StudentManagement activeTab={activeTab} />;

      case 'instructors':
        return <TeacherManagement activeTab={activeTab} />;

      case 'departments':
        return <DepartmentManagement activeTab={activeTab} />;

      case 'attendance':
        return <AdminAttendanceManagement />;

      case 'admin-management':
        return <AdminManagement activeTab={activeTab} />;

      case 'events':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-lg border border-gray-100"
          >
            <EventManagement />
          </motion.div>
        );

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
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg">
                <span className="text-lg font-semibold text-white">
                  {(currentUser?.name || 'Admin').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {activeTab === 'dashboard' ? 'Admin Dashboard' : 
                   tabs.find(tab => tab.id === activeTab)?.label || 'Admin Dashboard'}
                </h1>
                <p className="text-purple-100 text-sm">
                  {activeTab === 'dashboard' ? 'University Management System' :
                   `Manage ${tabs.find(tab => tab.id === activeTab)?.label || 'System'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-white font-medium">Welcome back, {currentUser?.name || 'Admin'}</p>
                <p className="text-purple-200 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
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
