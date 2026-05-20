import React, { useState, useEffect } from 'react';
import { instructorAttendanceService, Department, Semester, Student, BulkAttendanceRequest } from '../api/instructorAttendanceService';

const AttendanceManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [attendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatuses, setAttendanceStatuses] = useState<{ [key: string]: 'Present' | 'Absent' | 'Late' }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [canSubmitNow, setCanSubmitNow] = useState(true);
  const [hasSlotsToday, setHasSlotsToday] = useState(true);

  useEffect(() => {
    fetchDepartments();
    checkTodayStatus();
  }, []);

  const checkTodayStatus = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/instructors/attendance/test-status/?date=${attendanceDate}`, {
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status check response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Status data:', data);
        setIsSubmitted(data.is_submitted);
        setCanEdit(true); // Always allow editing
        setCanSubmitNow(true); // Force enable for testing
        setHasSlotsToday(true); // Force enable for testing
      } else {
        console.error('Status check failed:', response.status);
        // Force enable even if API fails
        setIsSubmitted(false);
        setCanEdit(true);
        setCanSubmitNow(true);
        setHasSlotsToday(true);
      }
    } catch (error) {
      console.error('Error checking today status:', error);
    }
  };

  const submitTodayAttendance = async () => {
    if (!window.confirm('Submit attendance? This will lock the records and cannot be undone without admin approval.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://127.0.0.1:8000/api/instructors/attendance/test-submit/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: attendanceDate })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message);
        setIsSubmitted(true);
        setCanEdit(false);
      } else {
        const error = await response.json();
        setError(error.error);
      }
    } catch (error) {
      setError('Failed to submit attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDepartment) {
      const deptId = parseInt(selectedDepartment);
      if (!isNaN(deptId)) {
        fetchSemesters(deptId);
      }
      setSelectedSemester(null);
      setStudents([]);
      setAttendanceStatuses({});
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment && selectedSemester) {
      const deptId = parseInt(selectedDepartment);
      if (!isNaN(deptId)) {
        fetchStudents(deptId, selectedSemester);
      }
    }
  }, [selectedDepartment, selectedSemester]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getDepartments();
      console.log('Fetched departments:', response);
      setDepartments(Array.isArray(response) ? response : (response as any).results || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching departments:', err);
      setError('Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchSemesters = async (departmentId: number) => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getSemestersByDepartment(departmentId);
      console.log('Fetched semesters:', response);
      setSemesters(Array.isArray(response) ? response : (response as any).results || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching semesters:', err);
      setError('Failed to fetch semesters');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (departmentId: number, semesterId: number) => {
    try {
      setLoading(true);
      const response = await instructorAttendanceService.getStudentsByDepartmentAndSemester(departmentId, semesterId);
      console.log('Fetched students:', response);
      const studentList = Array.isArray(response) ? response : (response as any).results || [];
      setStudents(studentList);

      // Initialize attendance statuses to 'Present' for all students
      const initialStatuses: { [key: string]: 'Present' | 'Absent' | 'Late' } = {};
      studentList.forEach((student: any) => {
        initialStatuses[student.student_id] = 'Present';
      });
      setAttendanceStatuses(initialStatuses);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setError('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    setAttendanceStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSubmitAttendance = async () => {
    if (!selectedDepartment || !selectedSemester || students.length === 0) {
      setError('Please select department, semester, and ensure students are loaded');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const attendances = students.map(student => ({
        student_id: student.student_id,
        status: attendanceStatuses[student.student_id] || 'Present'
      }));

      const requestData: BulkAttendanceRequest = {
        date: attendanceDate,
        attendances: attendances
      };

      // Use test endpoint for testing
      const response = await fetch('http://127.0.0.1:8000/api/instructors/attendance/test-bulk/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark attendance');
      }
      
      const result = await response.json();
      setSuccess(result.message);
      checkTodayStatus(); // Refresh status after marking

      // Reset attendance statuses to Present after successful submission
      const resetStatuses: { [key: string]: 'Present' | 'Absent' | 'Late' } = {};
      students.forEach(student => {
        resetStatuses[student.student_id] = 'Present';
      });
      setAttendanceStatuses(resetStatuses);

    } catch (err: any) {
      setError('Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const markAllPresent = () => {
    const newStatuses: { [key: string]: 'Present' | 'Absent' | 'Late' } = {};
    students.forEach(student => {
      newStatuses[student.student_id] = 'Present';
    });
    setAttendanceStatuses(newStatuses);
  };

  const markAllAbsent = () => {
    const newStatuses: { [key: string]: 'Present' | 'Absent' | 'Late' } = {};
    students.forEach(student => {
      newStatuses[student.student_id] = 'Absent';
    });
    setAttendanceStatuses(newStatuses);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Bulk Attendance Management</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Selection Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              value={selectedDepartment || ''}
              onChange={(e) => setSelectedDepartment(e.target.value || null)}
              className="w-full p-2 border rounded"
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id.toString()}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Semester</label>
            <select
              value={selectedSemester || ''}
              onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full p-2 border rounded"
              disabled={!selectedDepartment}
            >
              <option value="">Select Semester</option>
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date (TEST MODE)</label>
            <input
              type="date"
              value={attendanceDate}
              disabled
              className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"
            />
            <p className="text-xs text-green-600 mt-1">✅ No time restrictions - Submit anytime</p>
            {isSubmitted && (
              <p className="text-sm text-green-600 mt-1">✓ Attendance submitted and locked</p>
            )}
            {isSubmitted && (
              <p className="text-sm text-green-600 mt-1">✅ Attendance can be submitted anytime</p>
            )}
          </div>
        </div>
      </div>

      {/* Students List and Attendance */}
      {students.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Students ({students.length}) - {departments.find(d => {
                  const deptId = selectedDepartment ? parseInt(selectedDepartment) : -1;
                  return !isNaN(deptId) && d.id === deptId;
                })?.name} - {semesters.find(s => s.id === selectedSemester)?.name}
              </h3>
            <div className="flex space-x-2">
              <button
                onClick={markAllPresent}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Mark All Present
              </button>
              <button
                onClick={markAllAbsent}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                Mark All Absent
              </button>
              <button
                onClick={handleSubmitAttendance}
                disabled={loading || !canEdit}
                className={`px-4 py-1 rounded text-white ${
                  !canEdit ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {loading ? 'Saving...' : !canEdit ? 'Already Submitted' : 'Mark Attendance'}
              </button>
              {students.length > 0 && (
                <button
                  onClick={submitTodayAttendance}
                  disabled={loading || isSubmitted}
                  className={`px-4 py-1 rounded text-white font-semibold ${
                    isSubmitted ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {isSubmitted ? '✓ Submitted' : '🔒 Submit & Lock'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {students.map((student) => (
              <div key={student.student_id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <div className="font-medium">{student.name}</div>
                  <div className="text-sm text-gray-600">
                    ID: {student.student_id} | Email: {student.email}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {(['Present', 'Absent', 'Late'] as const).map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="radio"
                        name={`attendance-${student.student_id}`}
                        value={status}
                        checked={attendanceStatuses[student.student_id] === status}
                        onChange={() => handleAttendanceStatusChange(student.student_id, status)}
                        className="mr-1"
                      />
                      <span className={`text-sm ${
                        status === 'Present' ? 'text-green-600' :
                        status === 'Absent' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDepartment && selectedSemester && students.length === 0 && !loading && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-center py-8">
            No students found for the selected department and semester.
          </div>
        </div>
      )}

      {!selectedDepartment && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-center py-8">
            Please select a department and semester to view students and mark attendance.
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
