import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Student {
  id: string;
  name: string;
  email: string;
  weeklyAttendance: {
    [key: string]: 'P' | 'A' | 'L' | 'H';
  };
  semesterPercentage: number;
  semesterStats: string;
  status: 'Present' | 'Absent' | 'Late';
  timetable_id?: number | undefined;
}

interface AttendanceMarkCardProps {
  filters: { departmentId: string; semesterId: string };
}

const AttendanceMarkCard: React.FC<AttendanceMarkCardProps> = ({ filters }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [semesterName, setSemesterName] = useState('');
  const [activeSlot, setActiveSlot] = useState<any>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [slotStatus, setSlotStatus] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [editReason, setEditReason] = useState('');
  const [newStatus, setNewStatus] = useState<'Present' | 'Absent' | 'Late'>('Present');

  // Dynamic week generation based on current date
  const generateWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Get Monday of current week
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    const weekDays = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + (i === 6 ? -1 : i)); // Sunday comes last
      const dayIndex = i === 6 ? 0 : i + 1; // Adjust for Sunday
      
      const isToday = date.toDateString() === today.toDateString();
      const isPast = date < today && !isToday;
      const isFuture = date > today;
      
      weekDays.push({
        day: dayNames[dayIndex],
        date: date.getDate().toString(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        fullDate: date.toISOString().split('T')[0],
        key: `${dayNames[dayIndex]}-${date.getDate()}`,
        isToday,
        isPast,
        isFuture,
        isEditable: isToday || (isPast && date >= new Date(today.getTime() - 24 * 60 * 60 * 1000)) // Today or yesterday
      });
    }
    
    return weekDays;
  };
  
  const [weekDays, setWeekDays] = useState(generateWeekDays());
  
  // Update week days every minute to handle date changes
  useEffect(() => {
    const interval = setInterval(() => {
      setWeekDays(generateWeekDays());
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: 'P' | 'A' | 'L' | 'H') => {
    const baseClass = 'inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ';
    switch (status) {
      case 'P': return baseClass + 'bg-green-100 text-green-700';
      case 'A': return baseClass + 'bg-red-100 text-red-700';
      case 'L': return baseClass + 'bg-yellow-100 text-yellow-700';
      case 'H': return baseClass + 'bg-gray-100 text-gray-500';
      default: return baseClass + 'bg-gray-100 text-gray-400';
    }
  };

  useEffect(() => {
    if (filters.departmentId && filters.semesterId) {
      fetchDepartmentAndSemesterInfo();
      fetchStudents();
    }
  }, [filters.departmentId, filters.semesterId]);

  const fetchDepartmentAndSemesterInfo = async () => {
    try {
      // Fetch department info
      const deptResponse = await fetch(`http://localhost:8000/api/academics/departments/${filters.departmentId}/`);
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartmentName(deptData.name);
      }

      // Fetch semester info
      const semResponse = await fetch(`http://localhost:8000/api/academics/semesters/${filters.semesterId}/`);
      if (semResponse.ok) {
        const semData = await semResponse.json();
        setSemesterName(semData.name);
      }
    } catch (error) {
      console.error('Error fetching department/semester info:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // First fetch instructor's active slots
      const slotsResponse = await fetch('http://localhost:8000/api/academics/attendance/instructor/slots/', {
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        }
      });

      let activeTimetableId: number | null = null;
      // Always allow submission regardless of slots
      setCanSubmit(true);
      setSlotStatus('Ready - You can submit attendance anytime');
      
      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        const currentSlot = slotsData.slots?.find((slot: any) => slot.is_active);
        if (currentSlot) {
          activeTimetableId = currentSlot.timetable_id;
          setActiveSlot(currentSlot);
        }
      }

      const url = `http://localhost:8000/api/students/?department_id=${filters.departmentId}&semester_id=${filters.semesterId}`;
      console.log('Fetching students from:', url);
      console.log('Department ID:', filters.departmentId, 'Semester ID:', filters.semesterId);

      const response = await fetch(url);
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);

        if (Array.isArray(data) && data.length > 0) {
          const formattedStudents = data.map((student: any) => ({
            id: student.student_id,
            name: student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim(),
            email: student.email || 'No email',
            weeklyAttendance: {
              'Mon-27': 'P' as const,
              'Tue-28': 'P' as const,
              'Wed-29': 'P' as const,
              'Thu-30': 'P' as const,
              'Fri-31': 'P' as const,
              'Sat-1': 'H' as const,
              'Sun-2': 'H' as const
            },
            semesterPercentage: student.attendance_percentage || 85,
            semesterStats: '0/0',
            status: 'Present' as const,
            timetable_id: activeTimetableId || undefined
          }));
          console.log('Formatted students:', formattedStudents);
          setStudents(formattedStudents);
        } else {
          console.log('No real students found, showing demo students');
          setStudents([
            {
              id: `demo-${filters.departmentId}-${filters.semesterId}-1`,
              name: `Student from Dept ${filters.departmentId} Sem ${filters.semesterId}`,
              email: 'demo@example.com',
              weeklyAttendance: {
                'Mon-27': 'P' as const,
                'Tue-28': 'P' as const,
                'Wed-29': 'P' as const,
                'Thu-30': 'P' as const,
                'Fri-31': 'P' as const,
                'Sat-1': 'H' as const,
                'Sun-2': 'H' as const
              },
              semesterPercentage: 85,
              semesterStats: '0/0',
              status: 'Present' as const,
              timetable_id: activeTimetableId || undefined
            }
          ]);
        }
      } else {
        console.error('Response not ok:', response.status);
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };



  const updateAttendance = (studentId: string, dayKey: string, status: 'P' | 'A' | 'L') => {
    setStudents(prev => prev.map(student => 
      student.id === studentId 
        ? { 
            ...student, 
            weeklyAttendance: { ...student.weeklyAttendance, [dayKey]: status },
            status: status === 'P' ? 'Present' : status === 'A' ? 'Absent' : 'Late'
          }
        : student
    ));
  };

  const markAllPresent = () => {
    const editableDay = weekDays.find(d => d.isToday);
    if (editableDay) {
      setStudents(prev => prev.map(student => ({
        ...student,
        weeklyAttendance: { ...student.weeklyAttendance, [editableDay.key]: 'P' },
        status: 'Present' as const
      })));
    }
  };

  const markAllAbsent = () => {
    const editableDay = weekDays.find(d => d.isToday);
    if (editableDay) {
      setStudents(prev => prev.map(student => ({
        ...student,
        weeklyAttendance: { ...student.weeklyAttendance, [editableDay.key]: 'A' },
        status: 'Absent' as const
      })));
    }
  };

  const submitAttendance = async () => {
    if (students.length === 0) return;

    try {
      const validStudents = students.filter(student => student.id && student.id.trim() !== '');
      
      if (validStudents.length === 0) {
        alert('No valid students found to mark attendance');
        return;
      }
      
      const attendanceData = validStudents.map(student => ({
        student_id: student.id,
        status: student.status || 'Present'
      }));
      
      console.log('Submit attendance data:', attendanceData);

      const response = await fetch('http://127.0.0.1:8000/api/instructors/attendance/test-bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          attendances: attendanceData
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
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
    if (students.length === 0) return;

    try {
      // First mark attendance - filter out students with blank IDs
      const validStudents = students.filter(student => student.id && student.id.trim() !== '');
      
      if (validStudents.length === 0) {
        alert('No valid students found to mark attendance');
        return;
      }
      
      const attendanceData = validStudents.map(student => ({
        student_id: student.id,
        status: student.status || 'Present'
      }));
      
      console.log('Attendance data:', attendanceData);

      const markResponse = await fetch('http://127.0.0.1:8000/api/instructors/attendance/test-bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          attendances: attendanceData
        })
      });

      if (!markResponse.ok) {
        const error = await markResponse.json();
        alert(`Error marking attendance: ${error.error}`);
        return;
      }

      // Then submit/lock attendance
      const submitResponse = await fetch('http://127.0.0.1:8000/api/instructors/attendance/test-submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (submitResponse.ok) {
        alert('Attendance marked and finalized! Admin permission required for further edits.');
        setStudents([]);
      } else {
        const error = await submitResponse.json();
        alert(`Error finalizing: ${error.error}`);
      }
    } catch (error) {
      console.error('Error finalizing attendance:', error);
    }
  };





  if (!filters.departmentId || !filters.semesterId) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Select Department & Semester</h3>
        <p className="text-gray-600">Choose a department and semester to view students</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading students...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div 
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">Weekly Attendance Register</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 mb-1">{departmentName} – {semesterName}</p>
              <p className="text-sm text-purple-200">Current Week ({students.length} students)</p>
              {activeSlot && (
                <p className="text-sm text-purple-200">
                  Slot: {activeSlot.start_time} - {activeSlot.end_time} | Status: {slotStatus}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={markAllPresent}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                Mark All Present
              </button>
              <button
                onClick={markAllAbsent}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                Mark All Absent
              </button>
              <button
                onClick={finalizeAttendance}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  canSubmit 
                    ? 'bg-purple-500 text-white hover:bg-purple-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={slotStatus}
              >
                Submit and Lock
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
              >
                Request Edit
              </button>

            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[250px]">Student Details</th>
                  {weekDays.map(day => (
                    <th key={day.key} className="text-center py-3 px-2 font-semibold text-gray-700 min-w-[80px]">
                      <div className="text-sm">{day.day}</div>
                      <div className="text-xs text-gray-500">{day.month} {day.date}</div>
                      {day.isToday && <div className="text-xs text-blue-600 font-bold">TODAY</div>}
                      {day.isPast && <div className="text-xs text-gray-400">Past</div>}
                      {day.isFuture && <div className="text-xs text-orange-500">Future</div>}
                    </th>
                  ))}
                  <th className="text-center py-3 px-4 font-semibold text-gray-900 min-w-[100px]">Semester %</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4 bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-600">ID: {student.id}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                    </td>
                    {weekDays.map(day => (
                      <td key={day.key} className="py-4 px-2 text-center">
                        {day.isEditable ? (
                          <div className="flex items-center justify-center">
                            <select
                              value={student.weeklyAttendance[day.key] || 'P'}
                              onChange={(e) => updateAttendance(student.id, day.key, e.target.value as 'P' | 'A' | 'L')}
                              className={`w-12 h-8 text-xs font-bold border rounded focus:ring-2 focus:border-transparent ${
                                day.isToday 
                                  ? 'border-blue-500 bg-blue-50 focus:ring-blue-500' 
                                  : 'border-gray-300 focus:ring-gray-500'
                              }`}
                              disabled={day.isFuture}
                            >
                              <option value="P">P</option>
                              <option value="A">A</option>
                              <option value="L">L</option>
                            </select>

                          </div>
                        ) : (
                          <span className={`${getStatusBadge(student.weeklyAttendance[day.key])} ${
                            day.isFuture ? 'opacity-50' : ''
                          }`}>
                            {day.isFuture ? '-' : (student.weeklyAttendance[day.key] || 'P')}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {student.semesterPercentage}% ({student.semesterStats})
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>


        </div>
      </motion.div>

      {/* Professional Edit Request Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Request Attendance Edit</h3>
            
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="editType"
                    value="single"
                    checked={selectedStudentForEdit !== null}
                    onChange={() => setSelectedStudentForEdit(students[0] || null)}
                    className="mr-2"
                  />
                  Edit Single Student
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="editType"
                    value="bulk"
                    checked={selectedStudentForEdit === null}
                    onChange={() => setSelectedStudentForEdit(null)}
                    className="mr-2"
                  />
                  Bulk Edit Request
                </label>
              </div>
            </div>

            {selectedStudentForEdit ? (
              /* Single Student Edit */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Student</label>
                  <select
                    value={selectedStudentForEdit.id}
                    onChange={(e) => {
                      const student = students.find(s => s.id === e.target.value);
                      setSelectedStudentForEdit(student || null);
                      setNewStatus(student?.status || 'Present');
                    }}
                    className="w-full p-2 border rounded"
                  >
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} - Current: {student.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'Present' | 'Absent' | 'Late')}
                    className="w-full p-2 border rounded"
                  >
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Late">Late</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reason for Change</label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Please provide a detailed reason for this attendance change..."
                    rows={3}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>
            ) : (
              /* Bulk Edit Request */
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Bulk Edit Request</h4>
                  <p className="text-sm text-blue-700">Request permission to edit attendance for multiple students or the entire class.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Request Type</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'Present' | 'Absent' | 'Late')}
                    className="w-full p-2 border rounded"
                  >
                    <option value="Present">Mark All Present</option>
                    <option value="Absent">Mark All Absent</option>
                    <option value="Late">Mark All Late</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Reason for Bulk Change</label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Please provide a detailed reason for this bulk attendance change (e.g., technical issues, emergency, etc.)..."
                    rows={4}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditReason('');
                  setSelectedStudentForEdit(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editReason.trim()) {
                    alert('Please provide a reason for the edit request');
                    return;
                  }
                  
                  try {
                    const requestData = selectedStudentForEdit ? {
                      type: 'single',
                      student_id: selectedStudentForEdit.id,
                      student_name: selectedStudentForEdit.name,
                      current_status: selectedStudentForEdit.status,
                      proposed_status: newStatus,
                      reason: editReason,
                      date: new Date().toISOString().split('T')[0]
                    } : {
                      type: 'bulk',
                      student_count: students.length,
                      proposed_status: newStatus,
                      reason: editReason,
                      date: new Date().toISOString().split('T')[0],
                      students: students.map(s => ({ id: s.id, name: s.name, current_status: s.status }))
                    };

                    const response = await fetch('http://127.0.0.1:8000/api/academics/attendance/edit-request/', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
                      },
                      body: JSON.stringify(requestData)
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      alert(`Edit request submitted successfully! Request ID: ${result.request_id || 'N/A'}`);
                      setShowEditModal(false);
                      setEditReason('');
                      setSelectedStudentForEdit(null);
                    } else {
                      const error = await response.json();
                      alert(`Error: ${error.error || 'Failed to submit request'}`);
                    }
                  } catch (error) {
                    console.error('Error submitting edit request:', error);
                    alert('Failed to submit edit request. Please try again.');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Submit Request to Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceMarkCard;