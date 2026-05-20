import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  BookOpen,
  GraduationCap,
  Megaphone,
  Bell,
  CalendarDays,
} from 'lucide-react';

import AnnouncementModule from '../modules/AnnouncementModule';
import ResultsModule from '../modules/ResultsModule';
import ProfileModule from '../modules/ProfileModule';
import AnalyticsModule from '../modules/AnalyticsModule';

type TabId = 'dashboard' | 'results' | 'announcements' | 'profile';

const UnifiedDashboard: React.FC = () => {
  const { currentUser, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // For now, keep profile minimal; remove attendance/timetable/datesheet dependencies.
    setUserProfile(null);
  }, [currentUser]);

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'results' as const, label: 'Results', icon: <GraduationCap size={18} /> },
    { id: 'announcements' as const, label: 'Announcements', icon: <Bell size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AnalyticsModule token="" userType={'student'} />;
      case 'results':
        return <ResultsModule token="" />;
      case 'announcements':
        return <AnnouncementModule token="" canCreate={hasPermission('manage_announcements')} />;
      case 'profile':
        return <ProfileModule profileData={userProfile} userType={'student'} />;
      default:
        return <div />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      <div className="w-64 bg-gradient-to-b from-blue-800 to-indigo-900 text-white p-4 space-y-2 min-h-screen shadow-xl">
        <div className="mb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-indigo-700" />
          </div>
          <h3 className="text-lg font-semibold">{userProfile?.name || currentUser?.name || 'User'}</h3>
          <p className="text-xs text-indigo-200">Portal</p>
        </div>

        <nav>
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
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
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1">
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 shadow-xl border-b border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-blue-100 text-sm">Core modules only (attendance/timetable/datesheet removed)</p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">Welcome back, {currentUser?.name || 'User'}</p>
            </div>
          </div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboard;

