import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';
import HODCourseAllocationModule from '../modules/HODCourseAllocationModule';
import HODInstructorOnlyModule from '../modules/hod/HODInstructorOnlyModule';
import HODCoordinatorOnlyModule from '../modules/hod/HODCoordinatorOnlyModule';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import { FeedbackViewer } from '../../components/feedback';
import { multiRoleService } from '../../api/multiRoleService';
import { coordinatorService } from '../../api/coordinatorService';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole } from '../../utils/profileHelpers';

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

interface TimetableProposal {
  proposal_id: number;
  title: string;
  description: string;
  semester_name?: string;
  coordinator_name?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'implemented';
  submitted_at?: string | null;
  reviewed_at?: string | null;
  hod_comments?: string;
}

interface TimetablePublishAuditData {
  summary: {
    implemented_proposals: number;
    total_slots: number;
    published_slots: number;
    unpublished_slots: number;
  };
  audit: Array<{
    proposal_id: number;
    title: string;
    semester_name: string | null;
    coordinator_name: string | null;
    published_slots: number;
    total_slots: number;
  }>;
}

type TabId = 'dashboard' | 'attendance' | 'allocations' | 'allocation-pending' | 'allocation-approved' | 'allocation-rejected' | 'timetable' | 'timetable-pending' | 'timetable-approved' | 'timetable-rejected' | 'faculty' | 'instructors' | 'coordinators' | 'students' | 'feedback' | 'announcements' | 'datesheet';

const ModularHODDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [department, setDepartment] = useState<Department | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [facultyExpanded, setFacultyExpanded] = useState(false);
  const [allocationExpanded, setAllocationExpanded] = useState(false);
  const [timetableExpanded, setTimetableExpanded] = useState(false);
  const [facultyTab, setFacultyTab] = useState<'instructors' | 'coordinators'>('instructors');
  const [selectedFacultyType, setSelectedFacultyType] = useState<'instructors' | 'coordinators'>('instructors');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timetableProposals, setTimetableProposals] = useState<TimetableProposal[]>([]);
  const [timetableAudit, setTimetableAudit] = useState<TimetablePublishAuditData | null>(null);
  const [hodProfile, setHodProfile] = useState<any>(null);

  const authData = localStorage.getItem('auth');
  const token = authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;
  const API_BASE = 'http://localhost:8000/api/academics';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'faculty', label: 'Faculty', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'feedback', label: 'Feedback', icon: 'M7 8h10M7 12h6m2 8l-4-4H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },

  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'hod');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled) {
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
useEffect(() => {
  fetchStudents(selectedSemester || undefined);
}, [selectedSemester]);
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE}/hod/dashboard/`, {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartment(data.department);
        setSemesters(data.semesters);
        setCourses(data.courses);
        setInstructors(data.instructors);
      } else {
        console.warn('Dashboard API not available, using empty data');
        setDepartment(null);
        setSemesters([]);
        setCourses([]);
        setInstructors([]);
      }
      setLoading(false);
    } catch (err: any) {
      console.warn('Dashboard API error:', err.message);
      // Set fallback data
      setDepartment(null);
      setSemesters([]);
      setCourses([]);
      setInstructors([]);
      setLoading(false);
    }
  };

  const fetchStudents = async (semesterId?: number) => {
    try {
      const url = semesterId 
        ? `${API_BASE}/hod/students/?semester_id=${semesterId}`
        : `${API_BASE}/hod/students/`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };
      

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
            {/* Department Info */}
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Department: {department?.name}</h2>
              <p className="text-gray-600">Code: {department?.code}</p>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-blue-600">{semesters.length}</div>
                  <div className="text-gray-600">Semesters</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-green-600">{courses.length}</div>
                  <div className="text-gray-600">Courses</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <div className="text-2xl font-bold text-purple-600">{instructors.length}</div>
                  <div className="text-gray-600">Instructors</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('timetable')}
                  className="p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <div className="text-blue-600 font-medium">Manage Timetable</div>
                </button>
                <button
                  onClick={() => setActiveTab('students')}
                  className="p-4 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <div className="text-green-600 font-medium">View Students</div>
                </button>
                <button
                  onClick={() => setActiveTab('feedback')}
                  className="p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  <div className="text-purple-600 font-medium">Student Feedback</div>
                </button>
                <button
                  onClick={() => setActiveTab('allocations')}
                  className="p-4 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
                >
                  <div className="text-yellow-600 font-medium">Course Allocations</div>
                </button>
              </div>
            </div>
          </motion.div>
        );

      case 'instructors':
        return <HODInstructorOnlyModule />;

      case 'coordinators':
        return <HODCoordinatorOnlyModule />;

      

      



      case 'students':
        return (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-4">
                <label className="font-medium">Filter by Semester:</label>
                <select
                  value={selectedSemester || ''}
                  onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
                  className="p-2 border rounded-md"
                >
                  <option value="">All Semesters</option>
                  {semesters.map(semester => (
                    <option key={semester.semester_id} value={semester.semester_id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Students</h3>
              {students.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No students found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map(student => (
                    <div key={student.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold">{student.name}</h4>
                      <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                      <p className="text-sm text-gray-600">Email: {student.email}</p>
                      <div className="mt-3">
                        <FeedbackButton 
                          studentId={student.student_id}
                          studentName={student.name}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'feedback':
        return <FeedbackViewer />;

      case 'announcements':
        return <AnnouncementModule token={token || ''} canCreate={true} />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  function renderTabs(): React.ReactNode {
  return (
    <div className="w-64 bg-gradient-to-b from-blue-900 to-indigo-900 text-white flex flex-col p-4">

      <h2 className="text-xl font-bold mb-6">HOD Panel</h2>

      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabId)}
          className={`flex items-center px-4 py-2 rounded-lg mb-2 transition ${
            activeTab === tab.id ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
        >
          <span>{tab.label}</span>
        </button>
      ))}

      {/* Logout */}
      <div className="mt-auto pt-4 border-t border-white/20">
        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login';
          }}
          className="w-full text-red-300 hover:text-red-100"
        >
          Logout
        </button>
      </div>

    </div>
  );
}

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      {renderTabs()}
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
                <span className="text-lg font-semibold text-white">H</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {activeTab === 'dashboard' ? 'HOD Dashboard' : 
                   activeTab === 'coordinators' ? 'Coordinators' :
                   activeTab === 'instructors' ? 'Instructors' :
                   tabs.find(tab => tab.id === activeTab)?.label || 'HOD Dashboard'}
                </h1>
                <p className="text-blue-100 text-sm">
                  {department?.name || 'Department Management'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={hodProfile || currentUser} />
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

export default ModularHODDashboard;
