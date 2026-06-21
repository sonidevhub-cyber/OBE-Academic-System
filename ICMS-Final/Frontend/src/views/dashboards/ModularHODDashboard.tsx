import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';

import GAReport from '../../pages/GAReport';
import CoordinatorGAReportModule from '../modules/coordinator/CoordinatorGAReportModule';
import CoordinatorCLOReportModule from '../modules/coordinator/CoordinatorCLOReportModule';
import PEOReport from '../../pages/PEOReport';
import StudentOBEList from '../../pages/StudentOBEList';
import HODCQI from '../pages/HODCQI';
import HODNotice from '../pages/HODNotice';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import { Toaster } from 'react-hot-toast';
import { coordinatorService } from '../../api/coordinatorService';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard,
  ClipboardCheck,
  Bell,
  MessageSquare,
  User,
  LogOut,
  FileBarChart,
  Users,
  BookOpen
} from 'lucide-react';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Semester {
  semester_id: number;
  name: string;
  semester_code: string;
}

interface Course {
  course_id: number;
  name: string;
  code: string;
  credits: number;
  semester: number;
}

interface Instructor {
  id: number;
  name: string;
  employee_id: string;
  specialization: string;
  designation?: string;
}

interface Student {
  id: number;
  name: string;
  student_id: string;
  email: string;
}

type TabId = "dashboard" | "cqi" | "ga-report" | "clo-report" | "peo-report" | "student-obe" | "notice" | "feedback";

const ModularHODDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [department, setDepartment] = useState<Department | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [timetableProposals, setTimetableProposals] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hodProfile, setHodProfile] = useState<any>(null);
  const canManageAnnouncements = Boolean(
    currentUser?.permissions?.includes('manage_announcements')
  );
  const API_BASE = 'http://localhost:8000/api/academics';
  const authData = localStorage.getItem('auth');
  const auth = authData ? JSON.parse(authData) : {};
  const token = authData ? auth.access_token || auth.token : null;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "cqi", label: "CLO CQI Control", icon: ClipboardCheck },
    { id: "clo-report", label: "CLO Reports", icon: BookOpen },
    { id: "ga-report", label: "GA Reports", icon: FileBarChart },
    { id: "peo-report", label: "PEO Reports", icon: FileBarChart },
    { id: "student-obe", label: "Student OBE", icon: Users },
    { id: "notice", label: "Notice Board", icon: Bell },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
  ];

  useEffect(() => {
    loadMockData();
  }, []);
  
  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'hod');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        console.log('=== Full Profile Response ===', response);
        console.log('=== Response Data ===', response.data);
        
        if (response.data) {
          console.log('=== ALL DATA FIELDS AND VALUES ===');
          for (const key in response.data) {
            console.log(`- ${key}:`, response.data[key]);
          }
          
          // Also check currentUser in case profile didn't load
          console.log('=== CURRENT USER FROM AUTH CONTEXT ===');
          for (const key in currentUser) {
            console.log(`- ${key}:`, currentUser[key]);
          }
        }
        
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setHodProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch HOD profile:', error);
        if (!cancelled) {
          setHodProfile(currentUser);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const headerProfile = hodProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'HOD').trim();

  const loadMockData = () => {
    setDepartment({ id: 1, name: 'CS (Computer Science)', code: 'CS' });
    setSemesters([
      { semester_id: 1, name: 'Semester 1', semester_code: 'SEM1' },
      { semester_id: 2, name: 'Semester 2', semester_code: 'SEM2' },
      { semester_id: 3, name: 'Semester 3', semester_code: 'SEM3' },
      { semester_id: 4, name: 'Semester 4', semester_code: 'SEM4' }
    ]);
    setCourses([
      { course_id: 1, name: 'Programming Fundamentals', code: 'CS101', credits: 3, semester: 1 },
      { course_id: 2, name: 'Data Structures', code: 'CS201', credits: 3, semester: 2 }
    ]);
    setInstructors([
      { id: 1, name: 'Dr. John Smith', employee_id: 'INS001', specialization: 'Software Engineering', designation: 'Professor' },
      { id: 2, name: 'Prof. Sarah Ahmed', employee_id: 'INS002', specialization: 'Data Science', designation: 'Associate Professor' }
    ]);
    setStudents([
      { id: 1, name: 'Ali Khan', student_id: '2021-CS-001', email: 'ali@example.com' },
      { id: 2, name: 'Hina Farooq', student_id: '2021-CS-002', email: 'hina@example.com' },
      { id: 3, name: 'Usman Tariq', student_id: '2021-CS-003', email: 'usman@example.com' }
    ]);
    setTimetableProposals([
      { id: 1, batch_name: 'Batch 2021-2025', coordinator_name: 'Mr. Coordinator', status: 'proposed' }
    ]);
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
  };

  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-indigo-800 to-purple-900 text-white p-4 min-h-screen shadow-xl flex flex-col">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
          {headerImageUrl ? (
            <img src={headerImageUrl} alt={headerName} className="w-full h-full object-cover" />
          ) : (
            <User className="h-10 w-10" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-white truncate px-2">{headerName}</h3>
        <p className="text-xs text-purple-200 uppercase tracking-widest">HOD</p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="mt-auto pt-4 border-t border-white/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 rounded-lg text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) return <div className="p-4">Loading HOD Dashboard...</div>;
    if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

    switch (activeTab) {
      case 'dashboard':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="bg-indigo-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Department: {department?.name}</h2>
              <p className="text-gray-600">Code: {department?.code}</p>
            </div>
          </motion.div>
        );

      case 'cqi':
        return <HODCQI />;

      case 'clo-report':
        return <CoordinatorCLOReportModule />;

      case 'ga-report':
        return <CoordinatorGAReportModule />;

      case 'peo-report':
        return <PEOReport />;

      case 'student-obe':
        return <StudentOBEList />;

      case 'notice':
        return <HODNotice />;

      case 'feedback':
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Feedback Management</h3>
              <p className="text-gray-600 mb-4">
                View feedback from students and give feedback to students.
              </p>
            </div>
            <SimpleFeedbackModule 
              token={token || ''} 
              userType="hod"
            />
          </div>
        );

      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      <Toaster position="top-right" reverseOrder={false} />
      {renderTabs()}
      <div className="flex-1">
        <header className="bg-gradient-to-r from-indigo-700 to-purple-700 p-6 shadow-xl border-b border-white/20">
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
                <p className="text-purple-100 text-sm opacity-80">
                  HOD Management Portal
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={headerProfile} />
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

export default ModularHODDashboard;
