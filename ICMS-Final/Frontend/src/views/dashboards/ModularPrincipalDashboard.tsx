import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, BookOpen, ClipboardList, CalendarDays, Menu } from 'lucide-react';

// Import Modular Components
import DashboardStats from '../modules/DashboardStats';
import EventsModule from '../modules/EventsModule';
import AnnouncementModule from '../modules/AnnouncementModule';
import AnalyticsModule from '../modules/AnalyticsModule';

type TabId = 'Dashboard' | 'Teachers' | 'Reports' | 'Events' | 'Announcements';

const ModularPrincipalDashboard: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('Dashboard');
  const navigate = useNavigate();

  const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;

  const stats = {
    totalStudents: 512,
    totalStaff: 35,
    totalDepartments: 8,
    totalCourses: 45,
  };

  const tabs = [
    { name: 'Dashboard', icon: <Users /> },
    { name: 'Teachers', icon: <BookOpen /> },
    { name: 'Reports', icon: <ClipboardList /> },
    { name: 'Events', icon: <CalendarDays /> },
    { name: 'Announcements', icon: <CalendarDays /> },
  ];

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      localStorage.removeItem("auth");
      navigate("/login");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <div className="space-y-6">
            <DashboardStats stats={stats} />
            <AnalyticsModule token={token} userType="admin" />
          </div>
        );
      case 'Events':
        return <EventsModule token={token} userType="principal" canApprove={true} />;
      case 'Announcements':
        return <AnnouncementModule token={token} canCreate={true} />;
      case 'Teachers':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Teacher Management</h2>
            <p className="text-gray-600">Teacher management functionality will be implemented here.</p>
          </div>
        );
      case 'Reports':
        return (
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Reports & Analytics</h2>
            <p className="text-gray-600">Comprehensive reports and analytics will be displayed here.</p>
          </div>
        );
      default:
        return <div>Content for {activeTab}</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <motion.div
        animate={{ width: isSidebarOpen ? 250 : 80 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-b from-indigo-700 to-indigo-900 text-white flex flex-col justify-between shadow-2xl"
      >
        <div>
          <h2 className="text-2xl font-bold text-center py-5">
            {isSidebarOpen ? 'Principal' : 'P'}
          </h2>
          <nav className="space-y-1 px-3">
            {tabs.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name as TabId)}
                className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-all duration-200 ${
                  activeTab === item.name
                    ? "bg-indigo-600 shadow-md"
                    : "hover:bg-indigo-600"
                }`}
              >
                {item.icon}
                {isSidebarOpen && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-3 border-t border-indigo-500">
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <LogOut size={18} /> {isSidebarOpen && "Logout"}
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center bg-white shadow-md p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Menu size={18} /> {isSidebarOpen ? "Collapse" : "Expand"}
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{activeTab} Overview</h1>
          </div>
          <p className="text-sm text-gray-500">
            Logged in as <span className="font-semibold">Principal</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularPrincipalDashboard;