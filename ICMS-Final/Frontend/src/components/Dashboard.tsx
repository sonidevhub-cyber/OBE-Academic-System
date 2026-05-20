
import React, { useState } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import '../styles/responsive.css';

import { Users, BookOpen, GraduationCap, Settings, BarChart3, Bell } from 'lucide-react';

import StudentView from '../views/modules/StudentModule';
import FeedbackView from '../views/modules/FeedbackModule';
<<<<<<< HEAD

type TabId = 'students' | 'courses' | 'feedback' | 'results' | 'schedules';
=======
import AttendanceView from '../views/modules/AttendanceModule';

type TabId = 'students' | 'feedback' | 'attendance' | 'courses' | 'instructors' | 'hods' | 'results' | 'schedules';
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('students');
  const { isMobile } = useResponsive();

  const tabs: Tab[] = [
    { id: 'students', label: 'Students', icon: Users, color: 'text-blue-600' },
    { id: 'courses', label: 'Courses', icon: BookOpen, color: 'text-green-600' },
<<<<<<< HEAD
    { id: 'feedback', label: 'Feedback', icon: Bell, color: 'text-pink-600' },
=======
    { id: 'attendance', label: 'Attendance', icon: CheckCircle, color: 'text-orange-600' },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'text-pink-600' },
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
    { id: 'results', label: 'Results', icon: BarChart3, color: 'text-cyan-600' },
    { id: 'schedules', label: 'Schedules', icon: Settings, color: 'text-gray-600' },
  ];

  const renderView = () => {
    switch (activeTab) {
      case 'students':
        return <StudentView />;
<<<<<<< HEAD
      case 'courses':
        return <div className="p-8 text-center text-gray-500">Course View - Coming Soon</div>;
      case 'feedback':
        return <FeedbackView />;
=======

      case 'feedback':
        return <FeedbackView />;
      case 'attendance':
        return <AttendanceView token="" userType="instructor" />;
      case 'courses':
        return <div className="p-8 text-center text-gray-500">Course View - Coming Soon</div>;
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
      case 'results':
        return <div className="p-8 text-center text-gray-500">Results View - Coming Soon</div>;
      case 'schedules':
        return <div className="p-8 text-center text-gray-500">Schedule View - Coming Soon</div>;
      default:
        return <div className="p-8 text-center text-gray-500">Select a view from the sidebar</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={isMobile ? 'fixed top-0 left-0 right-0 bg-white shadow-lg z-10' : 'w-64 bg-white shadow-lg'}>
        {!isMobile && (
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-800">ICMS Dashboard</h1>
            <p className="text-sm text-gray-500">Core modules only</p>
          </div>
        )}

        <nav className={isMobile ? 'content-container p-2' : 'p-4 space-y-2'}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${isMobile ? 'content-item flex-col min-w-20 p-2' : 'w-full flex items-center gap-3 px-4 py-3'} rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon size={isMobile ? 16 : 20} className={activeTab === tab.id ? tab.color : 'text-gray-400'} />
                <span className={`font-medium ${isMobile ? 'text-xs mt-1' : ''}`}>{isMobile ? tab.label.split(' ')[0] : tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-auto ${isMobile ? 'pt-20' : ''}`}>
        <div className={isMobile ? 'p-4' : 'p-8'}>{renderView()}</div>
      </div>
    </div>
  );
};

export default Dashboard;

