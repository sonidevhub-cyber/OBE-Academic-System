import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, PieChart } from 'lucide-react';

interface AnalyticsData {
  gpa_trend?: Array<{ semester: string; gpa: number }>;
  attendance_data?: Array<{ course: string; attendance_percentage: number }>;
  performance_notes?: string;
  stats?: {
    totalStudents?: number;
    totalCourses?: number;
    avgGPA?: number;
    avgAttendance?: number;
  };
}

interface AnalyticsModuleProps {
  token: string;
  userType: 'student' | 'instructor' | 'hod' | 'admin';
  darkMode?: boolean;
}

const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({ 
  token, 
  userType, 
  darkMode = false 
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (userType) {
        case 'student':
          endpoint = 'http://127.0.0.1:8000/api/students/analytics/dashboard/';
          break;
        case 'instructor':
          endpoint = 'http://127.0.0.1:8000/api/instructors/analytics/';
          break;
        case 'hod':
          endpoint = 'http://127.0.0.1:8000/api/hods/analytics/';
          break;
        case 'admin':
          endpoint = 'http://127.0.0.1:8000/api/admin/analytics/';
          break;
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token, userType]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading analytics...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      {analyticsData.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(analyticsData.stats).map(([key, value], index) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg ${
                darkMode ? "bg-gray-800" : "bg-white"
              } shadow-md`}
            >
              <div className="text-2xl font-bold text-blue-600">{value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* GPA Trend Chart */}
        {userType === 'student' && analyticsData.gpa_trend && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-2xl shadow-md p-6 ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <h3 className="text-lg font-semibold mb-4 text-blue-600 flex items-center gap-2">
              <TrendingUp className="text-blue-500" />
              GPA Trend
            </h3>
            <div className="space-y-2">
              {analyticsData.gpa_trend.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{item.semester}</span>
                  <span className="text-lg font-bold text-blue-600">{item.gpa}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Attendance Chart */}
        {analyticsData.attendance_data && analyticsData.attendance_data.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`rounded-2xl shadow-md p-6 ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <h3 className="text-lg font-semibold mb-4 text-blue-600 flex items-center gap-2">
              <PieChart className="text-blue-500" />
              Attendance Overview
            </h3>
            <div className="space-y-3">
              {analyticsData.attendance_data.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{item.course}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${item.attendance_percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold">{item.attendance_percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Insights */}
      {analyticsData.performance_notes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl shadow-md p-6 ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h3 className="text-lg font-semibold mb-3 text-blue-600 flex items-center gap-2">
            <BarChart3 className="text-blue-500" />
            AI Performance Insight 🤖
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
            {analyticsData.performance_notes}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnalyticsModule;