import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/api';
import obeService from '../../api/obeService';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  LogOut,
  ArrowLeft,
  BookOpen,
  Award,
  Target,
  CheckCircle2,
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StudentExitSurvey from '../modules/student/StudentExitSurvey';
import { feedbackService } from '../../api/FeedbackServices';
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
  const [portalLocked, setPortalLocked] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
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

    const checkPortalStatus = async () => {
      try {
        console.log('Checking portal status...');
        const status = await obeService.getStudentPortalStatus();
        console.log('Portal status response:', status);
        setPortalLocked(status.locked && status.reason === 'exit_survey_required');
        console.log('Set portal locked to:', status.locked && status.reason === 'exit_survey_required');
      } catch (error) {
        console.error('Failed to check portal status:', error);
      }
    };
    checkPortalStatus();

    api.get('/assessments/student/result/')
      .then(res => {
        setResult(res.data);
      })
      .catch((err) => {
        console.error('Error fetching result:', err);
        setResult(null);
      })
      .finally(() => setLoading(false));
  }, [currentUser, navigate]);

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
      } catch (error) {
        console.error('Failed to fetch student profile:', error);
        if (!cancelled) {
          setStudentProfile(currentUser);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const groupAssessmentsBySubject = () => {
    if (!result || !result.assessments) return {};
    
    return result.assessments.reduce((groups: Record<string, any[]>, assessment: any) => {
      const subject = assessment.course?.name || assessment.course || 'Other';
      if (!groups[subject]) {
        groups[subject] = [];
      }
      groups[subject].push(assessment);
      return groups;
    }, {});
  };

  const groupedAssessments = groupAssessmentsBySubject();

  const getSemestersFromAssessments = () => {
    if (!result || !result.assessments) return ['All Semesters'];
    const semesterSet = new Set<string>();
    result.assessments.forEach((assessment: any) => {
      const semester = assessment.semester?.name || assessment.semester || 'All Semesters';
      semesterSet.add(semester);
    });
    return Array.from(semesterSet);
  };

  const headerProfile = studentProfile || currentUser;
  const headerImageUrl = getProfileImageUrl(headerProfile);
  const headerName = (headerProfile?.full_name || headerProfile?.name || headerProfile?.username || 'Student').trim();

  const sidebarGradient = "from-purple-800 via-indigo-800 to-blue-800";
  const headerGradient = "from-pink-500 via-purple-500 to-indigo-500";

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'results', label: 'My Results', icon: FileText },
  ];

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-8 rounded-2xl text-white shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider">
                  Student
                </span>
              </div>
              <h2 className="text-3xl font-bold mb-1">
                {headerName}
              </h2>
              <p className="text-blue-100">
                Welcome to your academic dashboard
              </p>
            </div>
            
            <div className="bg-white/15 backdrop-blur px-8 py-5 rounded-xl text-center border border-white/20">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Overall Percentage</p>
              <p className="text-4xl font-bold">{result?.percentage || 0}%</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: "Total Marks", value: result?.total || 0, icon: FileText, color: "text-pink-500", bg: "bg-pink-50" },
            { label: "Percentage", value: `${result?.percentage || 0}%`, icon: Target, color: "text-purple-500", bg: "bg-purple-50" },
            { label: "GPA", value: result?.gpa || 0, icon: Award, color: "text-indigo-500", bg: "bg-indigo-50" },
            { 
              label: "Status", 
              value: result?.status || '-', 
              icon: CheckCircle2, 
              color: result?.status === 'PASS' ? "text-emerald-500" : "text-rose-500", 
              bg: result?.status === 'PASS' ? "bg-emerald-50" : "bg-rose-50"
            },
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
                const percent: string = a.total > 0 ? ((a.obtained / a.total) * 100).toFixed(1) : '0.0';
                
                return (
                  <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{a.title}</p>
                        <p className="text-sm text-gray-500 mt-1">{a.course?.name || 'No course'} • <span className="capitalize">{a.type}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xl text-gray-900">{a.obtained}<span className="text-lg text-gray-400">/{a.total}</span></p>
                        <p className={`text-sm font-semibold mt-1 ${parseFloat(percent) >= 70 ? 'text-green-600' : parseFloat(percent) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {percent}%
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

  const renderResults = () => {
    if (selectedCourse) {
      const courseAssessments = selectedCourse.assessments || [];
      const totalMarks = courseAssessments.reduce((sum: number, a: any) => sum + (a.total || 0), 0);
      const obtainedMarks = courseAssessments.reduce((sum: number, a: any) => sum + (a.obtained || 0), 0);
      const coursePercent = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '0.0';
      
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-base bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Results
            </button>
          </div>

          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">{selectedCourse.name}</h2>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Marks</p>
                  <p className="text-3xl font-bold text-gray-900">{obtainedMarks}<span className="text-xl text-gray-400">/{totalMarks}</span></p>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Percentage</p>
                  <p className={`text-3xl font-bold ${parseFloat(coursePercent) >= 70 ? 'text-green-600' : parseFloat(coursePercent) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {coursePercent}%
                  </p>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assessments</p>
                  <p className="text-3xl font-bold text-blue-600">{courseAssessments.length}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-100">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-pink-500" />
                    Assessments
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                        <th className="px-6 py-4">Assessment</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4 text-center">Obtained</th>
                        <th className="px-6 py-4 text-center">Total</th>
                        <th className="px-6 py-4 text-center">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {courseAssessments.map((a: any, i: number) => {
                        const percent: string = a.total > 0 ? ((a.obtained / a.total) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-medium text-gray-800">{a.title}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-500 capitalize">{a.type}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <p className="font-semibold text-gray-900">{a.obtained}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <p className="text-sm text-gray-500">{a.total}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <p className={`font-semibold ${parseFloat(percent) >= 70 ? 'text-green-600' : parseFloat(percent) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                {percent}%
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      );
    }

    const assessmentSemesters = getSemestersFromAssessments();
    const semesterToDisplay = selectedSemester || (assessmentSemesters.length > 0 ? assessmentSemesters[0] : null);
    
    const getFilteredAssessments = () => {
      if (!result?.assessments) return [];
      if (!semesterToDisplay || semesterToDisplay === 'All Semesters') return result.assessments;
      
      return result.assessments.filter((assessment: any) => {
        const assessmentSemester = assessment.semester?.name || assessment.semester || 'All Semesters';
        return assessmentSemester === semesterToDisplay;
      });
    };

    const filteredAssessments = getFilteredAssessments();
    
    const getGroupedFilteredAssessments = () => {
      return filteredAssessments.reduce((groups: Record<string, any[]>, assessment: any) => {
        const subject = assessment.course?.name || assessment.course || 'Other';
        if (!groups[subject]) {
          groups[subject] = [];
        }
        groups[subject].push(assessment);
        return groups;
      }, {});
    };

    const groupedFilteredAssessments = getGroupedFilteredAssessments();
    
    const calculateSemesterStats = () => {
      let totalMarks = 0;
      let obtainedMarks = 0;
      
      filteredAssessments.forEach((a: any) => {
        totalMarks += a.total || 0;
        obtainedMarks += a.obtained || 0;
      });
      
      const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '0.0';
      
      return { totalMarks, obtainedMarks, percentage };
    };
    
    const semesterStats = calculateSemesterStats();

    return (
      <div className="space-y-6">
        {!result?.assessments?.length ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-lg font-semibold">No results available</p>
          </div>
        ) : (
          <>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
            >
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                Select Semester
              </label>
              <select
                value={selectedSemester || (assessmentSemesters[0] || '')}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                {assessmentSemesters.map((semester) => (
                  <option key={semester} value={semester}>{semester}</option>
                ))}
              </select>
            </motion.div>

            {semesterToDisplay && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-indigo-500" />
                    Overall Report - {semesterToDisplay}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Marks</p>
                      <p className="text-2xl font-bold text-gray-900">{semesterStats.obtainedMarks}/{semesterStats.totalMarks}</p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Percentage</p>
                      <p className={`text-2xl font-bold ${parseFloat(semesterStats.percentage) >= 70 ? 'text-green-600' : parseFloat(semesterStats.percentage) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {semesterStats.percentage}%
                      </p>
                    </div>
                    <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assessments</p>
                      <p className="text-2xl font-bold text-blue-600">{filteredAssessments.length}</p>
                    </div>
                  </div>
                </motion.div>

                <div className="space-y-4">
                  {(Object.entries(groupedFilteredAssessments) as [string, any[]][]).map(([subjectName, assessments], index) => {
                    const subjectTotal = assessments.reduce((sum: number, a: any) => sum + (a.total || 0), 0);
                    const subjectObtained = assessments.reduce((sum: number, a: any) => sum + (a.obtained || 0), 0);
                    const subjectPercent = subjectTotal > 0 ? ((subjectObtained / subjectTotal) * 100).toFixed(1) : '0.0';
                    
                    return (
                      <motion.div 
                        key={subjectName} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                        onClick={() => setSelectedCourse({ name: subjectName, assessments })}
                      >
                        <div className="p-6 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white flex items-center justify-between group">
                          <div>
                            <h3 className="text-xl font-bold">{subjectName}</h3>
                            <p className="text-blue-100 text-sm mt-1">{assessments.length} assessments</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-2xl font-bold">{subjectObtained}/{subjectTotal}</p>
                              <p className={`text-lg font-semibold mt-1 ${parseFloat(subjectPercent) >= 70 ? 'text-green-100' : parseFloat(subjectPercent) >= 40 ? 'text-amber-100' : 'text-red-100'}`}>
                                {subjectPercent}%
                              </p>
                            </div>
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all duration-300 group-hover:scale-110">
                              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      <Toaster position="top-right" />
      {portalLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <StudentExitSurvey onSubmitSuccess={() => setPortalLocked(false)} />
          </motion.div>
        </div>
      )}
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
      <div className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-lg flex flex-col ${portalLocked ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="mb-10 text-center">
          <div className="h-16 w-16 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center border border-white/20 overflow-hidden">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt={headerName} className="w-full h-full object-cover" />
            ) : (
              <LayoutDashboard className="h-10 w-10 text-white" />
            )}
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`bg-gradient-to-r ${headerGradient} p-6 shadow-md border-b border-blue-700/20 z-10 ${portalLocked ? 'opacity-50 pointer-events-none' : ''}`}>
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
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h1>
                <p className="text-blue-100 text-sm mt-1">
                  Welcome back, {headerName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={headerProfile} />
            </div>
          </div>
        </header>

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
              {activeTab === 'results' && renderResults()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularStudentDashboard;
