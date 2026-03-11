import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface AttendanceStats {
  totalClasses: number;
  totalStudents: number;
  averageAttendance: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  weeklyTrend: number;
}

interface ClassSummary {
  id: string;
  courseName: string;
  courseCode: string;
  time: string;
  room: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
  status: 'completed' | 'ongoing' | 'upcoming';
}

interface LowAttendanceAlert {
  studentId: string;
  studentName: string;
  courseName: string;
  attendancePercentage: number;
  missedClasses: number;
  severity: 'warning' | 'critical';
}

const AttendanceDashboard: React.FC = () => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [todayClasses, setTodayClasses] = useState<ClassSummary[]>([]);
  const [alerts, setAlerts] = useState<LowAttendanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    // Simulate API calls
    setTimeout(() => {
      setStats({
        totalClasses: 8,
        totalStudents: 156,
        averageAttendance: 87.5,
        presentToday: 142,
        absentToday: 14,
        lateToday: 8,
        weeklyTrend: 2.3
      });

      setTodayClasses([
        {
          id: '1',
          courseName: 'Database Systems',
          courseCode: 'CS-401',
          time: '09:00 - 10:30',
          room: 'Lab-A-201',
          totalStudents: 32,
          presentCount: 28,
          absentCount: 3,
          lateCount: 1,
          attendancePercentage: 90.6,
          status: 'completed'
        },
        {
          id: '2',
          courseName: 'Software Engineering',
          courseCode: 'CS-402',
          time: '11:00 - 12:30',
          room: 'Room-B-105',
          totalStudents: 35,
          presentCount: 31,
          absentCount: 4,
          lateCount: 0,
          attendancePercentage: 88.6,
          status: 'ongoing'
        },
        {
          id: '3',
          courseName: 'Machine Learning',
          courseCode: 'CS-403',
          time: '14:00 - 15:30',
          room: 'Lab-C-301',
          totalStudents: 28,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendancePercentage: 0,
          status: 'upcoming'
        }
      ]);

      setAlerts([
        {
          studentId: 'CS-2020-015',
          studentName: 'Ali Hassan',
          courseName: 'Database Systems',
          attendancePercentage: 68,
          missedClasses: 8,
          severity: 'warning'
        },
        {
          studentId: 'CS-2020-023',
          studentName: 'Sara Ahmed',
          courseName: 'Software Engineering',
          attendancePercentage: 45,
          missedClasses: 12,
          severity: 'critical'
        }
      ]);

      setLoading(false);
    }, 1000);
  };

  const getStatusColor = (status: ClassSummary['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'ongoing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upcoming': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 85) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Attendance Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor and manage class attendance</p>
          </div>
          <div className="flex space-x-2">
            {(['today', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Classes</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalClasses}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CalendarDaysIcon className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <UserGroupIcon className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Attendance</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.averageAttendance}%</p>
                <div className="flex items-center mt-1">
                  {stats && stats.weeklyTrend > 0 ? (
                    <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${stats && stats.weeklyTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats?.weeklyTrend}% from last week
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <ChartBarIcon className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present Today</p>
                <p className="text-3xl font-bold text-green-600">{stats?.presentToday}</p>
                <p className="text-sm text-gray-500">
                  {stats?.absentToday} absent, {stats?.lateToday} late
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Today's Classes */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-lg"
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Today's Classes</h2>
              <p className="text-gray-600">Overview of all classes scheduled for today</p>
            </div>
            <div className="p-6 space-y-4">
              {todayClasses.map((classItem, index) => (
                <motion.div
                  key={classItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{classItem.courseName}</h3>
                      <p className="text-sm text-gray-600">{classItem.courseCode} • {classItem.room}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(classItem.status)}`}>
                        {classItem.status}
                      </span>
                      <div className="flex items-center text-sm text-gray-600">
                        <ClockIcon className="w-4 h-4 mr-1" />
                        {classItem.time}
                      </div>
                    </div>
                  </div>
                  
                  {classItem.status !== 'upcoming' && (
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900">{classItem.totalStudents}</div>
                        <div className="text-xs text-gray-600">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{classItem.presentCount}</div>
                        <div className="text-xs text-gray-600">Present</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">{classItem.absentCount}</div>
                        <div className="text-xs text-gray-600">Absent</div>
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${getAttendanceColor(classItem.attendancePercentage)}`}>
                          {classItem.attendancePercentage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">Attendance</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Alerts Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-lg"
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Attendance Alerts</h2>
              <p className="text-gray-600">Students requiring attention</p>
            </div>
            <div className="p-6 space-y-4">
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.studentId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={`border-l-4 p-4 rounded-r-lg ${
                    alert.severity === 'critical' 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className={`w-5 h-5 mr-2 ${
                        alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{alert.studentName}</p>
                        <p className="text-sm text-gray-600">{alert.studentId}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      alert.severity === 'critical' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.attendancePercentage}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-700">{alert.courseName}</p>
                    <p className="text-xs text-gray-600">Missed {alert.missedClasses} classes</p>
                  </div>
                </motion.div>
              ))}
              
              {alerts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-600">No attendance alerts</p>
                  <p className="text-sm text-gray-500">All students are maintaining good attendance</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Mark Attendance</p>
                  <p className="text-sm text-gray-600">Start marking attendance for current class</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ChartBarIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-600">Generate detailed attendance reports</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <UserGroupIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Student Analytics</p>
                  <p className="text-sm text-gray-600">View individual student attendance patterns</p>
                </div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AttendanceDashboard;