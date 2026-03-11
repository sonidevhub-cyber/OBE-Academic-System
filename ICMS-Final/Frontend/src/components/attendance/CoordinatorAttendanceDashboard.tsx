import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, TrendingUp, BarChart3, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface AttendanceStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  attendance_rate: number;
  department_name: string;
}

interface CourseAttendance {
  course_name: string;
  course_code: string;
  instructor_name: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;
}

interface FacultyAttendance {
  faculty_name: string;
  faculty_type: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  attendance_percentage: number;
  last_attendance: string;
}

interface CoordinatorAttendanceDashboardProps {
  className?: string;
}

const CoordinatorAttendanceDashboard: React.FC<CoordinatorAttendanceDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'faculty'>('overview');
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [courseAttendance, setCourseAttendance] = useState<CourseAttendance[]>([]);
  const [facultyAttendance, setFacultyAttendance] = useState<FacultyAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOverviewStats();
    } else if (activeTab === 'reports') {
      fetchCourseReports();
    } else if (activeTab === 'faculty') {
      fetchFacultyAttendance();
    }
  }, [activeTab, selectedDate, dateRange]);

  const fetchOverviewStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/coordinator/overview/?date=${selectedDate}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch overview stats:', response.status);
      }
    } catch (error) {
      console.error('Error fetching overview stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/coordinator/courses/?start_date=${dateRange.start}&end_date=${dateRange.end}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCourseAttendance(data.courses || []);
      } else {
        console.error('Failed to fetch course reports:', response.status);
      }
    } catch (error) {
      console.error('Error fetching course reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacultyAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/coordinator/faculty/?start_date=${dateRange.start}&end_date=${dateRange.end}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFacultyAttendance(data.faculty || []);
      } else {
        console.error('Failed to fetch faculty attendance:', response.status);
      }
    } catch (error) {
      console.error('Error fetching faculty attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 85) return 'text-green-600 bg-green-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 85) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (percentage >= 75) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Department Attendance Management</h2>
        <p className="text-blue-100">Monitor and analyze attendance across your department</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: 'Today\'s Overview', icon: BarChart3 },
            { id: 'reports', label: 'Course Reports', icon: FileText },
            { id: 'faculty', label: 'Faculty Attendance', icon: Users }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Date Range</h3>
          <div className="flex space-x-4">
            {activeTab === 'overview' ? (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">From:</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading attendance data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Students</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.total_students}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Present Today</p>
                      <p className="text-2xl font-bold text-green-600">{stats.present_today}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Absent Today</p>
                      <p className="text-2xl font-bold text-red-600">{stats.absent_today}</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.attendance_rate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </motion.div>
              </div>

              {/* Department Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Summary - {stats.department_name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{stats.present_today}</div>
                    <div className="text-sm text-green-800">Present</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{stats.absent_today}</div>
                    <div className="text-sm text-red-800">Absent</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">{stats.late_today}</div>
                    <div className="text-sm text-yellow-800">Late</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Course-wise Attendance Reports</h3>
                <p className="text-gray-600 text-sm">Attendance statistics for each course in your department</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courseAttendance.map((course, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{course.course_name}</div>
                            <div className="text-sm text-gray-500">{course.course_code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.instructor_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.total_classes}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{course.present_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{course.absent_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAttendanceColor(course.attendance_percentage)}`}>
                            {course.attendance_percentage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusIcon(course.attendance_percentage)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {courseAttendance.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No course attendance data available for the selected period.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Faculty Tab */}
          {activeTab === 'faculty' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Faculty Attendance Overview</h3>
                <p className="text-gray-600 text-sm">Attendance records for all faculty members in your department</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty Member</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {facultyAttendance.map((faculty, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{faculty.faculty_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                            {faculty.faculty_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{faculty.total_days}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{faculty.present_days}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{faculty.absent_days}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAttendanceColor(faculty.attendance_percentage)}`}>
                            {faculty.attendance_percentage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {faculty.last_attendance ? new Date(faculty.last_attendance).toLocaleDateString() : 'N/A'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {facultyAttendance.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No faculty attendance data available for the selected period.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CoordinatorAttendanceDashboard;
