import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from "../../api/api";

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAllocations } from '../../context/AllocationContext';
import OBEModule from '../modules/OBEModule';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import MyCoursesModule from '../modules/MyCoursesModule';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import AssignedRetakesPanel from '../../features/retake/AssignedRetakesPanel';
import RetakeResultEntryPage from '../pages/RetakeResultEntryPage';
import { getRetakeAssessmentContext } from '../../features/retake/retakeApi';


type TabId = 'dashboard' | 'courses' | 'obe' | 'retakes';

const ModularInstructorDashboard: React.FC = () => {
  const { getInstructorAllocations } = useAllocations();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [instructorProfile, setInstructorProfile] = useState<any>(null);
  const [cqiPopup, setCqiPopup] = useState<any[]>([]);
  const retakeIdFromQuery = searchParams.get('retake_id');
  const currentInstructorId = String(
    currentUser?.instructor_id ??
    currentUser?.instructor_profile?.id ??
    ''
  );
  const instructorCourses = getInstructorAllocations(currentInstructorId);

  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'instructor');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setInstructorProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch instructor profile:', error);
        if (!cancelled) {
          setInstructorProfile(currentUser);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);
  useEffect(() => {
    loadNextBatchCQI();
  }, []);
  
  useEffect(() => {
    if (retakeIdFromQuery) {
      setActiveTab('retakes');
    }
  }, [retakeIdFromQuery]);

  const instructorHeaderProfile = instructorProfile || currentUser;
  const instructorHeaderImageUrl = getProfileImageUrl(instructorHeaderProfile);
  const instructorHeaderName = (
    instructorHeaderProfile?.full_name ||
    instructorHeaderProfile?.name ||
    instructorHeaderProfile?.first_name ||
    instructorHeaderProfile?.username ||
    'Instructor'
  ).trim();
const loadNextBatchCQI = async () => {
   try {
      const res = await api.get("/feedback/next-batch-cqi/");

      setCqiPopup(res.data || []);
   } catch (err) {
      console.log(err);
   }
};

  const handleViewCourseDetails = (course: any) => {
  navigate(`/teacher/course-details/${course.allocation_id}`);
};

  const handleManageClass = (course: any) => {
  navigate(`/manage-class/${course.allocation_id}`);
};

  const handleLogout = () => {
    logout();
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'courses', label: 'My Courses', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'obe', label: 'OBE Management', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'retakes', label: 'Assigned Retakes', icon: 'M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z' }
  ];

  const renderMyCourses = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          My Assigned Courses
        </h1>
        <p className="text-gray-600 mt-1">Courses assigned to you by the coordinator and approved by HOD</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{instructorCourses.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Classes</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{instructorCourses.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Batches</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{new Set(instructorCourses.map(c => c.batch)).size}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Course Cards */}
      {instructorCourses.length > 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-semibold mb-6">Your Course Assignments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instructorCourses.map((course) => (
              <motion.div
                key={course.allocation_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{course.course_name}</h3>
                    <p className="text-sm font-medium text-blue-600 mb-3">{course.course_code}</p>
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {course.batch_name}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Assigned by {course.coordinator_name}
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Active
                  </div>
                </div>
                
                <div className="border-t border-blue-200 pt-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('courses')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => handleManageClass(course)}
                      className="flex-1 bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Manage Class
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-100 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Courses Assigned</h3>
          <p className="text-gray-600 mb-4">You don't have any active course assignments yet.</p>
          <p className="text-sm text-gray-500">Course assignments will appear here once approved by the HOD.</p>
        </div>
      )}
    </motion.div>
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
              <p className="text-gray-600 text-sm">My Courses</p>
              <p className="text-2xl font-bold text-blue-600">{instructorCourses.length}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Classes</p>
              <p className="text-2xl font-bold text-green-600">{instructorCourses.length}</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Students</p>
              <p className="text-2xl font-bold text-purple-600">150</p>
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
              <p className="text-gray-600 text-sm">Attendance Rate</p>
              <p className="text-2xl font-bold text-yellow-600">92%</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setActiveTab('courses')}
            className="p-4 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <div className="text-blue-600 font-medium">View My Courses</div>
          </button>
          <button className="p-4 bg-green-100 rounded-lg hover:bg-green-200 transition-colors">
            <div className="text-green-600 font-medium">Mark Attendance</div>
          </button>
          <button className="p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors">
            <div className="text-purple-600 font-medium">Grade Students</div>
          </button>
          <button className="p-4 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors">
            <div className="text-orange-600 font-medium">View Schedule</div>
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderInstructorDashboard = () => {
    const uniqueBatches = new Set(instructorCourses.map((course) => course.batch_name || course.batch)).size;
    const uniqueSemesters = new Set(instructorCourses.map((course) => String(course.semester_no ?? 'N/A'))).size;

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 text-white shadow-2xl">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-50 backdrop-blur-sm">
                Instructor Dashboard
              </div>
              <div>
                <h2 className="text-3xl font-black leading-tight md:text-4xl">Teaching dashboard at a glance</h2>
                <p className="mt-3 max-w-2xl text-sm text-blue-50/90 md:text-base">
                  Start here for your assigned courses, retakes, and OBE work. The landing page now opens on Dashboard by default.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('courses')}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-indigo-800 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  Open My Courses
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('retakes')}
                  className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5"
                >
                  View Retakes
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Courses', value: instructorCourses.length, hint: 'Assigned to you' },
                { label: 'Batches', value: uniqueBatches, hint: 'Active cohorts' },
                { label: 'Semesters', value: uniqueSemesters, hint: 'Teaching spans' },
                { label: 'CQI Alerts', value: cqiPopup.length, hint: 'Pending action' },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-blue-100">{item.label}</p>
                  <p className="mt-2 text-3xl font-black">{item.value}</p>
                  <p className="mt-1 text-xs text-blue-50/90">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'My Courses', value: instructorCourses.length, accent: 'from-blue-600 to-indigo-500' },
            { label: 'Active Classes', value: instructorCourses.length, accent: 'from-emerald-600 to-teal-500' },
            { label: 'Batches', value: uniqueBatches, accent: 'from-violet-600 to-fuchsia-500' },
            { label: 'CQI Alerts', value: cqiPopup.length, accent: 'from-amber-600 to-orange-500' },
          ].map((card) => (
            <div key={card.label} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-2 bg-gradient-to-r ${card.accent}`} />
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {card.label === 'CQI Alerts'
                    ? 'Previous batch quality items waiting for review'
                    : 'Live data from your current assignments'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Teaching Snapshot</p>
                <h3 className="mt-2 text-xl font-black text-slate-900">Your recent course assignments</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('courses')}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
              >
                View all
              </button>
            </div>

            {instructorCourses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {instructorCourses.slice(0, 4).map((course) => (
                  <div key={course.allocation_id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-600">{course.course_code}</p>
                    <h4 className="mt-2 text-lg font-bold text-slate-900">{course.course_name}</h4>
                    <p className="mt-2 text-sm text-slate-600">Batch: {course.batch_name}</p>
                    <p className="mt-1 text-sm text-slate-600">Semester: {course.semester_no || 'N/A'}</p>
                    <p className="mt-1 text-sm text-slate-600">Coordinator: {course.coordinator_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No course assignments found yet.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Quick Actions</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">Jump straight to work</h3>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('courses')}
                className="w-full rounded-2xl bg-blue-50 px-4 py-3 text-left transition hover:bg-blue-100"
              >
                <p className="font-bold text-slate-900">Open My Courses</p>
                <p className="mt-1 text-sm text-slate-600">View full teaching load and course cards</p>
              </button>
              <button
                onClick={() => setActiveTab('obe')}
                className="w-full rounded-2xl bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100"
              >
                <p className="font-bold text-slate-900">OBE Management</p>
                <p className="mt-1 text-sm text-slate-600">Handle CLOs, assessments, and mapping</p>
              </button>
              <button
                onClick={() => setActiveTab('retakes')}
                className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-left transition hover:bg-violet-100"
              >
                <p className="font-bold text-slate-900">Assigned Retakes</p>
                <p className="mt-1 text-sm text-slate-600">See pending result entry and retake work</p>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'courses':
        return <MyCoursesModule />;
      case 'dashboard':
        return renderInstructorDashboard();
      case 'obe':
        return <OBEModule />;
      case 'retakes':
        if (retakeIdFromQuery) {
          return <RetakeResultEntryPage />;
        }
        return (
          <AssignedRetakesPanel
            onOpenResults={async (retakeId) => {
              try {
                const assessmentContext = await getRetakeAssessmentContext(retakeId);
                navigate(`/teacher?retake_id=${encodeURIComponent(retakeId)}&tab=retakes`, {
                  state: {
                    assessmentContext,
                  },
                });
              } catch (error) {
                console.error('Failed to load retake assessment context before navigation', error);
                navigate(`/teacher?retake_id=${encodeURIComponent(retakeId)}&tab=retakes`);
              }
            }}
          />
        );
      default:
        return renderInstructorDashboard();
    }
  };

  return (
<>
    {cqiPopup.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl p-6 w-[500px]">

                <h2 className="text-xl font-bold text-red-600 mb-4">
                    Previous Batch CQI Required
                </h2>

                {cqiPopup.map((item, index) => (
                    <div key={index} className="border rounded p-3 mb-2">
                        <p><b>Course:</b> {item.course}</p>
                        <p><b>Previous Batch:</b> {item.previous_batch}</p>
                        <p><b>Root Cause:</b> {item.root_cause}</p>
                        <p><b>Remedial Plan:</b> {item.remedial_plan}</p>
                    </div>
                ))}

                <button
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => setCqiPopup([])}
                >
                    OK
                </button>

            </div>
        </div>
    )}

    
      <div className="flex min-h-screen w-full bg-[#E8F5E8]">
        {/* Sidebar */}
      <div className='w-64 bg-gradient-to-b from-blue-600 via-indigo-700 to-purple-800 text-white p-4 space-y-2 min-h-screen shadow-xl flex flex-col'>
        <div className='mb-8 text-center'>
          <div className='h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-3 flex items-center justify-center border border-white/30 overflow-hidden shadow-md'>
            {instructorHeaderImageUrl ? (
              <img src={instructorHeaderImageUrl} alt={instructorHeaderName} className='h-full w-full object-cover' />
            ) : (
              <span className='text-xl font-bold text-white'>
                {instructorHeaderName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className='text-lg font-semibold text-white truncate px-2'>{instructorHeaderName}</h3>
          <p className='text-xs text-blue-200 uppercase tracking-[0.18em]'>Instructor Portal</p>
        </div>

        <nav>
          <ul className='space-y-1'>
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

        {/* Bottom section with role switch and logout */}
        <div className="mt-auto pt-4 border-t border-white/20">
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 rounded-lg text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200"
          >
            <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex-1">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-6 shadow-xl border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg">
                <span className="text-lg font-semibold text-white">I</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Instructor Dashboard'}
                </h1>
                <p className="text-blue-100 text-sm">Teaching Excellence</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={instructorProfile || currentUser} />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
    </>
  );
};

export default ModularInstructorDashboard;
