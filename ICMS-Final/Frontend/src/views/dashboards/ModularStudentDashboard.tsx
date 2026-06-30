import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/api';
import { feedbackService } from '../../api/FeedbackServices';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Award,
  Target,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import { fetchCurrentProfile } from '../../api/profileService';
import { getEffectiveRole, getProfileImageUrl } from '../../utils/profileHelpers';
import StudentFeedbackPopup from '../pages/StudentFeedbackPopup';
import StudentResults from '../pages/StudentResults';

type TabId = 'dashboard' | 'results';

const ModularStudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  // ✅ Feedback Status Check
  useEffect(() => {
    const checkFeedbackStatus = async () => {
      try {
        const batchId = currentUser?.batch_id || currentUser?.batch?.id;
        if (!batchId) return;

        const res = await feedbackService.status(batchId);
        setShowFeedbackPopup(res?.enabled === true && res?.submitted === false);
      } catch (err) {
        console.error('Feedback status error:', err);
      }
    };

    if (currentUser) checkFeedbackStatus();
  }, [currentUser]);

  // ✅ Result Fetch
  useEffect(() => {
    if (!currentUser?.id) return;

    api.get('/assessments/student/result/')
      .then(res => setResult(res.data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [currentUser]);

  // ✅ Profile Fetch
  useEffect(() => {
    let cancelled = false;
    const role = getEffectiveRole(currentUser, 'student');

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile(role);
        if (!cancelled && response.data && (response.data.email || response.data.full_name)) {
          setStudentProfile(response.data);
        }
      } catch {
        if (!cancelled) setStudentProfile(currentUser);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  }, [currentUser]);

  const headerProfile = studentProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'Student').trim();

  const sidebarGradient = 'from-purple-800 via-indigo-800 to-blue-800';
  const headerGradient = 'from-pink-500 via-purple-500 to-indigo-500';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'results',   label: 'My Results', icon: FileText },
  ];

  // ── Dashboard Tab ─────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Hero Banner */}
        <section className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-8 rounded-2xl text-white shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
                  Student
                </span>
              </div>
              <h2 className="text-3xl font-bold mb-1">{headerName}</h2>
              <p className="text-blue-100">Welcome to your academic dashboard</p>
            </div>
            <div className="bg-white/15 backdrop-blur px-8 py-5 rounded-xl text-center border border-white/20">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Overall Percentage</p>
              <p className="text-4xl font-bold">{result?.percentage || 0}%</p>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Total Marks',  value: result?.total || 0,           icon: FileText,    color: 'text-pink-500',                                                bg: 'bg-pink-50'   },
            { label: 'Percentage',   value: `${result?.percentage || 0}%`, icon: Target,      color: 'text-purple-500',                                              bg: 'bg-purple-50' },
            { label: 'GPA',          value: result?.gpa || 0,              icon: Award,       color: 'text-indigo-500',                                              bg: 'bg-indigo-50' },
            { label: 'Status',       value: result?.status || '-',         icon: CheckCircle2,color: result?.status === 'PASS' ? 'text-emerald-500' : 'text-rose-500', bg: result?.status === 'PASS' ? 'bg-emerald-50' : 'bg-rose-50' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </section>

        {/* Recent Assessments */}
        {result?.assessments?.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-pink-500" />
                Recent Assessments
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {result.assessments.slice(0, 5).map((a: any, i: number) => {
                const pct = a.total > 0 ? ((a.obtained / a.total) * 100).toFixed(1) : '0.0';
                return (
                  <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{a.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {a.course?.name || 'No course'} • <span className="capitalize">{a.type}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-gray-900">
                          {a.obtained}<span className="text-lg text-gray-400">/{a.total}</span>
                        </p>
                        <p className={`text-sm font-semibold mt-1 ${
                          parseFloat(pct) >= 70 ? 'text-green-600' :
                          parseFloat(pct) >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {pct}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>
    );
  };

  // ── Main Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Toaster position="top-right" />

      {/* ✅ Feedback Popup — working logic, beautiful overlay */}
      {showFeedbackPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <StudentFeedbackPopup onSubmitSuccess={() => setShowFeedbackPopup(false)} />
          </motion.div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-lg flex flex-col`}>
        <div className="mb-10 text-center">
          <div className="h-16 w-16 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center border border-white/20">
            <LayoutDashboard className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Student Portal</h3>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`w-full flex items-center px-5 py-3 rounded-lg transition-all ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-4 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`} />
                    <span className="font-semibold text-sm">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center px-5 py-3 rounded-lg text-red-200 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-4" />
            <span className="font-semibold text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className={`bg-gradient-to-r ${headerGradient} p-6 shadow-md border-b border-blue-700/20 z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <div className="h-14 w-14 rounded-lg bg-white/15 flex items-center justify-center border-2 border-white/30 overflow-hidden">
                {headerImageUrl ? (
                  <img src={headerImageUrl} alt={headerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-white">
                    {headerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h1>
                <p className="text-blue-100 text-sm mt-1">Welcome back, {headerName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={headerProfile} label="Student" />
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'results' && (
                <StudentResults result={result} loading={loading} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularStudentDashboard;