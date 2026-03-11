import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Award, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement);

interface AttendanceAnalyticsProps {
  studentId?: string;
  darkMode?: boolean;
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ studentId, darkMode = false }) => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyAttendance, setDailyAttendance] = useState<any>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [showDailyReport, setShowDailyReport] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [studentId]);

  const fetchAnalytics = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      // Try multiple possible endpoints
      const endpoints = [
        'http://127.0.0.1:8000/api/students/analytics/dashboard/',
        'http://127.0.0.1:8000/api/attendance/student/',
        'http://127.0.0.1:8000/api/students/attendance/',
        'http://127.0.0.1:8000/api/attendance/analytics/'
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint);
          const response = await axios.get(endpoint, {
            headers: { Authorization: `Token ${token}` },
          });
          console.log('Response from', endpoint, ':', response.data);
          if (response.data && (response.data.attendance_data || response.data.length > 0)) {
            data = response.data;
            break;
          }
        } catch (endpointError: any) {
          console.log('Endpoint failed:', endpoint, endpointError.response?.status);
          continue;
        }
      }
      
      if (data) {
        // Normalize data structure if needed
        if (Array.isArray(data)) {
          setAnalyticsData({
            attendance_data: data,
            summary_stats: { average_attendance: 0 },
            monthly_attendance: []
          });
        } else {
          setAnalyticsData(data);
        }
      } else {
        console.log('No data found from any endpoint, showing 0% attendance');
        // Show 0% attendance when no data available
        setAnalyticsData({
          summary_stats: {
            average_attendance: 0
          },
          student: {
            gpa: 0
          },
          attendance_data: [],
          monthly_attendance: []
        });
      }
    } catch (error) {
      console.error('Analytics fetch error:', error);
      setAnalyticsData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyAttendance = async (date: string) => {
    setLoadingDaily(true);
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
      if (!token) {
        console.error('No authentication token found');
        setLoadingDaily(false);
        return;
      }

      const endpoint = `http://127.0.0.1:8000/api/students/attendance/daily/?date=${date}`;
      console.log('Fetching daily attendance from:', endpoint);
      
      const { data } = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` },
      });
      
      console.log('Daily attendance data received:', data);
      setDailyAttendance(data);
    } catch (error) {
      console.error('Daily attendance fetch error:', error);
      // Show empty daily data when no data available
      setDailyAttendance({
        date,
        classes: [],
        total_classes: 0,
        present_count: 0,
        absent_count: 0,
        attendance_percentage: 0
      });
    } finally {
      setLoadingDaily(false);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Always show UI, even with 0% data
  if (!analyticsData) {
    // Set default 0% data structure
    setAnalyticsData({
      summary_stats: { average_attendance: 0 },
      student: { gpa: 0 },
      attendance_data: [],
      monthly_attendance: []
    });
  }

  const monthlyChartData = {
    labels: analyticsData.monthly_attendance?.map((item: any) => item.month) || [],
    datasets: [
      {
        label: 'Attendance %',
        data: analyticsData.monthly_attendance?.map((item: any) => item.percentage) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const courseChartData = {
    labels: analyticsData.attendance_data?.map((item: any) => item.course.substring(0, 15)) || [],
    datasets: [
      {
        label: 'Attendance %',
        data: analyticsData.attendance_data?.map((item: any) => item.attendance_percentage) || [],
        backgroundColor: analyticsData.attendance_data?.map((item: any) => 
          item.attendance_percentage >= 80 ? 'rgba(34, 197, 94, 0.7)' :
          item.attendance_percentage >= 60 ? 'rgba(251, 191, 36, 0.7)' : 'rgba(239, 68, 68, 0.7)'
        ) || [],
        borderRadius: 6,
      },
    ],
  };

  const overallAttendance = analyticsData?.summary_stats?.average_attendance || 0;
  const getAttendanceStatus = (percentage: number) => {
    if (percentage >= 80) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Excellent' };
    if (percentage >= 75) return { color: 'text-blue-600', bg: 'bg-blue-100', status: 'Good' };
    if (percentage >= 60) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Warning' };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Critical' };
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-8 ${darkMode ? 'text-white' : 'text-gray-900'}`}
    >
      {/* Header Section */}
      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-blue-50 to-indigo-100'} border ${darkMode ? 'border-gray-700' : 'border-blue-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Calendar className="text-blue-500" size={28} />
            Semester Attendance Records
          </h2>
          <div className={`px-4 py-2 rounded-full ${getAttendanceStatus(overallAttendance).bg} ${getAttendanceStatus(overallAttendance).color} font-semibold`}>
            {getAttendanceStatus(overallAttendance).status}: {overallAttendance}%
          </div>
        </div>
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Complete overview of your attendance across all enrolled courses this semester
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Overall Attendance</h3>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {overallAttendance}%
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={24} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Courses</h3>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {analyticsData?.attendance_data?.length || 0}
              </p>
            </div>
            <CheckCircle className="text-green-500" size={24} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Classes Attended</h3>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {analyticsData?.attendance_data?.reduce((sum: number, course: any) => sum + course.present_classes, 0) || 0}
              </p>
            </div>
            <Clock className="text-purple-500" size={24} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Current GPA</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-1">
                {analyticsData?.student?.gpa || '0.0'}
              </p>
            </div>
            <Award className="text-indigo-500" size={24} />
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
            Monthly Attendance Trend
          </h3>
          <Line 
            data={monthlyChartData}
            options={{
              responsive: true,
              plugins: { 
                legend: { display: false },
                tooltip: {
                  backgroundColor: darkMode ? '#374151' : '#ffffff',
                  titleColor: darkMode ? '#ffffff' : '#000000',
                  bodyColor: darkMode ? '#ffffff' : '#000000',
                  borderColor: '#3b82f6',
                  borderWidth: 1
                }
              },
              scales: {
                y: { 
                  beginAtZero: true, 
                  max: 100,
                  grid: { color: darkMode ? '#374151' : '#e5e7eb' },
                  ticks: { color: darkMode ? '#9ca3af' : '#6b7280' }
                },
                x: {
                  grid: { color: darkMode ? '#374151' : '#e5e7eb' },
                  ticks: { color: darkMode ? '#9ca3af' : '#6b7280' }
                }
              }
            }}
          />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            Course-wise Performance
          </h3>
          <Bar 
            data={courseChartData}
            options={{
              responsive: true,
              plugins: { 
                legend: { display: false },
                tooltip: {
                  backgroundColor: darkMode ? '#374151' : '#ffffff',
                  titleColor: darkMode ? '#ffffff' : '#000000',
                  bodyColor: darkMode ? '#ffffff' : '#000000',
                  borderColor: '#3b82f6',
                  borderWidth: 1
                }
              },
              scales: {
                y: { 
                  beginAtZero: true, 
                  max: 100,
                  grid: { color: darkMode ? '#374151' : '#e5e7eb' },
                  ticks: { color: darkMode ? '#9ca3af' : '#6b7280' }
                },
                x: {
                  grid: { color: darkMode ? '#374151' : '#e5e7eb' },
                  ticks: { color: darkMode ? '#9ca3af' : '#6b7280' }
                }
              }
            }}
          />
        </motion.div>
      </div>

      {/* Detailed Course Records */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
      >
        {/* Report Header */}
        <div className={`px-8 py-6 ${darkMode ? 'bg-gradient-to-r from-gray-700 to-gray-800' : 'bg-gradient-to-r from-blue-600 to-indigo-700'} text-white -m-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">SEMESTER ATTENDANCE REPORT</h3>
              <p className="text-blue-100 text-sm">
                Academic Year 2024-25 | Generated on {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <p className="text-xs text-blue-100">Overall Performance</p>
                <p className="text-2xl font-bold">{overallAttendance}%</p>
              </div>
            </div>
          </div>
        </div>

        <h4 className={`text-lg font-semibold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Course-wise Attendance Analysis</h4>
        
        {/* Professional Report Table */}
        <div className={`overflow-x-auto rounded-lg border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <table className="w-full">
            <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Course Details
                </th>
                <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Present
                </th>
                <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Absent
                </th>
                <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Total
                </th>
                <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Percentage
                </th>
                <th className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody className={`${darkMode ? 'bg-gray-800' : 'bg-white'} divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {analyticsData?.attendance_data?.map((course: any, index: number) => {
                const status = getAttendanceStatus(course.attendance_percentage);
                const absentClasses = course.total_classes - course.present_classes;
                
                return (
                  <motion.tr 
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className={`hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {course.course}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                          <span className="font-medium">Code:</span> {course.course_code || 'N/A'}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="font-medium">Instructor:</span> {course.instructor || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-green-600">{course.present_classes}</span>
                        <CheckCircle size={16} className="text-green-500 mt-1" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-red-600">{absentClasses}</span>
                        {absentClasses > 0 && <AlertTriangle size={16} className="text-red-500 mt-1" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {course.total_classes}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-bold ${status.color}`}>
                          {course.attendance_percentage}%
                        </span>
                        <div className={`w-16 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded-full h-2 mt-2`}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${course.attendance_percentage}%` }}
                            transition={{ duration: 1, delay: 0.2 * index }}
                            className={`h-2 rounded-full ${
                              course.attendance_percentage >= 80 ? 'bg-green-500' :
                              course.attendance_percentage >= 75 ? 'bg-blue-500' :
                              course.attendance_percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          ></motion.div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                        {status.status}
                      </span>
                      {course.attendance_percentage < 75 && (
                        <div className="mt-2">
                          <span className="text-xs text-red-600 font-medium">
                            Need {Math.ceil((75 * course.total_classes / 100) - course.present_classes)} more
                          </span>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Report Summary */}
        <div className={`mt-8 p-6 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} border-l-4 border-blue-500`}>
          <h5 className={`font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Report Summary</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h6 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Performance Analysis:</h6>
              <ul className={`text-sm space-y-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>• Excellent attendance (≥80%): {analyticsData?.attendance_data?.filter((c: any) => c.attendance_percentage >= 80).length || 0} courses</li>
                <li>• Needs attention (&lt;75%): {analyticsData?.attendance_data?.filter((c: any) => c.attendance_percentage < 75).length || 0} courses</li>
                <li>• Overall performance: {getAttendanceStatus(overallAttendance).status}</li>
              </ul>
            </div>
            <div>
              <h6 className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Academic Standing:</h6>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {overallAttendance >= 75 ? (
                  <p className="text-green-600 font-medium">✓ Meeting minimum requirement (75%)</p>
                ) : (
                  <p className="text-red-600 font-medium">⚠ Below minimum requirement (75%)</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {(!analyticsData?.attendance_data || analyticsData.attendance_data.length === 0) && (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              No attendance records found for this semester
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
              Attendance data will appear here once classes begin
            </p>
          </div>
        )}
      </motion.div>

      {/* Daily Attendance Report Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Calendar size={20} className="text-green-500" />
            Daily Attendance Report
          </h3>
          <button
            onClick={() => setShowDailyReport(!showDailyReport)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showDailyReport 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {showDailyReport ? 'Hide Daily Report' : 'Show Daily Report'}
          </button>
        </div>

        {showDailyReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            {/* Date Selection */}
            <div className="flex items-center gap-4">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Select Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className={`px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              />
              <button
                onClick={() => fetchDailyAttendance(selectedDate)}
                disabled={loadingDaily}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingDaily ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle size={16} />
                )}
                Check Attendance
              </button>
            </div>

            {/* Daily Report */}
            {dailyAttendance && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Daily Summary */}
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-blue-500" />
                    Daily Summary - {new Date(dailyAttendance.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h4>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} text-center`}>
                      <p className="text-sm text-gray-500">Total Classes</p>
                      <p className="text-2xl font-bold text-blue-600">{dailyAttendance.total_classes}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} text-center`}>
                      <p className="text-sm text-gray-500">Present</p>
                      <p className="text-2xl font-bold text-green-600">{dailyAttendance.present_count}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} text-center`}>
                      <p className="text-sm text-gray-500">Absent</p>
                      <p className="text-2xl font-bold text-red-600">{dailyAttendance.absent_count}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} text-center`}>
                      <p className="text-sm text-gray-500">Attendance %</p>
                      <p className={`text-2xl font-bold ${
                        dailyAttendance.attendance_percentage >= 80 ? 'text-green-600' :
                        dailyAttendance.attendance_percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {dailyAttendance.attendance_percentage}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Class-wise Details */}
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500" />
                    Class-wise Attendance
                  </h4>
                  
                  {dailyAttendance.classes.map((classItem: any, index: number) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} flex items-center justify-between`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h5 className="font-semibold text-blue-600">{classItem.course}</h5>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            classItem.status === 'present' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {classItem.status === 'present' ? '✓ Present' : '✗ Absent'}
                          </span>
                        </div>
                        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                          <p><strong>Code:</strong> {classItem.course_code} | <strong>Instructor:</strong> {classItem.instructor}</p>
                          <p><strong>Time:</strong> {classItem.time} | <strong>Room:</strong> {classItem.room}</p>
                        </div>
                      </div>
                      <div className="ml-4">
                        {classItem.status === 'present' ? (
                          <CheckCircle size={24} className="text-green-500" />
                        ) : (
                          <AlertTriangle size={24} className="text-red-500" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {dailyAttendance.absent_count > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-red-500" />
                      <h5 className="font-semibold text-red-800">Attendance Alert</h5>
                    </div>
                    <p className="text-sm text-red-700">
                      You missed {dailyAttendance.absent_count} class{dailyAttendance.absent_count > 1 ? 'es' : ''} today. 
                      Regular attendance is important for academic success.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {!dailyAttendance && (
              <div className="text-center py-8">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Select a date to view daily attendance report
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                  Choose a date and click "Check Attendance" to see your daily class attendance
                </p>
              </div>
            )}

            {dailyAttendance && (!dailyAttendance.classes || dailyAttendance.classes.length === 0) && (
              <div className="text-center py-8">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  No classes scheduled for {new Date(selectedDate).toLocaleDateString()}
                </p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                  Try selecting a different date or check if classes were scheduled
                </p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AttendanceAnalytics;