import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import TopbarProfileMenu from "../components/TopbarProfileMenu";
import { fetchCurrentProfile } from "../api/profileService";

import PrincipalEvents from "../components/principal/PrincipalEvents";
import PrincipalDepartmentWiseAttendance from "../components/principal/Principalattendance";
import Principalanalytics from "../components/principal/Principalanalytics";
import PrincipalFeedbackReport from "../components/principal/Principalfeedback";
import PrincipalComplaintsInbox from "../components/principal/Principalcomplain";
import PrincipalAttendanceDashboard from "../components/attendance/PrincipalAttendanceDashboard";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  MessageSquare,
  CalendarDays,
  Menu,
} from "lucide-react";

const DummyBox = ({ title }: { title: string }) => (
  <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200">
    <h2 className="text-2xl font-bold text-gray-800 mb-3">{title}</h2>
    <p className="text-gray-500">Module content will appear here.</p>
  </div>
);

type TabType =
  | "Dashboard"
  | "DepartmentAttendance"
  | "AttendanceAnalytics"
  | "OBE-report"
  | "Feedback"
  | "Complaints"
  | "Events";

const tabs = [
  { id: "Dashboard", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
  {
    id: "DepartmentAttendance",
    icon: <Users size={20} />,
    label: "Department Attendance",
  },
  {
    id: "AttendanceAnalytics",
    icon: <BarChart3 size={20} />,
    label: "Attendance Analytics",
  },
  { id: "Feedback", icon: <BarChart3 size={20} />, label: "Feedback" },
  { id: "Complaints", icon: <MessageSquare size={20} />, label: "Complaints" },
  { id: "Events", icon: <CalendarDays size={20} />, label: "Events" },
  { id: "OBE-report", icon: <BarChart3 size={20} />, label: "OBE Report" },
];

export default function PrincipalDashboard() {
  const { logout, currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [principalProfile, setPrincipalProfile] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const response = await fetchCurrentProfile('principal');
        if (!cancelled) {
          setPrincipalProfile(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch principal profile:', error);
        if (!cancelled) {
          setPrincipalProfile(currentUser);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return <Principalanalytics />;

      case "DepartmentAttendance":
        return <PrincipalDepartmentWiseAttendance />;

      case "AttendanceAnalytics":
        return <PrincipalAttendanceDashboard />;

      case "Feedback":
        return <PrincipalFeedbackReport/>;

      case "Complaints":
        return <PrincipalComplaintsInbox/>;

      case "Events":
        return <PrincipalEvents />;

      default:
        return <DummyBox title="Loading..." />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ---------------- Sidebar ---------------- */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 80 }}
        transition={{ duration: 0.3 }}
        className="h-full bg-gradient-to-b from-indigo-600 via-purple-600 to-pink-600 
        text-white shadow-2xl flex flex-col"
      >
        <div className="py-6 text-center font-bold text-2xl tracking-wide">
          {sidebarOpen ? "Principal Panel" : "PP"}
        </div>

        <nav className="mt-3 space-y-1">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.05 }}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-4 px-5 py-3 w-full text-left rounded-xl transition-all ${
                activeTab === tab.id
                  ? "bg-white/20 shadow-lg"
                  : "hover:bg-white/10"
              }`}
            >
              {tab.icon}
              {sidebarOpen && (
                <span className="font-medium">{tab.label}</span>
              )}
            </motion.button>
          ))}
        </nav>

        <button
          onClick={logout}
          className="m-4 bg-red-600 text-white px-4 py-2 rounded-lg 
          hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </motion.aside>

      {/* ---------------- Main Content ---------------- */}
      <div className="flex-1 flex flex-col">

        {/* ----------- PROFESSIONAL GRADIENT HEADER ----------- */}
        <div
          className="flex justify-between items-center 
          bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600
          text-white shadow-lg p-4 border-b border-white/30"
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl 
            flex items-center gap-2 backdrop-blur"
          >
            <Menu size={18} />
            {sidebarOpen ? "Collapse" : ""}
          </button>

          <h1 className="text-2xl font-bold tracking-wide">
            {activeTab}
          </h1>

          <div className="flex items-center gap-3">
            <TopbarProfileMenu userData={principalProfile || currentUser} label="Principal" />
          </div>
        </div>

        {/* ----------- BODY CONTENT ----------- */}
        <div className="p-6 overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
