import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Briefcase, 
  Award, 
  BookOpen, 
  ClipboardList, 
  ArrowRight,
  Download,
  Building,
  User,
  Calendar,
  LogOut,
  Star,
  Send,
  CheckCircle,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import obeService from '../../api/obeService';
import { AlumniDashboardResponse } from '../../api/obeService';

// --- Dummy Data ---
const dummySurvey = { 
  round: "2025", 
  closeDate: "December 31, 2025", 
  questions: [ 
    { 
      id: "q1", 
      peo: "PEO 1", 
      peoTitle: "Industry Practice", 
      questionText: "How well did the program prepare you to apply CS fundamentals in industry?", 
      type: "rating", 
    }, 
    { 
      id: "q2", 
      peo: "PEO 2", 
      peoTitle: "Higher Education", 
      questionText: "How well did the program prepare you to pursue higher education or research?", 
      type: "rating", 
    }, 
    { 
      id: "q3", 
      peo: "PEO 3", 
      peoTitle: "Leadership & Ethics", 
      questionText: "How well did the program prepare you to demonstrate professional ethics?", 
      type: "rating", 
    }, 
    { 
      id: "q4", 
      peo: "PEO 4", 
      peoTitle: "Lifelong Learning", 
      questionText: "How well did the program prepare you for lifelong learning?", 
      type: "rating", 
    }, 
    { 
      id: "q5", 
      peo: null, 
      peoTitle: null, 
      questionText: "Any suggestions to improve the program?", 
      type: "open_ended", 
    }, 
  ], 
};

// --- Icons ---
const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AwardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlumniDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transcript' | 'survey'>('dashboard');
  const [isSurveyOpen] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [alumniData, setAlumniData] = useState<AlumniDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // --- Survey Helpers ---
  const handleRating = (id: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [id]: rating }));
  };

  const handleOpenEnded = (id: string, text: string) => {
    setAnswers(prev => ({ ...prev, [id]: text }));
  };

  const ratingQuestions = dummySurvey.questions.filter(q => q.type === 'rating');
  const answeredCount = ratingQuestions.filter(q => answers[q.id]).length;
  const progressPercent = (answeredCount / ratingQuestions.length) * 100;
  const isComplete = answeredCount === ratingQuestions.length;

  const handleSubmit = () => {
    if (isComplete) {
      setHasSubmitted(true);
      // In a real app, API call would go here
    }
  };

  useEffect(() => {
    const fetchAlumniData = async () => {
      try {
        setLoading(true);
        const data = await obeService.getAlumniDashboard();
        setAlumniData(data);
      } catch (error) {
        console.error("Failed to fetch alumni data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAlumniData();
  }, []);

  // --- Styles ---
  const sidebarGradient = "from-blue-600 via-indigo-700 to-purple-800";
  const headerGradient = "from-blue-600 via-indigo-600 to-purple-700";

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: GraduationCap },
    { id: 'transcript', label: 'Academic Transcript', icon: BookOpen },
    { id: 'survey', label: 'PEO Survey', icon: ClipboardList },
  ];

  const renderDashboard = () => {
    if (loading || !alumniData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    return (
      <div className="space-y-8">
        {/* --- Hero Section --- */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <GraduationCap className="w-64 h-64 text-white" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest border border-white/30">
                  Graduate Alumni
                </span>
                <span className="text-blue-100 text-xs font-bold">Class of {alumniData.graduation_year}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-2">
                {alumniData.name}
              </h2>
              <p className="text-lg text-blue-100 font-medium">
                {alumniData.program} • {alumniData.batch}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="bg-white text-blue-600 px-6 py-4 rounded-2xl shadow-xl text-center">
                <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 text-blue-400">Cumulative GPA</p>
                <p className="text-3xl font-black">{alumniData.cgpa.toFixed(2)}</p>
              </div>
              <p className="text-xs font-bold text-blue-200">Roll No: {alumniData.roll_no}</p>
            </div>
          </div>
        </section>

        {/* --- Survey Banner --- */}
        <AnimatePresence>
          {isSurveyOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-[24px] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-400"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <ClipboardList className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="font-black text-lg">PEO Survey 2025 is now open!</p>
                  <p className="text-sm font-medium opacity-90">Your feedback helps improve the program. Estimated time: 5 minutes</p>
                </div>
              </div>
              {hasSubmitted ? (
                <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-md">
                  ✅ Thank you! Survey submitted.
                </div>
              ) : (
                <button 
                  onClick={() => setActiveTab('survey')}
                  className="bg-white text-amber-600 px-8 py-3 rounded-2xl font-black hover:bg-amber-50 transition-all flex items-center gap-2 shadow-lg group"
                >
                  Fill Survey <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Stats Grid --- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "CGPA", value: alumniData.cgpa.toFixed(2), icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Program", value: alumniData.program, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Batch", value: alumniData.batch, icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Courses", value: alumniData.completed_courses, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-[24px] shadow-lg border border-gray-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black mt-1 text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </section>

        {/* --- Profile Details --- */}
        <section className="bg-white rounded-[24px] p-8 border border-gray-100 shadow-lg">
          <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-gray-800">
            <Briefcase className="w-6 h-6 text-blue-600" /> Professional Experience
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Current Employer</label>
              <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <Building className="w-6 h-6 text-blue-500" />
                <span className="text-lg font-bold text-gray-800">{alumniData.current_employer || 'N/A'}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Designation</label>
              <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <Briefcase className="w-6 h-6 text-indigo-500" />
                <span className="text-lg font-bold text-gray-800">{alumniData.designation || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full text-blue-600">
              <User className="w-4 h-4" />
            </div>
            <p className="text-sm text-blue-700 font-medium">
              Professional details are managed by the Alumni Office. To request an update, please contact alumni-relations@eduobe.edu
            </p>
          </div>
        </section>
      </div>
    );
  };

  const renderTranscript = () => {
    if (loading || !alumniData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    
    return (
      <section className="space-y-6">
        <div className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-xl">
          <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-blue-600" /> Academic Transcript
              </h3>
              <p className="text-gray-500 text-sm mt-1">Official record of academic performance</p>
            </div>
            <button 
              disabled 
              className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-200 flex items-center gap-2 opacity-50 cursor-not-allowed"
            >
              <Download className="w-5 h-5" /> Download PDF
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                  <th className="px-8 py-5">Semester</th>
                  <th className="px-8 py-5 text-center">Courses Passed</th>
                  <th className="px-8 py-5 text-right">SGPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alumniData.transcripts.map((t, idx) => (
                  <React.Fragment key={t.semester}>
                    {t.courses.map((course, cIdx) => (
                    <tr key={`${t.semester}-${cIdx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 font-bold text-gray-700">{cIdx === 0 ? t.semester : ''}</td>
                      <td className="px-8 py-5">
                        <div>
                          <p className="font-bold text-gray-800">{course.course_code} - {course.course_name}</p>
                          <p className="text-sm text-gray-500">{course.credits} Credits</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-blue-600 text-lg">{course.gpa.toFixed(2)}</td>
                    </tr>
                  ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-600 text-white">
                  <td className="px-8 py-6 font-black text-lg">Cumulative GPA</td>
                  <td className="px-8 py-6"></td>
                  <td className="px-8 py-6 text-right font-black text-2xl">{alumniData.cgpa.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    );
  };

  const renderSurvey = () => {
    if (hasSubmitted) {
      return (
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-[32px] p-12 text-center shadow-xl border border-emerald-100">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto"
          >
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
              <CheckCircle className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-800 mb-4">Jazakallah!</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-10 font-medium">
              Your feedback has been recorded. It will be used to improve the <span className="text-amber-600 font-bold">{alumniData?.program || 'program'}</span> for future generations.
            </p>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-200"
            >
              Return to Dashboard
            </button>
          </motion.div>
        </div>
      );
    }
    
    return (
      <div className="space-y-8">
        {/* --- Survey Header --- */}
        <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-6">
            <div>
              <h2 className="text-3xl font-black text-gray-800">PEO Survey {dummySurvey.round}</h2>
              <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" /> Closes: {dummySurvey.closeDate}
              </p>
            </div>
            
            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-tighter">
                <span className="text-gray-400">Completion Progress</span>
                <span className="text-blue-600">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex gap-4 items-start">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm text-blue-800 font-medium leading-relaxed">
              Program Educational Objectives (PEOs) describe the career and professional accomplishments that the program is preparing graduates to achieve. Your honest feedback is crucial for our continuous quality improvement process.
            </p>
          </div>
        </div>

        {/* --- Survey Questions --- */}
        <div className="space-y-6">
          {dummySurvey.questions.map((q, idx) => (
            <motion.section 
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl relative overflow-hidden group hover:border-blue-300 transition-all"
            >
              {q.peo && (
                <div className="mb-6 flex">
                  <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-200 flex items-center gap-2">
                    <AwardIcon className="w-3 h-3" /> {q.peo} — {q.peoTitle}
                  </span>
                </div>
              )}

              <h3 className="text-xl font-bold text-gray-800 mb-8 leading-tight">
                {q.questionText}
              </h3>

              {q.type === 'rating' ? (
                <div className="flex flex-wrap items-center gap-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(q.id, star)}
                      className="flex flex-col items-center gap-2 group/star"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        answers[q.id] >= star 
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                          : 'bg-gray-100 border border-gray-200 hover:border-blue-400'
                      }`}>
                        <Star 
                          className={`w-6 h-6 transition-colors ${
                            answers[q.id] >= star ? 'text-white fill-white' : 'text-gray-400 group-hover/star:text-blue-600'
                          }`} 
                        />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${
                        answers[q.id] === star ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {star === 1 ? 'Poor' : star === 5 ? 'Excellent' : star}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleOpenEnded(q.id, e.target.value)}
                  placeholder="Type your suggestions here..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all min-h-[150px] font-medium"
                />
              )}
            </motion.section>
          ))}
        </div>

        {/* --- Footer / Submit --- */}
        <div className="pt-8 flex flex-col items-center gap-6">
          {!isComplete && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-6 py-3 rounded-full border border-amber-200">
              <Info className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Please answer all rating questions to submit</span>
            </div>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={!isComplete}
            className={`w-full max-w-md py-5 rounded-[24px] font-black text-xl transition-all flex items-center justify-center gap-3 shadow-2xl ${
              isComplete 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-blue-200' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
          >
            <Send className="w-6 h-6" />
            Submit Survey
          </button>
          
          <p className="text-gray-400 text-xs font-bold uppercase tracking-tighter">
            Confidentiality Guaranteed • Educational Excellence
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      {/* --- Sidebar --- */}
      <div className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-xl flex flex-col`}>
        <div className="mb-12 text-center">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center border border-white/30 shadow-inner">
            <GraduationCap className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Alumni Portal</h3>
          <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mt-1">Class of {alumniData?.graduation_year || ''}</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center px-5 py-4 rounded-[18px] transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'bg-white text-blue-600 shadow-xl border border-white' 
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mr-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-blue-200'}`} />
                    <span className="font-black text-sm">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center px-5 py-4 rounded-[18px] text-red-100 bg-red-500/20 hover:bg-red-500/40 transition-all duration-300 border border-red-500/20"
          >
            <LogOut className="h-5 w-5 mr-4" />
            <span className="font-black text-sm">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* --- Header --- */}
        <header className={`bg-gradient-to-r ${headerGradient} p-8 shadow-xl border-b border-white/10 z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg overflow-hidden">
                <span className="text-2xl font-black text-white">
                  {alumniData?.name?.charAt(0) || 'A'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h1>
                <p className="text-blue-100 text-sm font-medium mt-1">
                  Welcome back, {alumniData?.name || 'alumni'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <TopbarProfileMenu userData={currentUser} />
            </div>
          </div>
        </header>

        {/* --- Scrollable Content --- */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'transcript' && renderTranscript()}
            {activeTab === 'survey' && renderSurvey()}
          </motion.div>
          
          <footer className="mt-16 py-8 border-t border-gray-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 opacity-30 grayscale">
              <GraduationCap className="w-5 h-5" />
              <span className="text-xs font-black tracking-widest uppercase">EduOBE Alumni Network</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
              © 2026 Higher Education Portal • Engineering Excellence
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default AlumniDashboard;
