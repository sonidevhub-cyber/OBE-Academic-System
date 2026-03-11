import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AttendanceMarkCard from './AttendanceMarkCard';
import AttendanceReportCard from './AttendanceReportCard';
import AttendanceMonitoringCard from './AttendanceMonitoringCard';

interface AttendanceCardsProps {
  onCardSelect?: (cardType: string) => void;
}

const AttendanceCards: React.FC<AttendanceCardsProps> = ({ onCardSelect }) => {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [stats, setStats] = useState({
    totalStudents: 0,
    monthlyReports: 10,
    averageAttendance: 0
  });

  useEffect(() => {
    if (selectedDepartment && selectedSemester) {
      fetchStudentCount();
    }
  }, [selectedDepartment, selectedSemester]);

  // Removed useEffect for fetchSemestersByDepartment since we now get all data from instructor endpoint

  const fetchSemestersByDepartment = async () => {
    try {
      const storedAuth = localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;
      
      // Use instructor dashboard data endpoint for consistent data
      const response = await fetch('http://localhost:8000/api/instructors/dashboard-data/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Semesters for instructor department:', data.semesters);
        setSemesters(data.semesters);
      } else {
        console.error('Failed to fetch semesters for instructor:', response.status);
        setSemesters([]);
      }
    } catch (error) {
      console.error('Error fetching semesters for instructor:', error);
      setSemesters([]);
    }
  };

  const fetchStudentCount = async () => {
    try {
      const storedAuth = localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;
      
      const response = await fetch(`http://localhost:8000/api/students/?department_id=${selectedDepartment}&semester_id=${selectedSemester}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(prev => ({ ...prev, totalStudents: data.length }));
      }
    } catch (error) {
      console.error('Error fetching student count:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const storedAuth = localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;
      
      // Fetch instructor's dashboard data (department, semesters, courses)
      const dashboardResponse = await fetch('http://localhost:8000/api/instructors/dashboard-data/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        console.log('Instructor dashboard data:', dashboardData);
        
        // Set the instructor's department as the only option
        if (dashboardData.department) {
          setDepartments([dashboardData.department]);
          setSelectedDepartment(dashboardData.department.department_id.toString());
        }
        
        // Set semesters for the instructor's department
        if (dashboardData.semesters) {
          setSemesters(dashboardData.semesters);
        }
      } else {
        console.error('Failed to fetch instructor dashboard data:', dashboardResponse.status);
        // Fallback to original method
        try {
          const deptResponse = await fetch('http://localhost:8000/api/academics/departments/');
          if (deptResponse.ok) {
            const deptData = await deptResponse.json();
            console.log('Fallback departments:', deptData);
            setDepartments(deptData);
          }
          // Also try to fetch all semesters as fallback
          const semResponse = await fetch('http://localhost:8000/api/academics/semesters/');
          if (semResponse.ok) {
            const semData = await semResponse.json();
            console.log('Fallback semesters:', semData);
            setSemesters(semData);
          }
        } catch (fallbackError) {
          console.error('Fallback fetch failed:', fallbackError);
        }
      }

      // Fetch stats
      setStats({
        totalStudents: 1,
        monthlyReports: 10,
        averageAttendance: 85
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleCardClick = (cardType: string) => {
    setActiveSection(cardType);
    onCardSelect?.(cardType);
  };

  const handleBack = () => {
    setSelectedCard(null);
  };

  if (selectedCard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            {selectedCard === 'mark' && 'Mark Attendance'}
            {selectedCard === 'qr' && 'QR Attendance'}
            {selectedCard === 'report' && 'Attendance Reports'}
            {selectedCard === 'analytics' && 'Analytics'}
          </h2>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
        </div>
        
        <div>
          {selectedCard === 'mark' && <AttendanceMarkCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />}
          {selectedCard === 'report' && <AttendanceReportCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />}
          {selectedCard === 'analytics' && <AttendanceMonitoringCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />}
          {selectedCard === 'qr' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">QR Code Attendance</h3>
              <p className="text-gray-600">QR-based attendance scanning feature coming soon...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance Management System</h1>
          <p className="text-gray-600">Comprehensive attendance tracking & analytics platform</p>
        </div>

        {/* Department & Semester Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Department & Semester Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              >
                <option value="">Select Department</option>
                {departments.length === 0 ? (
                  <option disabled>No departments found</option>
                ) : (
                  departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              >
                <option value="">{selectedDepartment ? 'Select Semester' : 'Select Department First'}</option>
                {semesters.map((sem) => (
                  <option key={sem.semester_id} value={sem.semester_id}>
                    {sem.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Mark Attendance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => handleCardClick('mark')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mark Attendance</h3>
            <p className="text-gray-600 text-sm mb-4">Daily attendance marking</p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                {stats.totalStudents} {stats.totalStudents === 1 ? 'Student' : 'Students'}
              </span>
            </div>
          </motion.div>

          {/* QR Attendance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => handleCardClick('qr')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Attendance</h3>
            <p className="text-gray-600 text-sm mb-4">Quick QR-based attendance scanning</p>
          </motion.div>

          {/* Attendance Reports */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => handleCardClick('report')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 2v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Attendance Reports</h3>
            <p className="text-gray-600 text-sm mb-4">View monthly attendance reports</p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                {stats.monthlyReports} Month
              </span>
            </div>
          </motion.div>

          {/* Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => handleCardClick('analytics')}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-gray-600 text-sm mb-4">Attendance insights & trends</p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                {stats.averageAttendance}% Average
              </span>
            </div>
          </motion.div>
        </div>

        {/* Active Section - Shows below cards */}
        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {activeSection === 'mark' && 'Mark Attendance'}
                {activeSection === 'qr' && 'QR Attendance'}
                {activeSection === 'report' && 'Attendance Reports'}
                {activeSection === 'analytics' && 'Analytics'}
              </h2>
              <button
                onClick={() => setActiveSection(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Hide
              </button>
            </div>
            
            {activeSection === 'mark' && (
              <AttendanceMarkCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />
            )}
            
            {activeSection === 'qr' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">QR Code Attendance</h3>
                <p className="text-gray-600 mb-6">Scan QR codes for quick attendance marking</p>
                <div className="bg-gray-100 p-8 rounded-lg">
                  <p className="text-gray-500">QR Scanner functionality would be implemented here</p>
                </div>
              </div>
            )}
            
            {activeSection === 'report' && (
              <AttendanceReportCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />
            )}
            
            {activeSection === 'analytics' && (
              <AttendanceMonitoringCard filters={{ departmentId: selectedDepartment, semesterId: selectedSemester }} />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCards;