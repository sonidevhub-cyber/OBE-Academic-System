import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TimetableManagement from '../../components/TimetableManagement';
import AnnouncementModule from '../modules/AnnouncementModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import FeedbackButton from '../forms/FeedbackButton';
import HODCoordinatorManagementModule from '../modules/hod/HODCoordinatorManagementModule';
import HODCourseAllocationModule from '../modules/HODCourseAllocationModule';
import HODInstructorManagementModule from '../modules/hod/HODInstructorManagementModule';
import HODInstructorOnlyModule from '../modules/hod/HODInstructorOnlyModule';
import HODCoordinatorOnlyModule from '../modules/hod/HODCoordinatorOnlyModule';
import HODAttendanceDashboard from '../../components/attendance/HODAttendanceDashboard';
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

type TabId = 'dashboard' | 'attendance' | 'allocations' | 'allocation-pending' | 'allocation-approved' | 'allocation-rejected' | 'timetable' | 'timetable-pending' | 'timetable-approved' | 'timetable-rejected' | 'faculty' | 'instructors' | 'coordinators' | 'students' | 'feedback' | 'announcements';

const ModularHODDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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
    { id: 'allocations', label: 'Course Allocations', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'timetable', label: 'Timetable', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'faculty', label: 'Faculty', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'students', label: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 016 0z' },
    { id: 'feedback', label: 'Feedback', icon: 'M7 8h10M7 12h6m2 8l-4-4H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { id: 'announcements', label: 'Announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' }
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchTimetableProposals();
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

  const fetchTimetableProposals = async () => {
    try {
      const response = await coordinatorService.getTimetableProposals();
      setTimetableProposals(response.data || []);
    } catch (err) {
      console.error('Error fetching timetable proposals:', err);
      setTimetableProposals([]);
    }
  };

  const fetchTimetableAudit = async () => {
    try {
      const response = await coordinatorService.getTimetablePublishAudit();
      setTimetableAudit(response.data || null);
    } catch (err) {
      console.error('Error fetching timetable publish audit:', err);
      setTimetableAudit(null);
    }
  };

  const handleTimetableDecision = async (
    proposalId: number,
    action: 'approve' | 'reject',
    comments: string = ''
  ) => {
    try {
      if (action === 'approve') {
        await coordinatorService.approveTimetableProposal(proposalId, { comments });
      } else {
        await coordinatorService.rejectTimetableProposal(proposalId, { comments });
      }

      const now = new Date().toISOString();
      setTimetableProposals((prev) =>
        prev.map((proposal) =>
          proposal.proposal_id === proposalId
            ? {
                ...proposal,
                status: action === 'approve' ? 'implemented' : 'rejected',
                reviewed_at: now,
                hod_comments: comments
              }
            : proposal
        )
      );
      await fetchTimetableProposals();
      await fetchTimetableAudit();
    } catch (err: any) {
      console.error(`Failed to ${action} timetable proposal:`, err);
      alert(err?.response?.data?.error || `Failed to ${action} timetable proposal`);
      await fetchTimetableProposals();
    }
  };

  const renderTimetableProposals = (mode: 'pending' | 'approved' | 'rejected') => {
    const proposals = timetableProposals.filter((p) => {
      if (mode === 'pending') return p.status === 'submitted' || p.status === 'draft';
      if (mode === 'approved') return p.status === 'approved' || p.status === 'implemented';
      return p.status === 'rejected';
    });

    const titleMap = {
      pending: 'Pending Timetables',
      approved: 'Approved Timetables',
      rejected: 'Rejected Timetables'
    };

    return (
      <div className="space-y-6">
        {mode === 'approved' && timetableAudit?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <p className="text-xs text-gray-500">Implemented Proposals</p>
              <p className="text-xl font-semibold text-blue-700">{timetableAudit.summary.implemented_proposals}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <p className="text-xs text-gray-500">Total Slots</p>
              <p className="text-xl font-semibold text-gray-900">{timetableAudit.summary.total_slots}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <p className="text-xs text-gray-500">Published Slots</p>
              <p className="text-xl font-semibold text-green-700">{timetableAudit.summary.published_slots}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <p className="text-xs text-gray-500">Unpublished Slots</p>
              <p className="text-xl font-semibold text-red-700">{timetableAudit.summary.unpublished_slots}</p>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4">{titleMap[mode]}</h3>
          {proposals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No {mode} timetable proposals found.</div>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div key={proposal.proposal_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{proposal.title}</h4>
                      <p className="text-sm text-gray-600">{proposal.description || 'No description'}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Semester: {proposal.semester_name || 'N/A'} | Coordinator: {proposal.coordinator_name || 'N/A'}
                      </p>
                      {proposal.hod_comments && (
                        <p className="text-sm text-blue-700 mt-2">HOD Comments: {proposal.hod_comments}</p>
                      )}
                      {mode === 'approved' && timetableAudit?.audit && (
                        <p className="text-sm text-gray-600 mt-2">
                          Published Slots:{' '}
                          {timetableAudit.audit.find((a) => a.proposal_id === proposal.proposal_id)?.published_slots || 0}
                          {' / '}
                          {timetableAudit.audit.find((a) => a.proposal_id === proposal.proposal_id)?.total_slots || 0}
                        </p>
                      )}
                    </div>

                    {mode === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTimetableDecision(proposal.proposal_id, 'approve')}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Enter rejection reason for coordinator:') || '';
                            if (!reason.trim()) return;
                            handleTimetableDecision(proposal.proposal_id, 'reject', reason.trim());
                          }}
                          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (activeTab === 'students' || activeTab === 'feedback') {
      fetchStudents(selectedSemester || undefined);
    }
  }, [activeTab, selectedSemester]);

  useEffect(() => {
    if (
      activeTab === 'timetable-pending' ||
      activeTab === 'timetable-approved' ||
      activeTab === 'timetable-rejected'
    ) {
      fetchTimetableProposals();
      fetchTimetableAudit();

      const intervalId = window.setInterval(() => {
        fetchTimetableProposals();
        fetchTimetableAudit();
      }, 10000);

      return () => window.clearInterval(intervalId);
    }
  }, [activeTab]);

  const renderTabs = () => (
    <div className="w-64 bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white p-4 space-y-2 min-h-screen shadow-xl">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">HOD Portal</h3>
        <p className="text-xs text-blue-200">{department?.name || 'Department'}</p>
      </div>

      <nav>
        <ul className="space-y-1">
          {tabs.filter(tab => tab.id !== 'allocations' && tab.id !== 'timetable' && tab.id !== 'faculty').map((tab) => (
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
          
          {/* Faculty Section with Dropdown */}
          <li>
            <button
              onClick={() => setFacultyExpanded(!facultyExpanded)}
              className="w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Faculty</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-auto transition-transform ${facultyExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {facultyExpanded && (
              <ul className="ml-8 mt-1 space-y-1">
                <li>
                  <button
                    onClick={() => setActiveTab('instructors')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'instructors'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Instructors
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('coordinators')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'coordinators'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Coordinators
                  </button>
                </li>
              </ul>
            )}
          </li>
          
          {/* Course Allocations Section */}
          <li>
            <button
              onClick={() => setAllocationExpanded(!allocationExpanded)}
              className="w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Course Allocations</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-auto transition-transform ${allocationExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {allocationExpanded && (
              <ul className="ml-8 mt-1 space-y-1">
                <li>
                  <button
                    onClick={() => setActiveTab('allocation-pending')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'allocation-pending'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Pending Allocations
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('allocation-approved')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'allocation-approved'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Approved Allocations
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('allocation-rejected')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'allocation-rejected'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Rejected Allocations
                  </button>
                </li>
              </ul>
            )}
          </li>

          {/* Timetable Section */}
          <li>
            <button
              onClick={() => setTimetableExpanded(!timetableExpanded)}
              className="w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Timetable</span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-auto transition-transform ${timetableExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {timetableExpanded && (
              <ul className="ml-8 mt-1 space-y-1">
                <li>
                  <button
                    onClick={() => setActiveTab('timetable-pending')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'timetable-pending'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Pending Timetables
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('timetable-approved')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'timetable-approved'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Approved Timetables
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('timetable-rejected')}
                    className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === 'timetable-rejected'
                        ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Rejected Timetables
                  </button>
                </li>
              </ul>
            )}
          </li>

        </ul>
      </nav>
      
      {/* Logout Button */}
      <div className="mt-auto pt-4 border-t border-white/20">
        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login';
          }}
          className="w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 text-red-200 hover:bg-red-500/20 hover:text-red-100"
        >
          <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      case 'attendance':
        return <HODAttendanceDashboard />;

      case 'instructors':
        return <HODInstructorOnlyModule />;

      case 'coordinators':
        return <HODCoordinatorOnlyModule />;

      case 'allocations':
        return <HODCourseAllocationModule view="all" />;

      case 'allocation-pending':
        return <HODCourseAllocationModule view="pending" />;

      case 'allocation-approved':
        return <HODCourseAllocationModule view="approved" />;

      case 'allocation-rejected':
        return <HODCourseAllocationModule view="rejected" />;

      case 'timetable-pending':
        return renderTimetableProposals('pending');

      case 'timetable-approved':
        return renderTimetableProposals('approved');

      case 'timetable-rejected':
        return renderTimetableProposals('rejected');



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
              <TopbarProfileMenu userData={hodProfile || currentUser} label="HOD" />
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
