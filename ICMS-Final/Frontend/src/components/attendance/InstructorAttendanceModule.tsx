import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { professionalAttendanceService as attendanceService, AttendanceSlot, StudentAttendance } from '../../api/attendanceService';

const InstructorAttendanceModule: React.FC = () => {
  const [activeSlots, setActiveSlots] = useState<AttendanceSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');
  const [instructorName, setInstructorName] = useState('');

  useEffect(() => {
    loadActiveSlots();
    const interval = setInterval(loadActiveSlots, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadActiveSlots = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getInstructorActiveSlots();
      setActiveSlots(data.active_slots);
      setCurrentTime(data.current_time);
      setCurrentDay(data.current_day);
      setInstructorName(data.instructor_name);
    } catch (error) {
      console.error('Error loading active slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (slot: AttendanceSlot) => {
    if (!slot.students) return;
    
    try {
      setSubmitting(true);
      const attendanceData = slot.students.map(student => ({
        student_id: student.student_id,
        status: student.current_status
      }));

      await attendanceService.markStudentAttendance(slot.timetable_id, attendanceData);
      await loadActiveSlots();
      alert('Attendance marked successfully! Your attendance has been auto-marked as Present.');
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAttendance = async (slot: AttendanceSlot) => {
    if (!window.confirm('Submit attendance? This will lock it for editing.')) return;
    
    try {
      setSubmitting(true);
      await attendanceService.submitAttendance(slot.timetable_id);
      await loadActiveSlots();
      alert('Attendance submitted and locked successfully!');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStudentStatus = (slotIndex: number, studentIndex: number, status: string) => {
    const updatedSlots = [...activeSlots];
    if (updatedSlots[slotIndex].students) {
      updatedSlots[slotIndex].students![studentIndex].current_status = status as any;
      setActiveSlots(updatedSlots);
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
            <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
            <p className="text-gray-600">Welcome, {instructorName}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-blue-600">{currentTime}</div>
            <div className="text-sm text-gray-500">{currentDay}</div>
          </div>
        </div>
      </div>

      {/* Active Slots */}
      {activeSlots.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Classes</h3>
          <p className="text-gray-500">You don't have any classes scheduled right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSlots.map((slot, slotIndex) => (
            <motion.div
              key={slot.timetable_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {/* Slot Header */}
              <div className="bg-blue-50 px-6 py-4 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {slot.course.name} ({slot.course.code})
                    </h3>
                    <p className="text-sm text-gray-600">
                      {slot.department} • {slot.semester} • Room: {slot.room}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">{slot.time_slot}</p>
                  </div>
                  <div className="text-right">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      slot.is_submitted 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {slot.is_submitted ? 'Submitted' : `${slot.time_remaining} min left`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Students List */}
              <div className="p-6">
                {slot.students && slot.students.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-gray-900">
                        Students ({slot.students.length})
                      </h4>
                      {slot.can_mark_attendance && (
                        <div className="space-x-2">
                          <button
                            onClick={() => handleMarkAttendance(slot)}
                            disabled={submitting}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            Mark Attendance
                          </button>
                          <button
                            onClick={() => handleSubmitAttendance(slot)}
                            disabled={submitting}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            Submit & Lock
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {slot.students.map((student, studentIndex) => (
                        <div
                          key={student.student_id}
                          className="border rounded-lg p-3 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{student.name}</p>
                              <p className="text-xs text-gray-500">{student.student_id}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              attendanceService.getStatusColor(student.current_status)
                            }`}>
                              {student.current_status}
                            </span>
                          </div>
                          
                          {slot.can_mark_attendance && student.can_edit && (
                            <div className="flex space-x-1">
                              {['Present', 'Absent', 'Late'].map((status) => (
                                <button
                                  key={status}
                                  onClick={() => updateStudentStatus(slotIndex, studentIndex, status)}
                                  className={`flex-1 px-2 py-1 text-xs rounded ${
                                    student.current_status === status
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No students enrolled</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Professional Attendance System</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Attendance can only be marked during your assigned time slots</li>
                <li>Your attendance is automatically marked as "Present" when you mark student attendance</li>
                <li>Once submitted, attendance is locked and requires admin approval to edit</li>
                <li>Time slots are strictly enforced for professional accuracy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorAttendanceModule;