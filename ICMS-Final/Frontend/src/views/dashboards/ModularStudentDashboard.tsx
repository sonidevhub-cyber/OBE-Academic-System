import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, LayoutDashboard, GraduationCap, CalendarDays, Megaphone, Bell } from 'lucide-react';

// Import Modular Components
import ProfileModule from '../modules/ProfileModule';
import AttendanceModule from '../modules/AttendanceModule';
import AnnouncementModule from '../modules/AnnouncementModule';
import AnalyticsModule from '../modules/AnalyticsModule';
import SimpleFeedbackModule from '../modules/SimpleFeedbackModule';
import { getProfileImageUrl } from '../../utils/profileHelpers';

type TabId = 'Dashboard' | 'Results' | 'Attendance' | 'Timetable' | 'DateSheet' | 'Events' | 'Announcements' | 'Profile' | 'Feedback';

const ModularStudentDashboard: React.FC = () => {
  const [studentData, setStudentData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>('Dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
  const profileImageUrl = getProfileImageUrl(studentData);

  const modules = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Results', icon: <GraduationCap size={18} /> },
    { name: 'Attendance', icon: <CalendarDays size={18} /> },
    { name: 'Timetable', icon: <CalendarDays size={18} /> },
    { name: 'DateSheet', icon: <CalendarDays size={18} /> },
    { name: 'Feedback', icon: <Bell size={18} /> },
    { name: 'Events', icon: <Megaphone size={18} /> },
    { name: 'Announcements', icon: <Bell size={18} /> },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!token) return;
        const response = await fetch("http://127.0.0.1:8000/api/students/profile/", {
          headers: { Authorization: `Token ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStudentData(data);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    };
    fetchProfile();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <AnalyticsModule token={token} userType="student" darkMode={darkMode} />;
      case 'Attendance':
        return <AttendanceModule token={token} userType="student" darkMode={darkMode} />;
      case 'Announcements':
        return <AnnouncementModule token={token} canCreate={false} />;
      case 'Profile':
        return <ProfileModule profileData={studentData} userType="student" darkMode={darkMode} />;
      case 'Feedback':
        return <SimpleFeedbackModule token={token} userType="student" />;
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className={`min-h-screen flex transition-all ${
      darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
    }`}>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`w-64 p-6 shadow-lg flex flex-col justify-between ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div>
          <h2 className="text-2xl font-bold text-center text-blue-500 mb-6">
            🎓 Student Panel
          </h2>

          <div
            className="flex flex-col items-center cursor-pointer mb-8"
            onClick={() => setActiveTab("Profile")}
          >
            <img
              src={
                profileImageUrl || "https://via.placeholder.com/150"
              }
              alt={studentData?.name || 'Student Profile'}
              className="w-20 h-20 rounded-full border-4 border-blue-500 object-cover shadow-md"
            />
          </div>

          <nav className="space-y-2">
            {modules.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name as TabId)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg font-medium relative transition-all duration-300 ${
                  activeTab === item.name
                    ? "bg-blue-100 text-blue-700 font-semibold"
                    : darkMode
                    ? "hover:bg-gray-700 text-gray-300"
                    : "hover:bg-gray-200 text-gray-700"
                }`}
              >
                {activeTab === item.name && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-blue-600 rounded-r-md"></span>
                )}
                <span className="text-blue-500">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 py-2 mt-6 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-all"
        >
          <LogOut size={18} /> Logout
        </button>
      </motion.aside>

      {/* Main Dashboard */}
      <main className="flex-1 flex flex-col">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-500 p-5 flex justify-between items-center shadow-md">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {activeTab === "Dashboard"
              ? `Welcome, ${studentData?.name} 👋`
              : activeTab}
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default ModularStudentDashboard;
