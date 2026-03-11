import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import attendanceService, { FacultyAttendance } from '../../api/attendanceService';

const FacultyAttendanceModule: React.FC = () => {
  const [facultyAttendance, setFacultyAttendance] = useState<FacultyAttendance | null>(null);
  const [facultyType, setFacultyType] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFacultyAttendance();
  }, []);

  const loadFacultyAttendance = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getFacultyAttendanceStatus();
      setFacultyAttendance(data.attendance);
      setFacultyType(data.faculty_type);
      setFacultyName(data.faculty_name);
      setCurrentDate(data.date);
    } catch (error) {
      console.error('Error loading faculty attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (status: 'Present' | 'Absent' | 'Late') => {
    try {
      setSubmitting(true);
      await attendanceService.markFacultyAttendance(status);
      await loadFacultyAttendance();
      alert(`Attendance marked as ${status}`);
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading attendance...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Attendance</h2>
            <p className="text-gray-600">{facultyType}: {facultyName}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-blue-600">
              {new Date(currentDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Current Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                facultyAttendance?.status === 'Not Marked' 
                  ? 'bg-gray-100 text-gray-800'
                  : attendanceService.getStatusColor(facultyAttendance?.status || '')
              }`}>
                {facultyAttendance?.status || 'Not Marked'}
              </span>
            </div>

            {facultyAttendance?.marked_by_system && (
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-green-800">
                  Auto-marked by system (detected teaching activity)
                </span>
              </div>
            )}

            {facultyAttendance?.marked_by_self && (
              <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="h-5 w-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-blue-800">Self-marked attendance</span>
              </div>
            )}

            {facultyAttendance?.marked_at && (
              <div className="text-xs text-gray-500">
                Marked at: {attendanceService.formatDateTime(facultyAttendance.marked_at)}
              </div>
            )}
          </div>

          {/* Mark Attendance */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Mark Your Attendance</h4>
            
            {facultyAttendance?.can_edit ? (
              <div className="space-y-2">
                {['Present', 'Absent', 'Late'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleMarkAttendance(status as any)}
                    disabled={submitting}
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                      facultyAttendance?.status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Mark as {status}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <svg className="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Attendance Locked</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {facultyAttendance?.is_submitted 
                        ? 'Attendance has been submitted and locked. Contact admin to request changes.'
                        : 'Attendance editing is currently disabled.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Attendance Guidelines</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Mark your attendance daily to maintain accurate records</li>
                <li>If you teach classes, your attendance may be auto-marked as "Present"</li>
                <li>You can update your attendance status if needed</li>
                <li>Contact admin if you need to modify submitted attendance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyAttendanceModule;