import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Building, Calendar, FileText, Award, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface InstitutionStats {
  total_students: number;
  total_faculty: number;
  total_departments: number;
  overall_attendance_rate: number;
  today_present: number;
  today_absent: number;
  trend_percentage: number;
}

interface DepartmentComparison {
  department_name: string;
  department_code: string;
  student_count: number;
  faculty_count: number;
  attendance_rate: number;
  courses_count: number;
  trend: 'up' | 'down' | 'stable';
  risk_level: 'low' | 'medium' | 'high';
}

interface TopPerformers {
  departments: Array<{
    name: string;
    attendance_rate: number;
    rank: number;
  }>;
  courses: Array<{
    name: string;
    code: string;
    attendance_rate: number;
    instructor: string;
  }>;
  faculty: Array<{
    name: string;
    attendance_rate: number;
    department: string;
  }>;
}

interface PrincipalAttendanceDashboardProps {
  className?: string;
}

const PrincipalAttendanceDashboard: React.FC<PrincipalAttendanceDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'performance'>('overview');
  const [institutionStats, setInstitutionStats] = useState<InstitutionStats | null>(null);
  const [departmentComparison, setDepartmentComparison] = useState<DepartmentComparison[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformers | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30'); // days

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchInstitutionStats();
    } else if (activeTab === 'departments') {
      fetchDepartmentComparison();
    } else if (activeTab === 'performance') {
      fetchTopPerformers();
    }
  }, [activeTab, selectedPeriod]);

  const fetchInstitutionStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/principal/overview/?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInstitutionStats(data);
      } else {
        console.error('Failed to fetch institution stats:', response.status);
      }
    } catch (error) {
      console.error('Error fetching institution stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentComparison = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/principal/departments/?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartmentComparison(data.departments || []);
      } else {
        console.error('Failed to fetch department comparison:', response.status);
      }
    } catch (error) {
      console.error('Error fetching department comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopPerformers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/principal/performers/?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTopPerformers(data);
      } else {
        console.error('Failed to fetch top performers:', response.status);
      }
    } catch (error) {
      console.error('Error fetching top performers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default: return <div className="w-4 h-4 rounded-full bg-gray-400"></div>;
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Institution Attendance Overview</h2>
        <p className="text-blue-100">Comprehensive attendance analytics across all departments</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: 'Institution Overview', icon: BarChart3 },
            { id: 'departments', label: 'Department Comparison', icon: Building },
            { id: 'performance', label: 'Top Performers', icon: Award }
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

      {/* Period Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Period</h3>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Period:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading institution data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && institutionStats && (
            <div className="space-y-6">
              {/* Key Metrics */}
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
                      <p className="text-2xl font-bold text-gray-900">{institutionStats.total_students.toLocaleString()}</p>
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
                      <p className="text-sm font-medium text-gray-600">Overall Attendance</p>
                      <p className="text-2xl font-bold text-green-600">{institutionStats.overall_attendance_rate}%</p>
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
                      <p className="text-sm font-medium text-gray-600">Departments</p>
                      <p className="text-2xl font-bold text-purple-600">{institutionStats.total_departments}</p>
                    </div>
                    <Building className="w-8 h-8 text-purple-600" />
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
                      <p className="text-sm font-medium text-gray-600">Trend</p>
                      <p className={`text-2xl font-bold ${institutionStats.trend_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {institutionStats.trend_percentage >= 0 ? '+' : ''}{institutionStats.trend_percentage}%
                      </p>
                    </div>
                    <TrendingUp className={`w-8 h-8 ${institutionStats.trend_percentage >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
                  </div>
                </motion.div>
              </div>

              {/* Today's Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Institution Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{institutionStats.today_present.toLocaleString()}</div>
                    <div className="text-sm text-green-800">Present</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{institutionStats.today_absent.toLocaleString()}</div>
                    <div className="text-sm text-red-800">Absent</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {institutionStats.total_students > 0
                        ? Math.round((institutionStats.today_present / institutionStats.total_students) * 100)
                        : 0}%
                    </div>
                    <div className="text-sm text-blue-800">Today's Rate</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Faculty Overview</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Faculty</span>
                      <span className="font-semibold">{institutionStats.total_faculty}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Departments</span>
                      <span className="font-semibold">{institutionStats.total_departments}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Indicator</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Target Rate</span>
                      <span className="font-semibold text-green-600">85%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Current Rate</span>
                      <span className={`font-semibold ${institutionStats.overall_attendance_rate >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                        {institutionStats.overall_attendance_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Department Performance Comparison</h3>
                <p className="text-gray-600 text-sm">Compare attendance rates across all departments</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentComparison.map((dept, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{dept.department_name}</div>
                            <div className="text-sm text-gray-500">{dept.department_code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.student_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.faculty_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dept.courses_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            dept.attendance_rate >= 85 ? 'bg-green-100 text-green-800' :
                            dept.attendance_rate >= 75 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {dept.attendance_rate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getTrendIcon(dept.trend)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(dept.risk_level)}`}>
                            {dept.risk_level.charAt(0).toUpperCase() + dept.risk_level.slice(1)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {departmentComparison.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Building className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No department data available.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && topPerformers && (
            <div className="space-y-6">
              {/* Top Departments */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  Top Performing Departments
                </h3>
                <div className="space-y-3">
                  {topPerformers.departments.slice(0, 5).map((dept, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getRankIcon(dept.rank)}</span>
                        <span className="font-medium text-gray-900">{dept.name}</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">{dept.attendance_rate}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Top Courses */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-500" />
                  Top Performing Courses
                </h3>
                <div className="space-y-3">
                  {topPerformers.courses.slice(0, 5).map((course, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{course.name}</div>
                        <div className="text-sm text-gray-500">{course.code} • {course.instructor}</div>
                      </div>
                      <span className="text-lg font-bold text-green-600">{course.attendance_rate}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Top Faculty */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-purple-500" />
                  Top Performing Faculty
                </h3>
                <div className="space-y-3">
                  {topPerformers.faculty.slice(0, 5).map((faculty, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{faculty.name}</div>
                        <div className="text-sm text-gray-500">{faculty.department}</div>
                      </div>
                      <span className="text-lg font-bold text-green-600">{faculty.attendance_rate}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PrincipalAttendanceDashboard;
