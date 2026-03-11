import React, { useState } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import '../styles/responsive.css';
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  Building, 
  CheckCircle, 
  BookOpen, 
  UserCheck, 
  GraduationCap,
  Settings,
  BarChart3
} from 'lucide-react';

// Import Views (UI Components)
import StudentView from '../views/modules/StudentModule';
import TimetableView from '../views/modules/TimetableModule';
import FeedbackView from '../views/modules/FeedbackModule';
import DepartmentView from '../views/modules/DepartmentModule';
import AttendanceView from '../views/modules/AttendanceModule';

type TabId = 'students' | 'timetable' | 'feedback' | 'departments' | 'attendance' | 'courses' | 'instructors' | 'hods' | 'results' | 'schedules';

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
    { id: 'departments', label: 'Departments', icon: Building, color: 'text-indigo-600' },
    { id: 'courses', label: 'Courses', icon: BookOpen, color: 'text-green-600' },
    { id: 'instructors', label: 'Instructors', icon: UserCheck, color: 'text-purple-600' },
    { id: 'hods', label: 'HODs', icon: GraduationCap, color: 'text-red-600' },
    { id: 'timetable', label: 'Timetable', icon: Calendar, color: 'text-emerald-600' },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle, color: 'text-orange-600' },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare, color: 'text-pink-600' },
    { id: 'results', label: 'Results', icon: BarChart3, color: 'text-cyan-600' },
    { id: 'schedules', label: 'Schedules', icon: Settings, color: 'text-gray-600' },
  ];

  const renderView = () => {
    switch (activeTab) {
      case 'students':
        return <StudentView />;
      case 'timetable':
        return <TimetableView token="" />;
      case 'feedback':
        return <FeedbackView />;
      case 'departments':
        return <DepartmentView />;
      case 'attendance':
        return <AttendanceView token="" userType="instructor" />;
      case 'courses':
        return <div className="p-8 text-center text-gray-500">Course View - Coming Soon</div>;
      case 'instructors':
        return <div className="p-8 text-center text-gray-500">Instructor View - Coming Soon</div>;
      case 'hods':
        return <div className="p-8 text-center text-gray-500">HOD View - Coming Soon</div>;
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
      <div className={isMobile ? "fixed top-0 left-0 right-0 bg-white shadow-lg z-10" : "w-64 bg-white shadow-lg"}>
        {!isMobile && (
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-800">ICMS Dashboard</h1>
            <p className="text-sm text-gray-500">MVC Architecture</p>
          </div>
        )}
        
        <nav className={isMobile ? "content-container p-2" : "p-4 space-y-2"}>
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
        <div className={isMobile ? "p-4" : "p-8"}>
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;