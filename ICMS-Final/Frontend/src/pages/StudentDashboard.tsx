<<<<<<< HEAD
import React from 'react';
import { useAuth } from '../context/AuthContext';
=======
import React, { useState, useEffect } from "react";
import axios from "axios";
import { announcementService } from "../api/apiService";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Sun,
  Moon,
  LogOut,
  LayoutDashboard,
  GraduationCap,
  CalendarDays,
  MessageSquare,
  Megaphone,
  Bell,
} from "lucide-react";
import { Department, Semester } from "api/studentInstructorService";
import { FeedbackButton } from "../components/feedback";
import TopbarProfileMenu from "../components/TopbarProfileMenu";
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

// Attendance/timetable/datesheet removed from student dashboard.

const StudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
<<<<<<< HEAD
=======
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [studentAttendanceOverview, setStudentAttendanceOverview] = useState<any | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const navigate = useNavigate();
   
  // Fetch Student Profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
        if (!token) return;
        const { data } = await axios.get("http://127.0.0.1:8000/api/students/profile/", {
          headers: { Authorization: `Token ${token}` },
        });
        setStudentData(data);
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchStudentAttendanceOverview = async () => {
      if (activeTab !== "Attendance") return;
      try {
        setAttendanceLoading(true);
        const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
        if (!token) return;
        const { data } = await axios.get("http://127.0.0.1:8000/api/attendance/student/overview/", {
          headers: { Authorization: `Token ${token}` },
        });
        setStudentAttendanceOverview(data);
      } catch (err) {
        console.error("Student attendance overview fetch error:", err);
        setStudentAttendanceOverview(null);
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchStudentAttendanceOverview();
  }, [activeTab]);

  // Fetch Analytics Data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
        if (!token) return;
        const { data } = await axios.get("http://127.0.0.1:8000/api/students/analytics/dashboard/", {
          headers: { Authorization: `Token ${token}` },
        });
        setAnalyticsData(data);
        setAttendanceData(data.attendance_data || []);
        setAiFeedback(data.performance_notes || "Your academic insights will appear here soon!");
      } catch (err) {
        console.error("Analytics fetch error:", err);
      }
    };
    fetchAnalytics();
  }, []);

  // Fetch Announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data } = await announcementService.getAllAnnouncements();
        setAnnouncements(data);
      } catch (err) {
        console.error("Error fetching announcements:", err);
      }
    };
    fetchAnnouncements();
  }, []);

  // Fetch Approved Events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const authData = JSON.parse(localStorage.getItem("auth") || "{}");
        const token = authData?.access_token;
        if (!token) return;

        const res = await axios.get("http://127.0.0.1:8000/api/events/", {
          headers: { Authorization: `Token ${token}` },
        });

        console.log("Fetched Events Data:", res.data);
        const allEvents = Array.isArray(res.data)
          ? res.data
          : res.data.results || [];

        const approved = allEvents.filter(
          (event: any) => event.status === "approved"
        );
        setEvents(approved);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();
  }, []);

 
  // Sidebar Menu
  const modules = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { name: "Results", icon: <GraduationCap size={18} /> },
    { name: "Attendance", icon: <CalendarDays size={18} /> },
    { name: "Timetable", icon: <CalendarDays size={18} /> },
    { name: "DateSheet", icon: <CalendarDays size={18} /> },

    { name: "Events", icon: <Megaphone size={18} /> },
    { name: "Announcements", icon: <Bell size={18} /> },
  ];
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Student Panel</h1>
        <p className="text-blue-100 text-sm mt-1">Attendance/timetable/datesheet modules removed.</p>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-gray-100 rounded-xl shadow p-6">
          <p className="text-gray-700">Welcome, {currentUser?.name || 'User'}.</p>
        </div>

        <button
<<<<<<< HEAD
          onClick={logout}
          className="mt-6 w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
=======
  onClick={logout}
  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
>
  Logout
</button>
      </motion.aside>

      {/* Main Dashboard */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-500 p-5 flex justify-between items-center shadow-md">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {activeTab === "Dashboard"
              ? `Welcome, ${studentData?.name} `
              : activeTab}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <TopbarProfileMenu userData={studentData || currentUser} label="Student" />
          </div>
          
        </header>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Dashboard */}
          {activeTab === "Dashboard" && (
            <>
            <motion.div
              className="grid md:grid-cols-2 gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Results Chart */}
              <div
                className={`rounded-2xl shadow-md p-6 ${
                  darkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <h3 className="text-lg font-semibold mb-4 text-blue-600">
                  Semester GPA Trend
                </h3>
                <Bar
                  data={{
                    labels: analyticsData?.gpa_trend?.map((item: any) => item.semester) || ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
                    datasets: [
                      {
                        label: "GPA",
                        data: analyticsData?.gpa_trend?.map((item: any) => item.gpa) || [2.8, 3.2, 3.5, 3.7],
                        backgroundColor: "rgba(99,102,241,0.7)",
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 4,
                        ticks: { stepSize: 0.5 },
                      },
                    },
                  }}
                />
                
              </div>
        
              {/* Attendance Overview */}
              <div
                className={`rounded-2xl shadow-md p-6 ${
                  darkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <h3 className="text-lg font-semibold mb-4 text-blue-600">
                  Attendance Overview
                </h3>
                {attendanceData.length > 0 ? (
                  <div className="space-y-3">
                    {attendanceData.map((course: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{course.course}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {course.present_classes}/{course.total_classes}
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${course.attendance_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold">
                            {course.attendance_percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No attendance data available</p>
                )}
              </div>

              {/* AI Feedback */}
              <div
                className={`md:col-span-2 rounded-2xl shadow-md p-6 ${
                  darkMode ? "bg-gray-800" : "bg-white"
                }`}
              >
                <h3 className="text-lg font-semibold mb-3 text-blue-600">
                  Performance 
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
                  {aiFeedback}
                </p>
              </div>
            </motion.div>
            <div className="fixed bottom-4 right-4 z-50 flex gap-3">
            <FeedbackButton darkMode={darkMode} />
            
          </div>
          </>
          )}
          


          {/* Announcements */}
          {activeTab === "Announcements" && (
            <motion.div
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                📢 Latest Announcements
              </h2>
              {announcements.length > 0 ? (
                announcements.map((a: any, i: number) => (
                  <div
                    key={i}
                    className="border-b border-gray-300 dark:border-gray-700 py-3 mb-3"
                  >
                    <h3 className="text-lg font-bold text-blue-600">{a.title}</h3>
                    <p className="text-sm mt-2 text-gray-600 dark:text-gray-300">
                      {a.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Posted on: {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 dark:text-gray-300">
                  No announcements available.
                </p>
              )}
            </motion.div>
          )}

          {/* Events */}
          {activeTab === "Events" && (
            <motion.div
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                🎉 Approved Events
              </h2>
              {events.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {events.map((event: any, i: number) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl shadow transition-all ${
                        darkMode ? "bg-gray-700" : "bg-gray-50"
                      } hover:shadow-md border-l-4 border-blue-500`}
                    >
                      <h3 className="text-lg font-semibold text-blue-600">
                        {event.title}
                      </h3>
                      <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                        {event.description || "No description available."}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        📅{" "}
                        {event.date
                          ? new Date(event.date).toLocaleDateString()
                          : "N/A"}{" "}
                        {`event.time && 🕒 ${event.time}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-300">
                  No approved events available.
                </p>
              )}
            </motion.div>
            
          )}
        
          {/* Profile */}
{activeTab === "Profile" && (
  <motion.div
    className={`rounded-2xl shadow-lg p-8 max-w-3xl mx-auto transition-all duration-500 ${
      darkMode
        ? "bg-gradient-to-br from-gray-800 to-gray-900"
        : "bg-gradient-to-br from-white to-blue-50"
    }`}
    initial={{ opacity: 0, rotateY: 90 }}
    animate={{ opacity: 1, rotateY: 0 }}
    transition={{ duration: 0.7, ease: "easeOut" }}
    style={{ transformStyle: "preserve-3d" }}
  >
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
        <GraduationCap className="text-blue-500" /> Student Profile
      </h2>
      <span
        className={`px-3 py-1 text-xs rounded-full font-medium ${
          darkMode ? "bg-blue-700 text-white" : "bg-blue-100 text-blue-700"
        }`}
      >
        Reg. No: {studentData?.registration_number || "N/A"}
      </span>
    </div>

    {/* Profile Header */}
    <motion.div
      className="flex flex-col sm:flex-row items-center gap-6 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="relative">
        <img
          src={
            studentData?.image
              ? `http://127.0.0.1:8000${studentData.image}`
              : "https://via.placeholder.com/150"
          }
          alt="Profile"
          className="w-28 h-28 rounded-full border-4 border-blue-500 object-cover shadow-lg"
        />
        <span className="absolute bottom-1 right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></span>
      </div>
      <div className="text-center sm:text-left">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
          {studentData?.name}
        </h3>
        <p className="text-gray-500 text-sm">{studentData?.email}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          🎓 {studentData?.department?.name || "Department"} —{" "}
          {studentData?.semester?.name || "Semester"}
        </p>
      </div>
    </motion.div>

    {/* Animated Info Cards */}
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-5 text-gray-700 dark:text-gray-300`}
    >
      {[
        ["Batch", studentData?.batch],
        ["Date of Birth", studentData?.date_of_birth],
        ["Gender", studentData?.gender],
        ["Blood Group", studentData?.blood_group],
        ["Phone Number", studentData?.phone],
        ["Guardian Name", studentData?.guardian_name],
        ["Guardian Contact", studentData?.guardian_contact],
        ["Residential Address", studentData?.address],
      ].map(([label, value], idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, rotateY: 90 }}
          animate={{ opacity: 1, rotateY: 0 }}
          transition={{ delay: 0.1 * idx, duration: 0.5 }}
          style={{ transformStyle: "preserve-3d" }}
          className={`p-4 rounded-xl border transition-all duration-300 ${
            darkMode
              ? "bg-gray-700 border-gray-600 hover:border-blue-400 hover:shadow-[0_0_10px_#3b82f6]"
              : "bg-white border-gray-200 hover:border-blue-500 hover:shadow-[0_0_12px_#60a5fa]"
          }`}
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;

