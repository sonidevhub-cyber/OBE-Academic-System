import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';
import HODCoordinatorManagementModule from '../modules/HODCoordinatorManagementModule';
import GAReport from '../../pages/GAReport';
import PEOReport from '../../pages/PEOReport';
import StudentOBEList from '../../pages/StudentOBEList';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import { Toaster } from 'react-hot-toast';
import { coordinatorService } from '../../api/coordinatorService';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole } from '../../utils/profileHelpers';
import { toast } from 'react-hot-toast';

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

type TabId = 'dashboard' | 'allocations' | 'timetable' | 'timetable-approvals' | 'instructors' | 'students' | 'feedback' | 'announcements' | 'ga-report' | 'peo-report' | 'student-obe';

const ModularHODDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('allocations');
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

  const authData = localStorage.getItem('auth');
  const auth = authData ? JSON.parse(authData) : {};
  const currentUser = auth.user;
  const token = authData ? auth.access_token || auth.token : null;
  const canManageAnnouncements = Boolean(
    auth?.permissions?.includes('manage_announcements') ||
    auth?.user?.permissions?.includes?.('manage_announcements')
  );
  const API_BASE = 'http://localhost:8000/api/academics';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'allocations', label: 'Course Allocations', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'instructors', label: 'Instructors', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'timetable', label: 'Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'timetable-approvals', label: 'Timetable Approvals', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'students', label: 'Students', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'ga-report', label: 'GA Report', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'peo-report', label: 'PEO Report', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { id: 'student-obe', label: 'Student OBE', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'feedback', label: 'Feedback', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' }
  ];

  useEffect(() => {
    // Use mock data since APIs don't exist yet
    loadMockData();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const role = getEffectiveRole(currentUser, 'hod');
      const response = await fetchCurrentProfile(role);
      if (response.data && (response.data.email || response.data.full_name)) {
        setHodProfile(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch HOD profile:', error);
      setHodProfile(currentUser);
    }
  };

  const loadMockData = () => {
    // Mock data for HOD dashboard
    setDepartment({ id: 1, name: 'Computer Science', code: 'CS' });
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

  const fetchStudents = (semesterId?: number) => {
    // Use mock data, filter by semester if needed
    const mockStudents = [
      { id: 1, name: 'Ali Khan', student_id: '2021-CS-001', email: 'ali@example.com' },
      { id: 2, name: 'Hina Farooq', student_id: '2021-CS-002', email: 'hina@example.com' },
      { id: 3, name: 'Usman Tariq', student_id: '2021-CS-003', email: 'usman@example.com' },
      { id: 4, name: 'Sara Ahmed', student_id: '2022-CS-001', email: 'sara@example.com' }
    ];
    if (semesterId) {
      setStudents(mockStudents.filter((_, i) => i % 2 === 0));
    } else {
      setStudents(mockStudents);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    window.location.href = '/login';
  };

  useEffect(() => {
    if (activeTab === 'students' || activeTab === 'feedback') {
      fetchStudents(selectedSemester || undefined);
    }
    if (activeTab === 'timetable-approvals') {
      fetchTimetableProposals();
    }
  }, [activeTab, selectedSemester]);

  const fetchTimetableProposals = () => {
    // Use mock data
    setTimetableProposals([
      { id: 1, batch_name: 'Batch 2021-2025', coordinator_name: 'Mr. Coordinator', status: 'proposed' },
      { id: 2, batch_name: 'Batch 2022-2026', coordinator_name: 'Ms. Coordinator', status: 'approved' }
    ]);
  };

  const handleApproveTimetable = (id: number) => {
    // Mock approve function
    setTimetableProposals(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'approved' } : p
    ));
    toast.success('Timetable approved');
  };

  const handleRejectTimetable = (id: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    // Mock reject function
    setTimetableProposals(prev => prev.map(p => 
      p.id === id ? { ...p, status: 'rejected' } : p
    ));
    toast.success('Timetable rejected');
  };

  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white p-4 min-h-screen shadow-xl flex flex-col">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">HOD Portal</h3>
        <p className="text-xs text-blue-200">{department?.name || 'Department'}</p>
      </div>

      <nav className="flex-1">
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
      </nav>
      
      <div className="mt-auto pt-4 border-t border-white/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 rounded-lg text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
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
        return <HODCoordinatorManagementModule />;
      case 'timetable':
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
          </div>
        );

      case 'timetable-approvals':
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">Timetable Approvals</h3>
              <p className="text-gray-600 mb-4">
                Review and approve timetable proposals from coordinators.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Batch</th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Coordinator</th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                      <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {timetableProposals.map((proposal) => (
                      <tr key={proposal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">{proposal.batch_name}</td>
                        <td className="px-6 py-4">{proposal.coordinator_name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            proposal.status === 'approved' ? 'bg-green-100 text-green-800' :
                            proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {proposal.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {proposal.status === 'proposed' && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleApproveTimetable(proposal.id)}
                                className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectTimetable(proposal.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {timetableProposals.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No pending timetable proposals
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

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

      case 'ga-report':
        return <GAReport />;

      case 'peo-report':
        return <PEOReport />;

      case 'student-obe':
        return <StudentOBEList />;

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

      case 'announcements':
        return <AnnouncementModule token={token || ''} canCreate={canManageAnnouncements} />;

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
              <div className="text-right">
                <p className="text-white font-medium">Welcome back, HOD</p>
                <p className="text-blue-200 text-sm">{new Date().toLocaleDateString()}</p>
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

export default ModularHODDashboard;
