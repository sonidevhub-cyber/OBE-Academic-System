import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';

interface AttendanceRecord {
  id: number;
  course: string;
  date: string;
  status: 'present' | 'absent';
  total_classes: number;
  present_classes: number;
  attendance_percentage: number;
}

interface AttendanceModuleProps {
  token: string;
  userType: 'student' | 'instructor';
  darkMode?: boolean;
  canMark?: boolean;
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({ 
  token, 
  userType, 
  darkMode = false, 
  canMark = false 
}) => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const endpoint = userType === 'student' 
        ? 'http://127.0.0.1:8000/api/students/analytics/dashboard/'
        : 'http://127.0.0.1:8000/api/instructors/attendance/';
        
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data.attendance_data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [token, userType]);

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 85) return 'text-green-600 bg-green-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl shadow-md p-6 ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
          <Calendar className="text-blue-500" />
          Attendance Overview
        </h3>
        <button
          onClick={fetchAttendance}
          disabled={loading}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading attendance...</p>
        </div>
      ) : attendanceData.length > 0 ? (
        <div className="space-y-4">
          {attendanceData.map((record, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border ${
                darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white">
                    {record.course}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {record.present_classes}/{record.total_classes} classes attended
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getAttendanceColor(record.attendance_percentage)
                  }`}>
                    {record.attendance_percentage}%
                  </span>
                  {record.attendance_percentage >= 75 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      record.attendance_percentage >= 85 ? 'bg-green-500' :
                      record.attendance_percentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${record.attendance_percentage}%` }}
                  ></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p>No attendance data available</p>
        </div>
      )}
    </motion.div>
  );
};

export default AttendanceModule;