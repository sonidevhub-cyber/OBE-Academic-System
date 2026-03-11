import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import professionalAttendanceService, { FacultyAttendanceRecord } from '../../api/professionalAttendanceService';

interface FacultySelfAttendanceProps {
  className?: string;
}

const FacultySelfAttendanceComponent: React.FC<FacultySelfAttendanceProps> = ({ className = '' }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<FacultyAttendanceRecord[]>([]);
  const [statistics, setStatistics] = useState({
    total_days: 0,
    present_days: 0,
    absent_days: 0,
    auto_marked: 0,
    self_marked: 0,
    attendance_percentage: 0
  });
  const [facultyName, setFacultyName] = useState('');
  const [facultyType, setFacultyType] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [todayStatus, setTodayStatus] = useState<'Present' | 'Absent' | 'Late' | null>(null);
  const [todayMarked, setTodayMarked] = useState(false);

  useEffect(() => {
    fetchAttendanceSummary();
  }, []);

  const fetchAttendanceSummary = async () => {
    try {
      setLoading(true);
      const data = await professionalAttendanceService.getFacultyAttendanceSummary();
      setAttendanceRecords(data.attendance_records);
      setStatistics(data.statistics);
      setFacultyName(data.faculty_name);
      setFacultyType(data.faculty_type);
      
      // Check if today's attendance is already marked
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = data.attendance_records.find(record => record.date === today);
      if (todayRecord) {
        setTodayStatus(todayRecord.status as 'Present' | 'Absent' | 'Late');
        setTodayMarked(true);
      }
    } catch (error) {
      console.error('Error fetching attendance summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const markSelfAttendance = async (status: 'Present' | 'Absent' | 'Late') => {
    try {
      setMarking(true);
      await professionalAttendanceService.markSelfAttendance(status);
      setTodayStatus(status);
      setTodayMarked(true);
      
      // Refresh data
      await fetchAttendanceSummary();
      
      alert(`Attendance marked as ${status} successfully!`);
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Failed to mark attendance. Please try again.');
      }
    } finally {
      setMarking(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'Absent':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'Late':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading attendance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Faculty Attendance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100">{facultyName} ({facultyType})</p>
            <p className="text-sm text-indigo-200">Manage your attendance record</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getAttendanceRateColor(statistics.attendance_percentage)}`}>
              {statistics.attendance_percentage.toFixed(1)}%
            </div>
            <p className="text-sm text-indigo-200">Attendance Rate</p>
          </div>
        </div>
      </div>

      {/* Today's Attendance */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Today's Attendance</h3>
        
        {todayMarked ? (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-gray-900 font-medium">Status for {professionalAttendanceService.formatDate(new Date())}</p>
              <p className="text-sm text-gray-600">Already marked for today</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(todayStatus || 'Present')}`}>
              {todayStatus}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">Mark your attendance for {professionalAttendanceService.formatDate(new Date())}</p>
            <div className="flex gap-3">
              {(['Present', 'Absent', 'Late'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => markSelfAttendance(status)}
                  disabled={marking}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    status === 'Present'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : status === 'Absent'
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {marking ? 'Marking...' : `Mark ${status}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Days</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total_days}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Present Days</p>
              <p className="text-2xl font-bold text-green-600">{statistics.present_days}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Absent Days</p>
              <p className="text-2xl font-bold text-red-600">{statistics.absent_days}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Auto Marked</p>
              <p className="text-2xl font-bold text-purple-600">{statistics.auto_marked}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attendance Records */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Recent Attendance Records</h3>
          <p className="text-gray-600 mt-1">Your attendance history for the last 30 days</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marked By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.slice(0, 10).map((record, index) => (
                <motion.tr
                  key={record.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {professionalAttendanceService.formatDate(record.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.auto_marked ? (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 text-purple-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Auto (Teaching)
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Self Marked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {record.marked_at ? new Date(record.marked_at).toLocaleString() : '-'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {attendanceRecords.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No attendance records found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultySelfAttendanceComponent;