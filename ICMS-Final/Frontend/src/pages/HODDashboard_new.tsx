import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { instructorService } from '../api/studentInstructorService';
import { coordinatorService } from '../api/coordinatorService';
import TimetableManagement from '../components/TimetableManagement';
import { FeedbackViewer, NotificationBell, NotificationToast } from '../components/feedback';
import { useNotifications } from '../hooks/useNotifications';
import { useAllocations } from '../context/AllocationContext';

type TabId = 'dashboard' | 'instructors' | 'coordinators' | 'allocations' | 'allocation-list' | 'feedback';
type AllocationTab = 'pending' | 'approved' | 'rejected' | 'all';

const HODDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { newNotification, clearNewNotification } = useNotifications();
  const { allocations, updateAllocation, getProposedAllocations, getApprovedAllocations, getAllocationsBySemester } = useAllocations();
  const [activeTab, setActiveTab] = useState<TabId>('allocations');
  const [allocationTab, setAllocationTab] = useState<AllocationTab>('pending');
  const [isAllocationMenuOpen, setIsAllocationMenuOpen] = useState(true);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalInstructors: 0, presentToday: 0, classesToday: 0 });
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [hodProfile, setHodProfile] = useState<any>(null);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [inactiveCoordinators, setInactiveCoordinators] = useState<any[]>([]);
  const [pendingTimetables, setPendingTimetables] = useState<any[]>([]);

  useEffect(() => {
    loadHODProfileAndData();
  }, []);

  const loadHODProfileAndData = async () => {
    try {
      await loadHODProfile();
      await loadInstructors();
      await loadCoordinators();
      await loadPendingTimetables();
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const response = await instructorService.getAllInstructors();
      let instructorsData = Array.isArray(response.data) ? response.data : [];
      let filteredInstructors = instructorsData;
      if (hodProfile?.department?.id) {
        filteredInstructors = instructorsData.filter((instructor: any) => 
          instructor.department === hodProfile.department.id || 
          instructor.department_id === hodProfile.department.id
        );
      }
      setInstructors(filteredInstructors);
      setStats(prev => ({ ...prev, totalInstructors: filteredInstructors.length }));
    } catch (error) {
      console.error('Error loading instructors:', error);
      setInstructors([]);
      setStats(prev => ({ ...prev, totalInstructors: 0 }));
    } finally {
      setLoading(false);
    }
  };

  const loadCoordinators = async () => {
    try {
      const response = await coordinatorService.getCoordinators();
      let coordinatorsData = Array.isArray(response.data) ? response.data : [];
      setCoordinators(coordinatorsData);
    } catch (error) {
      console.error('Error loading coordinators:', error);
      setCoordinators([]);
    }
  };

  const loadHODProfile = async () => {
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      if (token) {
        const response = await fetch('http://127.0.0.1:8000/api/hods/profile/', {
          headers: { 'Authorization': `Token ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setHodProfile(data);
        }
      }
    } catch (error) {
      console.error('Error loading HOD profile:', error);
    }
  };

  const loadPendingTimetables = async () => {
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      const response = await fetch('http://127.0.0.1:8000/api/hods/timetable/approvals/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingTimetables(data.pending_timetables || []);
      }
    } catch (error) {
      console.error('Error loading pending timetables:', error);
      setPendingTimetables([]);
    }
  };

  const promoteInstructorToCoordinator = async (instructorId: number, instructorName: string) => {
    if (!window.confirm(`Are you sure you want to promote ${instructorName} to Coordinator?`)) {
      return;
    }
    try {
      const response = await coordinatorService.promoteInstructorToCoordinator(instructorId, false);
      alert(response.data.message || `Successfully promoted ${instructorName} to Coordinator!`);
      loadInstructors();
      loadCoordinators();
    } catch (error: any) {
      console.error('Error promoting instructor:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to promote instructor. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleApprove = (allocation: any) => {
    const comments = window.prompt('Add approval comments (optional):');
    updateAllocation(allocation.allocation_id, {
      status: 'approved',
      hod_comments: comments || '',
      approved_at: new Date().toISOString()
    });
    alert('Course allocation approved successfully!');
  };
  
  const handleReject = (allocation: any) => {
    const reason = window.prompt('Please provide rejection reason:');
    if (!reason) return;
    updateAllocation(allocation.allocation_id, {
      status: 'rejected',
      hod_comments: reason,
      rejection_reason: reason,
      approved_at: new Date().toISOString()
    });
    alert('Course allocation rejected.');
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'instructors', label: 'Instructors', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 616 0z' },
    { id: 'coordinators', label: 'Coordinators', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'feedback', label: 'Student Feedback', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }
  ];

  const allocationSubTabs = [
    { 
      id: 'pending', 
      label: 'Pending Approval', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), 
      count: allocations.filter(a => a.status === 'proposed').length 
    },
    { 
      id: 'approved', 
      label: 'Approved', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ), 
      count: allocations.filter(a => a.status === 'approved' || a.status === 'active').length 
    },
    { 
      id: 'rejected', 
      label: 'Rejected', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ), 
      count: allocations.filter(a => a.status === 'rejected').length 
    },
    { 
      id: 'all', 
      label: 'All Allocations', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ), 
      count: allocations.length 
    }
  ];

  const renderCourseAllocations = () => {
    let filteredAllocations = [];
    
    switch (allocationTab) {
      case 'pending':
        filteredAllocations = allocations.filter(a => a.status === 'proposed');
        break;
      case 'approved':
        filteredAllocations = allocations.filter(a => a.status === 'approved' || a.status === 'active');
        break;
      case 'rejected':
        filteredAllocations = allocations.filter(a => a.status === 'rejected');
        break;
      case 'all':
      default:
        filteredAllocations = allocations;
        break;
    }
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-4">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Course Allocation Management
          </h1>
          <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2">
            {allocationSubTabs.map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => setAllocationTab(subTab.id as AllocationTab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  allocationTab === subTab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {subTab.icon}
                <span>{subTab.label}</span>
                {subTab.count > 0 && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    allocationTab === subTab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {subTab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{allocations.filter(a => a.status === 'proposed').length}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{allocations.filter(a => a.status === 'approved' || a.status === 'active').length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{allocations.filter(a => a.status === 'rejected').length}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {filteredAllocations.length > 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
              {allocationSubTabs.find(tab => tab.id === allocationTab)?.icon}
              <span className="ml-2">{allocationSubTabs.find(tab => tab.id === allocationTab)?.label}</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAllocations.map((allocation) => (
                <div key={allocation.allocation_id} className={`border rounded-lg p-4 ${
                  allocation.status === 'proposed' ? 'border-yellow-200 bg-yellow-50' :
                  allocation.status === 'approved' || allocation.status === 'active' ? 'border-green-200 bg-green-50' :
                  allocation.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{allocation.course_name}</h3>
                      <p className="text-sm text-gray-500">{allocation.course_code}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                      allocation.status === 'proposed' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      allocation.status === 'approved' || allocation.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                      allocation.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {allocationSubTabs.find(tab => 
                        (allocation.status === 'proposed' && tab.id === 'pending') ||
                        ((allocation.status === 'approved' || allocation.status === 'active') && tab.id === 'approved') ||
                        (allocation.status === 'rejected' && tab.id === 'rejected')
                      )?.icon}
                      <span className="ml-1">{allocation.status}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div><span className="font-medium">Instructor:</span> {allocation.instructor_name}</div>
                    <div><span className="font-medium">Semester:</span> {allocation.semester_name}</div>
                    <div><span className="font-medium">Proposed by:</span> {allocation.coordinator_name}</div>
                    <div><span className="font-medium">Date:</span> {new Date(allocation.proposed_at).toLocaleDateString()}</div>
                  </div>

                  {allocation.hod_comments && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <p className="text-sm font-medium text-blue-800">Comments:</p>
                      <p className="text-sm text-blue-700">{allocation.hod_comments}</p>
                    </div>
                  )}

                  {allocation.rejection_reason && (
                    <div className="bg-red-50 p-3 rounded-lg mb-4">
                      <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{allocation.rejection_reason}</p>
                    </div>
                  )}

                  {allocation.status === 'proposed' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(allocation)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(allocation)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-100 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No {allocationSubTabs.find(tab => tab.id === allocationTab)?.label}</h3>
            <p className="text-gray-600">
              {allocationTab === 'pending' ? 'All course allocations have been reviewed.' :
               allocationTab === 'approved' ? 'No approved allocations yet.' :
               allocationTab === 'rejected' ? 'No rejected allocations.' :
               'No course allocations found.'}
            </p>
          </div>
        )}
      </motion.div>
    );
  };

  const renderSidebar = () => (
    <div className="w-64 bg-gradient-to-b from-purple-800 to-indigo-900 text-white p-4 space-y-2 min-h-screen shadow-xl">
      <div className="mb-8 text-center">
        <div className="h-16 w-16 rounded-full bg-white mx-auto mb-2 flex items-center justify-center">
          <svg className="h-10 w-10 text-purple-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
          </svg>
        </div>
        <h3 className="text-base font-medium">HOD Portal</h3>
        <p className="text-xs text-purple-200">{currentUser?.name || 'Head of Department'}</p>
        {hodProfile?.department && (
          <p className="text-xs text-purple-100 mt-1">
            HOD of {hodProfile.department.name}
          </p>
        )}
      </div>

      <nav>
        <ul className="space-y-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id ? 'bg-purple-700 text-white' : 'text-purple-100 hover:bg-purple-700'
                }`}
              >
                <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </button>
            </li>
          ))}
          
          {/* Course Allocation with expandable submenu */}
          <li>
            <button
              onClick={() => {
                setActiveTab('allocations');
                setIsAllocationMenuOpen(!isAllocationMenuOpen);
              }}
              className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'allocations' ? 'bg-purple-700 text-white' : 'text-purple-100 hover:bg-purple-700'
              }`}
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Course Allocation</span>
              </div>
              <svg 
                className={`h-4 w-4 transition-transform duration-200 ${isAllocationMenuOpen ? 'rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Submenu */}
            <AnimatePresence>
              {isAllocationMenuOpen && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 mt-1 space-y-1 overflow-hidden"
                >
                  {allocationSubTabs.map((subTab) => (
                    <li key={subTab.id}>
                      <button
                        onClick={() => {
                          setActiveTab('allocations');
                          setAllocationTab(subTab.id as AllocationTab);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                          allocationTab === subTab.id
                            ? 'bg-purple-600 text-white border-l-2 border-white'
                            : 'text-purple-200 hover:bg-purple-600 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="mr-2">{subTab.icon}</span>
                          <span>{subTab.label}</span>
                        </div>
                        {subTab.count > 0 && (
                          <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                            {subTab.count}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </li>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Instructors</p>
              <p className="text-xl font-semibold text-purple-600">{stats.totalInstructors}</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 616 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Coordinators</p>
              <p className="text-xl font-semibold text-blue-600">{coordinators.length}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Pending Allocations</p>
              <p className="text-xl font-semibold text-yellow-600">{getProposedAllocations().length}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Department Rating</p>
              <p className="text-xl font-semibold text-green-600">4.8/5</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderInstructors = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-base font-medium">Department Instructors</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {instructors.map((instructor) => (
                <tr key={instructor.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{instructor.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instructor.employee_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {instructor.specialization || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => promoteInstructorToCoordinator(instructor.id, instructor.name)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Promote to Coordinator
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  const renderCoordinators = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-base font-medium">Department Coordinators</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Can Act as Instructor</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {coordinators.map((coordinator) => (
                <tr key={coordinator.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{coordinator.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {coordinator.employee_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {coordinator.specialization || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      coordinator.can_act_as_instructor 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {coordinator.can_act_as_instructor ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'allocations':
        return renderCourseAllocations();
      case 'instructors':
        return renderInstructors();
      case 'coordinators':
        return renderCoordinators();
      case 'feedback':
        return <FeedbackViewer />;
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <NotificationToast 
        notification={newNotification}
        onClose={clearNewNotification}
        onFeedbackClick={() => setActiveTab('feedback')}
      />
      {renderSidebar()}
      <div className="flex-1 overflow-auto">
        <header className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg border-b border-purple-300 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white bg-opacity-20 border-2 border-white flex items-center justify-center">
                <span className="text-lg font-semibold text-white">H</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}
                </h1>
                <p className="text-purple-100 mt-1">
                  Welcome back, {hodProfile?.name || currentUser?.name || 'Head of Department'}
                  {hodProfile?.department && (
                    <span className="ml-2 text-purple-200">
                      • HOD of {hodProfile.department.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <NotificationBell onFeedbackClick={() => setActiveTab('feedback')} />
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">HOD Dashboard</h1>
            <p className="text-gray-600">Manage your department efficiently</p>
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default HODDashboard;