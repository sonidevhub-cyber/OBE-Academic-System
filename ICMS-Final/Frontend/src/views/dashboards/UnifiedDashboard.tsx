import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Clock, CalendarDays, FileText, Users, 
  Settings, BookOpen, UserCheck, User 
} from 'lucide-react';

// Import Components
import RoleSwitcher from '../../components/RoleSwitcher';
import ProfileModule from '../modules/ProfileModule';
import AttendanceModule from '../modules/AttendanceModule';
import AnnouncementModule from '../modules/AnnouncementModule';
import TimetableModule from '../modules/TimetableModule';
import ResultsModule from '../modules/ResultsModule';
import AnalyticsModule from '../modules/AnalyticsModule';

type TabId = 'dashboard' | 'schedule' | 'attendance' | 'results' | 'announcements' | 'profile';

const UnifiedDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentRole, setCurrentRole] = useState<string>('');

  const token = localStorage.getItem('token') || 
    JSON.parse(localStorage.getItem('auth') || '{}')?.access_token;

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    setCurrentRole(auth?.user?.role || currentUser?.role || '');
    fetchUserProfile();
  }, [currentUser]);

  const fetchUserProfile = async () => {
    try {
      if (token) {
        const role = JSON.parse(localStorage.getItem('auth') || '{}')?.user?.role || currentUser?.role;
        console.log('Fetching profile for role:', role);
        
        let profileEndpoint = '';
        if (role === 'coordinator') {
          profileEndpoint = 'coordinators/profile/';
        } else if (role === 'instructor') {
          profileEndpoint = 'instructors/profile/';
        }
        
        if (profileEndpoint) {
          console.log('Using endpoint:', profileEndpoint);
          const response = await fetch(`http://127.0.0.1:8000/api/${profileEndpoint}`, {
            headers: {
              'Authorization': `Token ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Raw profile data received:', data);
            
            // Handle different response formats
            let profileData = data;
            if (Array.isArray(data) && data.length > 0) {
              profileData = data[0];
            }
            
            console.log('Processed profile data:', profileData);
            setUserProfile(profileData);
          } else {
            console.error('Profile fetch failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const getTabsForRole = () => {
    const baseTabs = [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    ];

    if (currentRole === 'coordinator') {
      return [
        ...baseTabs,
        { id: 'announcements', label: 'Announcements', icon: <Users size={18} /> },
      ];
    } else if (currentRole === 'instructor') {
      return [
        ...baseTabs,
        { id: 'schedule', label: 'My Classes', icon: <Clock size={18} /> },
        { id: 'attendance', label: 'Mark Attendance', icon: <CalendarDays size={18} /> },
        { id: 'results', label: 'Upload Results', icon: <FileText size={18} /> },
        { id: 'announcements', label: 'Announcements', icon: <Users size={18} /> },
      ];
    }

    return baseTabs;
  };

  const getDashboardTitle = () => {
    if (currentRole === 'coordinator') return 'Coordinator Dashboard';
    if (currentRole === 'instructor') return 'Instructor Dashboard';
    return 'Dashboard';
  };

  const getDashboardSubtitle = () => {
    if (currentRole === 'coordinator') return 'Coordination Portal';
    if (currentRole === 'instructor') return 'Teaching Portal';
    return 'Portal';
  };

  const renderTabs = () => {
    const tabs = getTabsForRole();
    
    return (
      <div className="w-64 bg-gradient-to-b from-blue-800 to-indigo-900 text-white p-4 space-y-2 min-h-screen shadow-xl">
        <div className="mb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
            {currentRole === 'coordinator' ? (
              <UserCheck className="h-10 w-10 text-indigo-700" />
            ) : (
              <User className="h-10 w-10 text-indigo-700" />
            )}
          </div>
          <h3 className="text-lg font-semibold">{userProfile?.name || currentUser?.name || 'User'}</h3>
          <p className="text-xs text-indigo-200">{userProfile?.designation || getDashboardSubtitle()}</p>
          {userProfile?.department && (
            <p className="text-xs text-indigo-300 mt-1">
              {typeof userProfile.department === 'string' ? userProfile.department : userProfile.department.name}
            </p>
          )}
        </div>

        <nav>
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-700'
                  }`}
                >
                  <span className="mr-3">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'profile' ? 'bg-indigo-700 text-white' : 'text-indigo-100 hover:bg-indigo-700'
              }`}
            >
              <Settings size={18} className="mr-3" />
              <span>Profile</span>
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
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AnalyticsModule token={token} userType={currentRole === 'coordinator' ? 'instructor' : currentRole as "student" | "admin" | "instructor" | "hod"} />;
      case 'schedule':
        return <TimetableModule token={token} />;
      case 'attendance':
        return <AttendanceModule token={token} userType={currentRole === 'coordinator' ? 'instructor' : currentRole as "student" | "instructor"} canMark={true} />;
      case 'results':
        return <ResultsModule token={token} />;
      case 'announcements':
        return <AnnouncementModule token={token} canCreate={true} />;
      case 'profile':
        return <ProfileModule profileData={userProfile} userType={currentRole === 'coordinator' ? 'instructor' : currentRole as "student" | "admin" | "principal" | "instructor" | "hod"} />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      {renderTabs()}
      <div className="flex-1">
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 shadow-xl border-b border-white/20">
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center space-x-4">
              <div 
                className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg cursor-pointer"
                onClick={() => setActiveTab('profile')}
              >
                <span className="text-lg font-semibold text-white">
                  {(userProfile?.name || currentUser?.name || 'User').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {activeTab === 'dashboard' ? getDashboardTitle() : 
                   getTabsForRole().find(tab => tab.id === activeTab)?.label || getDashboardTitle()}
                </h1>
                <p className="text-blue-100 text-sm">{getDashboardSubtitle()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <RoleSwitcher />
              {/* Manual Role Switcher for Testing */}
              <button
                onClick={() => {
                  const auth = JSON.parse(localStorage.getItem('auth') || '{}');
                  auth.user = { ...auth.user, role: 'coordinator' };
                  localStorage.setItem('auth', JSON.stringify(auth));
                  sessionStorage.setItem('auth', JSON.stringify(auth));
                  window.location.href = '/coordinator';
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Go to Coordinator
              </button>
              <div className="text-right">
                <p className="text-white font-medium">
                  Welcome back, {userProfile?.name || currentUser?.name || 'User'}
                </p>
                <p className="text-blue-200 text-sm">
                  {userProfile?.employee_id && `ID: ${userProfile.employee_id} • `}
                  {userProfile?.email && `${userProfile.email} • `}
                  {(typeof userProfile?.department === 'string' ? userProfile.department : userProfile?.department?.name) || 'Department'}
                </p>
              </div>
            </div>
          </motion.div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboard;