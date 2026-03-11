import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { professionalAttendanceService as attendanceService, AttendanceSlot, StudentAttendance } from '../../api/attendanceService';

interface InstructorAttendanceComponentProps {
  className?: string;
}

const InstructorAttendanceComponent: React.FC<InstructorAttendanceComponentProps> = ({ className = '' }) => {
  const [activeSlots, setActiveSlots] = useState<AttendanceSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchActiveSlots();
    const interval = setInterval(fetchActiveSlots, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSlots = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getInstructorActiveSlots();
      setActiveSlots(data.active_slots);
      setCurrentTime(data.current_time);
      setCurrentDay(data.current_day);
      setInstructorName(data.instructor_name);
    } catch (error) {
      console.error('Error fetching active slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (slotIndex: number, studentId: number, status: 'Present' | 'Absent' | 'Late') => {
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

  const submitAttendance = async (slot: AttendanceSlot) => {
    if (!slot.students) return;

    try {
      setSubmitting(true);
      const attendanceData = slot.students.map(student => ({
        student_id: student.student_id,
        status: student.current_status
      }));

      await attendanceService.markStudentAttendance(slot.timetable_id, attendanceData);
      
      // Submit and lock attendance
      await attendanceService.submitAttendance(slot.timetable_id);
      
      // Refresh slots
      await fetchActiveSlots();
      
      alert('Attendance submitted successfully! Faculty attendance auto-marked as Present.');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading active classes...</span>
        </div>
      </div>
    );
  }

  if (activeSlots.length === 0) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Classes</h3>
        <p className="text-gray-600 mb-4">
          You don't have any active classes right now.
        </p>
        <div className="text-sm text-gray-500">
          <p>Current Time: {currentTime}</p>
          <p>Day: {currentDay}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Active Classes - Attendance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Welcome, {instructorName}</p>
            <p className="text-sm text-purple-200">{currentDay} • {currentTime}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">{activeSlots.length} Active Class{activeSlots.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
      </div>

      {/* Active Slots */}
      {activeSlots.map((slot, slotIndex) => (
        <motion.div
          key={slot.timetable_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: slotIndex * 0.1 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          {/* Slot Header */}
          <div className="bg-gray-50 border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {slot.course.name} ({slot.course.code})
                </h3>
                <p className="text-gray-600 mt-1">
                  {slot.department} • {slot.semester} • Room: {slot.room}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Time: {slot.time_slot}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getTimeRemainingColor(slot.time_remaining)}`}>
                  {slot.time_remaining} min left
                </div>
                <div className="text-sm text-gray-500">
                  {slot.students?.length || 0} students
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => markAllPresent(slotIndex)}
                disabled={slot.is_submitted}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Mark All Present
              </button>
              <button
                onClick={() => markAllAbsent(slotIndex)}
                disabled={slot.is_submitted}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Mark All Absent
              </button>
              <button
                onClick={() => submitAttendance(slot)}
                disabled={slot.is_submitted || submitting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {submitting ? 'Submitting...' : slot.is_submitted ? 'Submitted' : 'Submit & Lock'}
              </button>
            </div>

            {slot.is_submitted && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Attendance has been submitted and locked. Contact admin for any changes.
                </p>
              </div>
            )}
          </div>

          {/* Students List */}
          <div className="p-6">
            {slot.students && slot.students.length > 0 ? (
              <div className="grid gap-3">
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
                <p>No students found for this class.</p>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default InstructorAttendanceComponent;