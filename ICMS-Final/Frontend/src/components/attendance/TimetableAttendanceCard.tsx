import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TimetableSlot {
  timetable_id: number;
  course: {
    id: number;
    name: string;
    code: string;
  };
  department: string;
  semester: string;
  time_slot: string;
  room: string;
  students_count: number;
  can_mark_attendance: boolean;
  is_submitted?: boolean;
  time_remaining?: number;
}

interface Student {
  student_id: string;
  name: string;
  email: string;
  status: 'Present' | 'Absent' | 'Late';
  is_marked?: boolean;
  can_edit?: boolean;
}

const TimetableAttendanceCard: React.FC = () => {
  const [activeSlots, setActiveSlots] = useState<TimetableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');

  useEffect(() => {
    fetchActiveSlots();
    const interval = setInterval(fetchActiveSlots, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchActiveSlots = async () => {
    try {
      const instructorId = localStorage.getItem('instructor_id') || '1';
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:8000/api/academics/attendance/timetable/active/?instructor_id=${instructorId}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveSlots(data.active_slots);
        setCurrentTime(data.current_time);
        setCurrentDay(data.current_day);
        
        if (data.message) {
          console.log('Info:', data.message);
        }
      } else {
        const error = await response.json();
        console.error('Error fetching active slots:', error.error);
      }
    } catch (error) {
      console.error('Error fetching active slots:', error);
    }
  };

  const fetchStudentsForSlot = async (slot: TimetableSlot) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:8000/api/academics/attendance/timetable/${slot.timetable_id}/students/`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedStudents = data.students.map((student: any) => ({
          student_id: student.student_id,
          name: student.name,
          email: student.email,
          status: student.current_status as 'Present' | 'Absent' | 'Late',
          is_marked: student.is_marked,
          can_edit: student.can_edit
        }));
        setStudents(formattedStudents);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      alert('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot: TimetableSlot) => {
    setSelectedSlot(slot);
    fetchStudentsForSlot(slot);
  };

  const updateStudentStatus = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    setStudents(prev => prev.map(student => 
      student.student_id === studentId ? { ...student, status } : student
    ));
  };

  const markAllPresent = () => {
    setStudents(prev => prev.map(student => ({ ...student, status: 'Present' as const })));
  };

  const markAllAbsent = () => {
    setStudents(prev => prev.map(student => ({ ...student, status: 'Absent' as const })));
  };

  const submitAttendance = async () => {
    if (!selectedSlot) return;

    try {
      const instructorId = localStorage.getItem('instructor_id') || '1';
      const token = localStorage.getItem('authToken');
      const attendanceData = students.map(student => ({
        student_id: student.student_id,
        status: student.status
      }));

      const response = await fetch('http://localhost:8000/api/academics/attendance/timetable/mark/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timetable_id: selectedSlot.timetable_id,
          instructor_id: instructorId,
          attendance_data: attendanceData
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Attendance saved successfully!');
        if (result.warnings && result.warnings.length > 0) {
          alert('Warnings:\n' + result.warnings.join('\n'));
        }
        // Refresh students data
        fetchStudentsForSlot(selectedSlot);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance');
    }
  };

  const finalizeAttendance = async () => {
    if (!selectedSlot) return;

    if (!window.confirm('Are you sure you want to finalize attendance? This will lock all records and require admin approval for any changes.')) {
      return;
    }

    try {
      const instructorId = localStorage.getItem('instructor_id') || '1';
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:8000/api/academics/attendance/timetable/submit/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timetable_id: selectedSlot.timetable_id,
          instructor_id: instructorId
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedSlot(null);
        fetchActiveSlots();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error finalizing attendance:', error);
      alert('Failed to finalize attendance');
    }
  };

  if (activeSlots.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Classes</h3>
        <p className="text-gray-600">You don't have any active classes right now.</p>
        <p className="text-sm text-gray-500 mt-2">Current time: {currentTime} ({currentDay})</p>
        <p className="text-xs text-gray-400 mt-1">Attendance can only be marked during assigned time slots</p>
      </div>
    );
  }

  if (selectedSlot) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedSlot.course.name}</h2>
            <p className="text-gray-600">{selectedSlot.department} - {selectedSlot.semester}</p>
            <p className="text-sm text-gray-500">{selectedSlot.time_slot} | Room: {selectedSlot.room}</p>
          </div>
          <button
            onClick={() => setSelectedSlot(null)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back to Classes
          </button>
        </div>

        <motion.div 
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Mark Attendance</h3>
                <p className="text-blue-100">{students.length} students enrolled</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={markAllPresent}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  Mark All Present
                </button>
                <button
                  onClick={markAllAbsent}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                  Mark All Absent
                </button>
                <button
                  onClick={submitAttendance}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  Save Attendance
                </button>
                <button
                  onClick={finalizeAttendance}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-semibold"
                >
                  🔒 Finalize & Lock
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading students...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Student</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <motion.tr
                        key={student.student_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <select
                              value={student.status}
                              onChange={(e) => updateStudentStatus(student.student_id, e.target.value as 'Present' | 'Absent' | 'Late')}
                              disabled={student.can_edit === false}
                              className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                student.can_edit === false ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                            >
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="Late">Late</option>
                            </select>
                            {student.is_marked && (
                              <span className="text-xs text-green-600 font-medium">✓</span>
                            )}
                            {student.can_edit === false && (
                              <span className="text-xs text-gray-500">🔒</span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Classes</h2>
        <p className="text-gray-600">Current time: {currentTime} ({currentDay})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSlots.map((slot, index) => (
          <motion.div
            key={slot.timetable_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => slot.can_mark_attendance && handleSlotSelect(slot)}
            className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-200 border border-gray-100 ${
              slot.can_mark_attendance 
                ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' 
                : 'cursor-not-allowed opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  slot.is_submitted 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {slot.is_submitted ? 'Submitted' : 'Active Now'}
                </span>
                {slot.time_remaining !== undefined && slot.time_remaining > 0 && (
                  <span className="text-xs text-gray-500">
                    {slot.time_remaining}min left
                  </span>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{slot.course.name}</h3>
            <p className="text-sm text-gray-600 mb-1">{slot.course.code}</p>
            <p className="text-sm text-gray-600 mb-2">{slot.department} - {slot.semester}</p>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{slot.time_slot}</span>
              <span>{slot.students_count} students</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Room: {slot.room}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TimetableAttendanceCard;