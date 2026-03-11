import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

// Utility function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const InstructorProfile: React.FC = () => {
  const [instructorData, setInstructorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    coursesTeaching: 0,
    experienceYears: 0
  });
  const [timetable, setTimetable] = useState<any[]>([]);

  useEffect(() => {
    fetchInstructorProfile();
    fetchInstructorTimetable();
  }, []);

  const fetchInstructorProfile = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
      if (!token) return;

      const { data } = await axios.get("http://127.0.0.1:8000/api/instructors/profile/", {
        headers: { Authorization: `Token ${token}` },
      });
      
      setInstructorData(data);
      
      // Fetch additional stats
      const timetableResponse = await axios.get("http://127.0.0.1:8000/api/instructors/timetable/", {
        headers: { Authorization: `Token ${token}` },
      });
      
      const timetables = timetableResponse.data.timetables || [];
      const uniqueCourses = new Set(timetables.map((t: any) => t.course.course_code)).size;
      
      setStats({
        totalClasses: timetables.length,
        totalStudents: 150, // This would come from actual enrollment data
        coursesTeaching: uniqueCourses,
        experienceYears: data.experience_years || 0
      });
      setTimetable(timetables);
      
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructorTimetable = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
      if (!token) return;

      const { data } = await axios.get("http://127.0.0.1:8000/api/instructors/timetable/", {
        headers: { Authorization: `Token ${token}` },
      });
      
      setTimetable(data.timetables || []);
      
    } catch (err) {
      console.error("Timetable fetch error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!instructorData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No instructor profile found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Profile Card */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-20 translate-y-20"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Profile Image */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white">
                <img
                  src={instructorData.image || "https://via.placeholder.com/150"}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-400 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Profile Info */}
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl font-bold mb-2">{instructorData.name}</h1>
              <p className="text-xl opacity-90 mb-1">{instructorData.designation || "Instructor"}</p>
              <p className="text-lg opacity-80 mb-3">{instructorData.department?.name || instructorData.department_name || "Department"}</p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  ID: {instructorData.employee_id}
                </span>
                <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-medium">
                  {stats.experienceYears > 0 ? `${stats.experienceYears}+ Years Experience` : 'New Instructor'}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white bg-opacity-20 rounded-xl p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{stats.totalClasses}</div>
                <div className="text-sm opacity-80">Weekly Classes</div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-xl p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{stats.coursesTeaching}</div>
                <div className="text-sm opacity-80">Courses</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Information
          </h2>
          
          <div className="space-y-4">
            {[
              ["Email", (() => {
                // Try multiple possible email sources
                let email = null;
                
                // Check user object first
                if (instructorData.user && typeof instructorData.user === 'object') {
                  email = instructorData.user.email;
                }
                
                // Fallback to direct email fields
                if (!email) {
                  email = instructorData.email || instructorData.user_email;
                }
                
                // Handle array case and string arrays
                if (Array.isArray(email)) {
                  email = email[0];
                } else if (email && typeof email === 'string' && email.startsWith('[')) {
                  // Handle string that looks like an array: "['email@domain.com']"
                  try {
                    const parsed = JSON.parse(email.replace(/'/g, '"'));
                    email = Array.isArray(parsed) ? parsed[0] : email;
                  } catch {
                    // If JSON parsing fails, extract manually
                    email = email.replace(/[\[\]'"]/g, '');
                  }
                }
                
                // Clean and decode HTML entities if email exists
                if (email && typeof email === 'string') {
                  email = email.replace(/[\[\]'"]/g, '');
                  email = decodeHtmlEntities(email);
                }
                
                return email || "N/A";
              })()],
              ["Phone", instructorData.phone],
              ["Specialization", instructorData.specialization],
              ["Hire Date", instructorData.hire_date ? new Date(instructorData.hire_date).toLocaleDateString() : "N/A"],
              ["Address", instructorData.address]
            ].map(([label, value], idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-600">{label}</span>
                <span className="text-gray-800 text-right max-w-xs truncate">{value || "N/A"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Professional Information */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
            </svg>
            Professional Details
          </h2>
          
          <div className="space-y-4">
            {[
              ["Employee ID", instructorData.employee_id],
              ["Department", instructorData.department?.name || instructorData.department_name],
              ["Designation", instructorData.designation],
              ["Experience", instructorData.experience_years > 0 ? `${instructorData.experience_years} years` : 'New Instructor'],
              ["Status", "Active"]
            ].map(([label, value], idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-600">{label}</span>
                <span className="text-gray-800 font-semibold">{value || "N/A"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Classes", value: stats.totalClasses, color: "from-blue-500 to-blue-600" },
          { label: "Students", value: stats.totalStudents, color: "from-green-500 to-green-600" },
          { label: "Courses", value: stats.coursesTeaching, color: "from-purple-500 to-purple-600" },
          { label: "Experience", value: stats.experienceYears > 0 ? `${stats.experienceYears}Y` : 'New', color: "from-orange-500 to-orange-600" }
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-r ${stat.color} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}
          >
            <div>
              <p className="text-sm opacity-90">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Timetable */}
      {timetable.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            My Teaching Schedule
          </h2>
          
          <div className="grid gap-3">
            {timetable.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                    {entry.day.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{entry.course.name}</h3>
                    <p className="text-sm text-gray-600">{entry.semester?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-indigo-600">{entry.start_time} - {entry.end_time}</p>
                  <p className="text-sm text-gray-500">Room: {entry.room}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">
          Profile last updated on <span className="font-medium text-blue-600">{new Date().toLocaleDateString()}</span>
        </p>
      </div>
    </div>
  );
};

export default InstructorProfile;