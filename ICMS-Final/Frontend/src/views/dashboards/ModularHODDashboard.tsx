import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
<<<<<<< HEAD
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';
import HODCoordinatorManagementModule from '../modules/HODCoordinatorManagementModule';
=======
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';
import HODCourseAllocationModule from '../modules/HODCourseAllocationModule';
import HODInstructorOnlyModule from '../modules/hod/HODInstructorOnlyModule';
import HODCoordinatorOnlyModule from '../modules/hod/HODCoordinatorOnlyModule';
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import { coordinatorService } from '../../api/coordinatorService';
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

<<<<<<< HEAD
type TabId = 'dashboard' | 'allocations' | 'timetable' | 'timetable-approvals' | 'instructors' | 'students' | 'feedback' | 'announcements';

const ModularHODDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('allocations');
=======
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
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
  const [department, setDepartment] = useState<Department | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [timetableProposals, setTimetableProposals] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authData = localStorage.getItem('auth');
  const auth = authData ? JSON.parse(authData) : {};
  const token = authData ? auth.access_token || auth.token : null;
  const canManageAnnouncements = Boolean(
    auth?.permissions?.includes('manage_announcements') ||
    auth?.user?.permissions?.includes?.('manage_announcements')
  );
  const API_BASE = 'http://localhost:8000/api/academics';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
<<<<<<< HEAD
    { id: 'allocations', label: 'Course Allocations', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'instructors', label: 'Instructors', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'timetable', label: 'Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'timetable-approvals', label: 'Timetable Approvals', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'students', label: 'Students', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'feedback', label: 'Feedback', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' }
=======
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'faculty', label: 'Faculty', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'feedback', label: 'Feedback', icon: 'M7 8h10M7 12h6m2 8l-4-4H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

<<<<<<< HEAD
=======
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
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
        setLoading(false);
      } else {
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
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
<<<<<<< HEAD

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

  const fetchTimetableProposals = async () => {
    try {
      const response = await coordinatorService.getTimetableProposals();
      setTimetableProposals(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Error fetching timetable proposals:', error);
      toast.error('Failed to load timetable proposals');
    }
  };

  const handleApproveTimetable = async (id: number) => {
    try {
      await coordinatorService.approveTimetableProposal(id, { comments: 'Approved by HOD' });
      toast.success('Timetable approved');
      fetchTimetableProposals();
    } catch (error) {
      console.error('Error approving timetable:', error);
      toast.error('Failed to approve timetable');
    }
  };

  const handleRejectTimetable = async (id: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await coordinatorService.rejectTimetableProposal(id, { reason });
      toast.success('Timetable rejected');
      fetchTimetableProposals();
    } catch (error) {
      console.error('Error rejecting timetable:', error);
      toast.error('Failed to reject timetable');
    }
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
=======
      
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

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
<<<<<<< HEAD
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
=======
        return <HODInstructorOnlyModule />;

      case 'coordinators':
        return <HODCoordinatorOnlyModule />;

      

      

>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

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
<<<<<<< HEAD
        return <AnnouncementModule token={token || ''} canCreate={canManageAnnouncements} />;

=======
        return <AnnouncementModule token={token || ''} canCreate={true} />;
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
                   tabs.find(tab => tab.id === activeTab)?.label || 'HOD Dashboard'}
                </h1>
                <p className="text-blue-100 text-sm">
                  {department?.name || 'Department Management'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
<<<<<<< HEAD
              <div className="text-right">
                <p className="text-white font-medium">Welcome back, HOD</p>
                <p className="text-blue-200 text-sm">{new Date().toLocaleDateString()}</p>
              </div>
=======
              <TopbarProfileMenu userData={hodProfile || currentUser} />
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
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
