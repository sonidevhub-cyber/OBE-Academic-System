import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { coordinatorService } from '../api/coordinatorService';
import CoordinatorTimetableModule from '../views/modules/CoordinatorTimetableModule';
import CoordinatorAttendanceDashboard from '../components/attendance/CoordinatorAttendanceDashboard';
import RoleSwitchButton from '../components/RoleSwitchButton';

type TabId = 'dashboard' | 'timetable' | 'attendance' | 'courses' | 'instructors' | 'proposals';
type UserRole = 'coordinator' | 'instructor';

const CoordinatorDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('coordinator');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [coordinatorProfile, setCoordinatorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserRoles();
    loadCoordinatorProfile();
  }, []);

  const loadUserRoles = async () => {
    try {
      const response = await coordinatorService.getUserRoles();
      setUserRoles(response.data.roles || []);
      setCurrentRole(response.data.current_role || 'coordinator');
    } catch (error) {
      console.error('Error loading user roles:', error);
    }
  };

  const loadCoordinatorProfile = async () => {
    try {
      const response = await coordinatorService.getDashboardOverview();
      setCoordinatorProfile(response.data.coordinator_info);
      setLoading(false);
    } catch (error) {
      console.error('Error loading coordinator profile:', error);
      setLoading(false);
    }
  };

  const switchRole = async (role: UserRole) => {
    try {
      await coordinatorService.switchRole(role);
      setCurrentRole(role);
      
      // Redirect based on role
      if (role === 'instructor') {
        window.location.href = '/instructor-dashboard';
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching role:', error);
      alert('Failed to switch role');
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'timetable', label: 'Timetable Management', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'courses', label: 'Course Allocation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'instructors', label: 'Instructors', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 616 0z' },
    { id: 'proposals', label: 'Proposals', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
  ];

  const renderRoleSwitcher = () => {
    if (!coordinatorProfile?.can_act_as_instructor) return null;

    return (
      <div className="mb-4 bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Current Role</h3>
            <p className="text-lg font-semibold text-blue-600 capitalize">{currentRole}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => switchRole('coordinator')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentRole === 'coordinator'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Coordinator
            </button>
            <button
              onClick={() => switchRole('instructor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentRole === 'instructor'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Instructor
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => (
    <div className="w-64 bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white p-4 space-y-2 min-h-screen shadow-xl">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30">
          <svg className="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Coordinator Portal</h3>
        <p className="text-xs text-blue-200">{coordinatorProfile?.name || currentUser?.name}</p>
        {coordinatorProfile?.can_act_as_instructor && (
          <span className="inline-block mt-1 px-2 py-1 bg-green-500/20 text-green-200 text-xs rounded-full">
            Dual Role
          </span>
        )}
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
                <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>
    </div>
  );

  const renderDashboard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Role Switcher */}
      {renderRoleSwitcher()}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Courses</p>
              <p className="text-2xl font-bold text-blue-600">12</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Proposals</p>
              <p className="text-2xl font-bold text-orange-600">5</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Instructors Managed</p>
              <p className="text-2xl font-bold text-green-600">8</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 616 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Approval Rate</p>
              <p className="text-2xl font-bold text-purple-600">94%</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Timetable proposal approved by HOD</p>
              <p className="text-xs text-gray-500">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Course allocation completed for CS-301</p>
              <p className="text-xs text-gray-500">4 hours ago</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'timetable':
        return <CoordinatorTimetableModule />;
      case 'attendance':
        return <CoordinatorAttendanceDashboard />;
      case 'courses':
        return (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Course Allocation</h3>
            <p className="text-gray-600">Allocate courses to instructors and manage course assignments.</p>
          </div>
        );
      case 'instructors':
        return (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Instructor Management</h3>
            <p className="text-gray-600">View and coordinate with department instructors.</p>
          </div>
        );
      case 'proposals':
        return (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Proposals</h3>
            <p className="text-gray-600">Submit and track timetable and course allocation proposals.</p>
          </div>
        );
      default:
        return renderDashboard();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#E8EFF8]">
      {renderSidebar()}
      <div className="flex-1">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 shadow-xl border-b border-white/20">
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg">
                <span className="text-lg font-semibold text-white">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Coordinator Dashboard'}
                </h1>
                <p className="text-blue-100 text-sm">
                  {coordinatorProfile?.department || 'Department Coordination'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <RoleSwitchButton targetRole="instructor" currentUserRoles={currentUser?.roles || []} />
              <div className="text-right">
                <p className="text-white font-medium">Welcome back, {coordinatorProfile?.name || currentUser?.name}</p>
                <p className="text-blue-200 text-sm">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Content */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboard;