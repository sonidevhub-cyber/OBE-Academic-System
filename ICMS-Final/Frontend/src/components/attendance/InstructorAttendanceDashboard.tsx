import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertTriangle, Lock, Unlock } from 'lucide-react';
import FacultySelfAttendanceComponent from './FacultySelfAttendanceComponent';

interface ClassSlot {
  timetable_id: number;
  course: {
    name: string;
    code: string;
  };
  department: string;
  semester: string;
  room: string;
  time_slot: string;
  day: string;
  students: Student[];
  attendance_marked: boolean;
  is_submitted: boolean;
  time_remaining: number;
}

interface Student {
  student_id: string;
  name: string;
  email: string;
  current_status: 'Present' | 'Absent' | 'Late';
  can_edit: boolean;
}

interface InstructorAttendanceDashboardProps {
  className?: string;
}

const InstructorAttendanceDashboard: React.FC<InstructorAttendanceDashboardProps> = ({ className = '' }) => {
  const [activeView, setActiveView] = useState<'class' | 'self'>('class');
  const [activeSlots, setActiveSlots] = useState<ClassSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<ClassSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchActiveSlots();
    const interval = setInterval(fetchActiveSlots, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSlots = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        console.error('No access token found');
        return;
      }

      const response = await fetch('http://127.0.0.1:8000/api/attendance/instructor/classes/', {
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActiveSlots(data.today_classes || []);
        setCurrentTime(data.current_time || '');
        setCurrentDay(data.current_day || '');
        setInstructorName(data.instructor_name || '');
      } else {
        console.error('Failed to fetch active slots:', response.status);
      }
    } catch (error) {
      console.error('Error fetching active slots:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusChange = (slotIndex: number, studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    setActiveSlots(prev => prev.map((slot, index) => {
      if (index === slotIndex && slot.students) {
        return {
          ...slot,
          students: slot.students.map(student =>
            student.student_id === studentId
              ? { ...student, current_status: status }
              : student
          )
        };
      }
      return slot;
    }));
  };

  const markAllPresent = (slotIndex: number) => {
    setActiveSlots(prev => prev.map((slot, index) => {
      if (index === slotIndex && slot.students) {
        return {
          ...slot,
          students: slot.students.map(student => ({ ...student, current_status: 'Present' as const }))
        };
      }
      return slot;
    }));
  };

  const markAllAbsent = (slotIndex: number) => {
    setActiveSlots(prev => prev.map((slot, index) => {
      if (index === slotIndex && slot.students) {
        return {
          ...slot,
          students: slot.students.map(student => ({ ...student, current_status: 'Absent' as const }))
        };
      }
      return slot;
    }));
  };

  const submitAttendance = async (slot: ClassSlot) => {
    if (!slot.students) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        alert('Authentication error. Please login again.');
        return;
      }

      const attendanceData = slot.students.map(student => ({
        student_id: student.student_id,
        status: student.current_status
      }));

      const response = await fetch('http://127.0.0.1:8000/api/attendance/mark-class/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timetable_id: slot.timetable_id,
          attendance_data: attendanceData,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Attendance submitted successfully! ${result.total_marked} students marked. Instructor attendance auto-marked as Present.`);
        await fetchActiveSlots(); // Refresh the slots
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to submit attendance'}`);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const requestAttendanceUpdate = async (slot: ClassSlot) => {
    const reason = window.prompt('Enter reason for attendance update request to HOD/Coordinator:');
    if (!reason || !reason.trim()) return;

    try {
      const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
      const authData = token ? JSON.parse(token) : null;
      const accessToken = authData?.access_token;

      if (!accessToken) {
        alert('Authentication error. Please login again.');
        return;
      }

      const response = await fetch('http://127.0.0.1:8000/api/attendance/instructor/request-update/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timetable_id: slot.timetable_id,
          date: new Date().toISOString().split('T')[0],
          reason: reason.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result?.error || 'Failed to send update request');
        return;
      }

      alert('Update request sent to HOD/Coordinator successfully.');
    } catch (error) {
      console.error('Error requesting attendance update:', error);
      alert('Failed to send update request.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTimeRemainingColor = (timeRemaining: number) => {
    if (timeRemaining > 30) return 'text-green-600';
    if (timeRemaining > 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && activeView === 'class') {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading active classes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex space-x-1">
          {[
            { id: 'class', label: 'Class Attendance' },
            { id: 'self', label: 'Self Attendance' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as 'class' | 'self')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeView === tab.id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'self' && (
        <FacultySelfAttendanceComponent />
      )}
      {activeView === 'class' && (
      <>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Today's Classes - Attendance</h2>
            <div className="flex items-center space-x-4 text-purple-100">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {currentTime}
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {currentDay}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">Welcome, {instructorName}</p>
            <p className="text-lg font-semibold">{activeSlots.length} Active Class{activeSlots.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
      </div>

      {activeSlots.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Classes Today</h3>
          <p className="text-gray-600 mb-4">
            You don't have any classes scheduled for today.
          </p>
          <div className="text-sm text-gray-500">
            <p>Current Time: {currentTime}</p>
            <p>Day: {currentDay}</p>
          </div>
          <button
            onClick={fetchActiveSlots}
            disabled={refreshing}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      ) : (
        <>
      {/* Active Slots */}
      {activeSlots.map((slot, slotIndex) => (
        <motion.div
          key={slot.timetable_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: slotIndex * 0.1 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
        >
          {/* Slot Header */}
          <div className="bg-gray-50 border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  {slot.course.name} ({slot.course.code})
                </h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Department:</span> {slot.department}</p>
                  <p><span className="font-medium">Semester:</span> {slot.semester}</p>
                  <p><span className="font-medium">Room:</span> {slot.room}</p>
                  <p><span className="font-medium">Time:</span> {slot.time_slot}</p>
                </div>
              </div>
              <div className="text-right ml-6">
                <div className={`text-lg font-semibold mb-2 ${getTimeRemainingColor(slot.time_remaining)}`}>
                  {slot.time_remaining > 0 ? `${slot.time_remaining} min left` : 'Class ended'}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {slot.students?.length || 0} students
                  </div>
                  {slot.is_submitted && (
                    <div className="flex items-center text-green-600">
                      <Lock className="w-4 h-4 mr-1" />
                      Locked
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {!slot.is_submitted && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => markAllPresent(slotIndex)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => markAllAbsent(slotIndex)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                >
                  Mark All Absent
                </button>
                <button
                  onClick={() => submitAttendance(slot)}
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {submitting ? 'Submitting...' : 'Submit & Lock'}
                </button>
              </div>
            )}

            {slot.is_submitted && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Attendance has been submitted and locked. Your attendance was auto-marked as Present.
                </p>
                <button
                  onClick={() => requestAttendanceUpdate(slot)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Request HOD/Coordinator Approval To Update
                </button>
              </div>
            )}

            {slot.attendance_marked && !slot.is_submitted && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Attendance marked but not yet submitted. Please submit to lock the records.
                </p>
              </div>
            )}
          </div>

          {/* Students List */}
          <div className="p-6">
            {slot.students && slot.students.length > 0 ? (
              <div className="space-y-3">
                {slot.students.map((student, studentIndex) => (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: studentIndex * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{student.name}</h4>
                      <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        {(['Present', 'Absent', 'Late'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(slotIndex, student.student_id, status)}
                            disabled={slot.is_submitted || !student.can_edit}
                            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                              student.current_status === status
                                ? getStatusColor(status)
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            } ${
                              slot.is_submitted || !student.can_edit
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>

                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(student.current_status)}`}>
                        {student.current_status}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No students found for this class.</p>
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchActiveSlots}
          disabled={refreshing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Classes'}
        </button>
      </div>
        </>
      )}
      </>
      )}
    </div>
  );
};

export default InstructorAttendanceDashboard;
