import React, { useState } from 'react';
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
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';

// --- Dummy Data ---
const dummyAlumni = {
  name: "Sara Ahmed",
  rollNo: "2021-CS-45",
  batch: "2021-2025",
  program: "BS Computer Science",
  graduationYear: 2025,
  cgpa: 3.67,
  completedCourses: 32,
  currentEmployer: "Systems Ltd",
  designation: "Software Engineer",
};

const dummyTranscripts = [
  { semester: "Semester 1", courses: 5, sgpa: 3.82 },
  { semester: "Semester 2", courses: 5, sgpa: 3.75 },
  { semester: "Semester 3", courses: 4, sgpa: 3.90 },
  { semester: "Semester 4", courses: 4, sgpa: 3.65 },
  { semester: "Semester 5", courses: 4, sgpa: 3.50 },
  { semester: "Semester 6", courses: 4, sgpa: 3.70 },
  { semester: "Semester 7", courses: 3, sgpa: 3.60 },
  { semester: "Semester 8", courses: 3, sgpa: 3.45 },
];

const AlumniDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transcript' | 'survey'>('dashboard');
  const [isSurveyOpen] = useState(true);
  const [hasSubmitted] = useState(false);

  // --- Styles ---
  const sidebarGradient = "from-blue-600 via-indigo-700 to-purple-800";
  const headerGradient = "from-blue-600 via-indigo-600 to-purple-700";

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: GraduationCap },
    { id: 'transcript', label: 'Academic Transcript', icon: BookOpen },
    { id: 'survey', label: 'PEO Survey', icon: ClipboardList },
  ];

  const renderDashboard = () => (
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
              <span className="text-blue-100 text-xs font-bold">Class of {dummyAlumni.graduationYear}</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-2">
              {dummyAlumni.name}
            </h2>
            <p className="text-lg text-blue-100 font-medium">
              {dummyAlumni.program} • {dummyAlumni.batch}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="bg-white text-blue-600 px-6 py-4 rounded-2xl shadow-xl text-center">
              <p className="text-[10px] font-black uppercase tracking-tighter opacity-70 text-blue-400">Cumulative GPA</p>
              <p className="text-3xl font-black">{dummyAlumni.cgpa}</p>
            </div>
            <p className="text-xs font-bold text-blue-200">Roll No: {dummyAlumni.rollNo}</p>
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
                onClick={() => navigate('/alumni/survey')}
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
          { label: "CGPA", value: dummyAlumni.cgpa, icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Program", value: "BS CS", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Batch", value: dummyAlumni.batch, icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Courses", value: dummyAlumni.completedCourses, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
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
              <span className="text-lg font-bold text-gray-800">{dummyAlumni.currentEmployer}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Designation</label>
            <div className="flex items-center gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <Briefcase className="w-6 h-6 text-indigo-500" />
              <span className="text-lg font-bold text-gray-800">{dummyAlumni.designation}</span>
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

  const renderTranscript = () => (
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
              {dummyTranscripts.map((t, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-5 font-bold text-gray-700">{t.semester}</td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black border border-emerald-200">
                      {t.courses} Courses
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-blue-600 text-lg">{t.sgpa.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-600 text-white">
                <td className="px-8 py-6 font-black text-lg">Cumulative GPA</td>
                <td className="px-8 py-6"></td>
                <td className="px-8 py-6 text-right font-black text-2xl">{dummyAlumni.cgpa}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );

  const renderSurvey = () => (
    <div className="bg-white rounded-[32px] p-12 text-center shadow-xl border border-gray-100">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <ClipboardList className="w-12 h-12 text-amber-600" />
        </div>
        <h3 className="text-3xl font-black text-gray-800">Program Educational Objectives Survey</h3>
        <p className="text-gray-600 text-lg leading-relaxed">
          As an esteemed alumni of the <b>{dummyAlumni.program}</b>, your input is vital for our accreditation process and program improvement.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase mb-1">Duration</p>
            <p className="font-bold text-gray-800">5-7 Minutes</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase mb-1">Type</p>
            <p className="font-bold text-gray-800">PEO Attainment</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <p className="text-xs font-black text-gray-400 uppercase mb-1">Deadline</p>
            <p className="font-bold text-gray-800">June 30, 2026</p>
          </div>
        </div>
        <button className="w-full sm:w-auto mt-12 bg-blue-600 text-white px-12 py-4 rounded-[20px] font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">
          Start Survey Now
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#E8EFF8]">
      {/* --- Sidebar --- */}
      <div className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-xl flex flex-col`}>
        <div className="mb-12 text-center">
          <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-4 flex items-center justify-center border border-white/30 shadow-inner">
            <GraduationCap className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Alumni Portal</h3>
          <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mt-1">Class of {dummyAlumni.graduationYear}</p>
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
                  {dummyAlumni.name.charAt(0)}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h1>
                <p className="text-blue-100 text-sm font-medium mt-1">
                  Welcome back, {dummyAlumni.name}
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
