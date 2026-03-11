import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AttendanceRecord {
  id: number;
  student_id: string;
  student_name: string;
  instructor_name: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
  is_submitted: boolean;
  can_edit: boolean;
  marked_at: string;
  updated_at: string;
}

interface AttendanceData {
  organized_data: { [dept: string]: { [sem: string]: StudentRecord[] } };
  statistics: {
    total_students: number;
    total_records: number;
    present: number;
    absent: number;
    late: number;
  };
}

interface StudentRecord {
  student_id: string;
  student_name: string;
  email: string;
  phone?: string;
  attendance?: {
    id: number;
    status: string;
    instructor: string;
    course: {
      name: string;
      code: string;
    };
    time_slot: string;
    room: string;
    marked_at: string;
    is_submitted: boolean;
    can_edit: boolean;
  };
}

interface EditPermissionRequest {
  id: number;
  requested_by_name: string;
  reviewed_by_name?: string;
  course_name: string;
  course_code: string;
  section: string;
  instructor_name: string;
  timetable: number;
  attendance_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  admin_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

const AdminAttendanceManagement: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [editRequests, setEditRequests] = useState<EditPermissionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    departmentId: '',
    semesterId: '',
    instructorId: ''
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'requests'>('attendance');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<EditPermissionRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const getAuthToken = () => {
    const raw = localStorage.getItem('auth') || sessionStorage.getItem('auth') || '{}';
    const parsed = JSON.parse(raw);
    return parsed.access_token || parsed.token;
  };

  useEffect(() => {
    fetchFilterData();
    fetchEditRequests('pending');
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceRecords();
    }
  }, [selectedDate, filters, activeTab]);

  const fetchFilterData = async () => {
    try {
      const token = getAuthToken();
      
      const [deptRes, semRes, instRes] = await Promise.all([
        fetch('http://localhost:8000/api/academics/departments/', {
          headers: { Authorization: `Token ${token}` }
        }),
        fetch('http://localhost:8000/api/academics/semesters/', {
          headers: { Authorization: `Token ${token}` }
        }),
        fetch('http://localhost:8000/api/instructors/', {
          headers: { Authorization: `Token ${token}` }
        })
      ]);

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.data || []);
      }
      if (semRes.ok) {
        const semData = await semRes.json();
        setSemesters(Array.isArray(semData) ? semData : semData.data || []);
      }
      if (instRes.ok) {
        const instData = await instRes.json();
        setInstructors(Array.isArray(instData) ? instData : instData.data || []);
      }
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams();
      
      if (selectedDate) params.append('date', selectedDate);
      if (filters.departmentId) params.append('department_id', filters.departmentId);
      if (filters.semesterId) params.append('semester_id', filters.semesterId);
      if (filters.instructorId) params.append('instructor_id', filters.instructorId);

      const response = await fetch(`http://localhost:8000/api/academics/admin/attendance/?${params}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceData({
          organized_data: data.organized_data || {},
          statistics: data.statistics || {
            total_students: 0,
            total_records: 0,
            present: 0,
            absent: 0,
            late: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditRequests = async (statusFilter: 'pending' | 'approved' | 'rejected' | 'all' = requestStatusFilter) => {
    try {
      const token = getAuthToken();
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      
      // Super Admin/Admin handles attendance update requests here
      const response = await fetch(`http://127.0.0.1:8000/api/attendance/admin/update-requests/${query}`, {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data) ? data : data?.results || [];
        setEditRequests(normalized);
      } else {
        console.error('Failed to fetch edit requests:', response.status);
      }
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    }
  };

  const handleEditRequest = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      const token = getAuthToken();
      
      // Super Admin/Admin handles attendance update requests here
      const response = await fetch('http://127.0.0.1:8000/api/attendance/admin/update-requests/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId,
          action: action,
          admin_notes: adminNotes
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedRequest(null);
        setAdminNotes('');
        fetchEditRequests(requestStatusFilter);
        if (action === 'approve') {
          fetchAttendanceRecords();
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || error.message || 'Failed to process request'}`);
      }
    } catch (error) {
      console.error('Error handling edit request:', error);
      alert('Failed to process request');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Super Admin Attendance Management</h2>
        <p className="text-gray-600 mb-6">Handle instructor attendance update requests and manage attendance records.</p>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'attendance'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Attendance Records
          </button>
          <button
            onClick={() => {
              setActiveTab('requests');
              fetchEditRequests(requestStatusFilter); // Refresh when switching to requests tab
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Edit Requests ({editRequests.length})
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchEditRequests(requestStatusFilter);
              }}
              className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
            >
              Refresh
            </button>
          </button>
        </div>

        {/* Filters - Only show for attendance tab */}
        {activeTab === 'attendance' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={filters.departmentId}
                onChange={(e) => setFilters({...filters, departmentId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={filters.semesterId}
                onChange={(e) => setFilters({...filters, semesterId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Semesters</option>
                {semesters.map(sem => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Instructor</label>
              <select
                value={filters.instructorId}
                onChange={(e) => setFilters({...filters, instructorId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Instructors</option>
                {instructors.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'attendance' ? (
          <div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading attendance records...</p>
              </div>
            ) : attendanceData ? (
              <div className="space-y-6">
                {/* Professional Statistics Dashboard */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm text-center border border-blue-100">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mx-auto mb-2">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-blue-600">Total Students</h4>
                      <p className="text-2xl font-bold text-blue-900">{attendanceData.statistics.total_students}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm text-center border border-gray-100">
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full mx-auto mb-2">
                        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-gray-600">Records</h4>
                      <p className="text-2xl font-bold text-gray-900">{attendanceData.statistics.total_records}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm text-center border border-green-100">
                      <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mx-auto mb-2">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-green-600">Present</h4>
                      <p className="text-2xl font-bold text-green-900">{attendanceData.statistics.present}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm text-center border border-red-100">
                      <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full mx-auto mb-2">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-red-600">Absent</h4>
                      <p className="text-2xl font-bold text-red-900">{attendanceData.statistics.absent}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm text-center border border-yellow-100">
                      <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full mx-auto mb-2">
                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-yellow-600">Late</h4>
                      <p className="text-2xl font-bold text-yellow-900">{attendanceData.statistics.late}</p>
                    </div>
                  </div>
                  {attendanceData.statistics.total_records > 0 && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-600">
                        Attendance Rate: <span className="font-semibold text-green-600">
                          {Math.round((attendanceData.statistics.present / attendanceData.statistics.total_records) * 100)}%
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Professional Student Records */}
                {Object.entries(attendanceData.organized_data).map(([deptName, semesters]) => (
                  <div key={deptName} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mr-3">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{deptName}</h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      {Object.entries(semesters).map(([semName, students]) => (
                        <div key={semName} className="mb-8 last:mb-0">
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                            <div className="flex items-center">
                              <div className="flex items-center justify-center w-6 h-6 bg-indigo-100 rounded-full mr-2">
                                <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <h4 className="text-md font-semibold text-gray-800">{semName}</h4>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {students.length} students
                              </span>
                              {selectedDate && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {students.filter(s => s.attendance?.status === 'Present').length} present
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                  {selectedDate && (
                                    <>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marked At</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {students.map((student) => (
                                  <tr key={student.student_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <span className="text-sm font-medium text-blue-600">
                                              {student.student_name.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="ml-4">
                                          <div className="text-sm font-medium text-gray-900">{student.student_name}</div>
                                          <div className="text-sm text-gray-500">{student.student_id}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                      <div className="text-sm text-gray-900">{student.email}</div>
                                      <div className="text-sm text-gray-500">{student.phone || 'N/A'}</div>
                                    </td>
                                    {selectedDate && student.attendance && (
                                      <>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                              student.attendance.status === 'Present' ? 'bg-green-100 text-green-800' :
                                              student.attendance.status === 'Absent' ? 'bg-red-100 text-red-800' :
                                              student.attendance.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                              {student.attendance.status}
                                            </span>
                                            {student.attendance.is_submitted && (
                                              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Locked
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">{student.attendance.course.name}</div>
                                          <div className="text-sm text-gray-500">{student.attendance.course.code}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">{student.attendance.time_slot}</div>
                                          <div className="text-sm text-gray-500">Room: {student.attendance.room}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{student.attendance.instructor}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {student.attendance.marked_at ? new Date(student.attendance.marked_at).toLocaleString() : 'N/A'}
                                        </td>
                                      </>
                                    )}
                                    {selectedDate && !student.attendance && (
                                      <>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                            Not Marked
                                          </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No attendance records found for the selected filters.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Requests</h3>
              <div className="flex items-center gap-2">
                <select
                  value={requestStatusFilter}
                  onChange={(e) => {
                    const next = e.target.value as 'pending' | 'approved' | 'rejected' | 'all';
                    setRequestStatusFilter(next);
                    fetchEditRequests(next);
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All</option>
                </select>
                <button
                  onClick={() => fetchEditRequests(requestStatusFilter)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Refresh Requests
                </button>
              </div>
            </div>
            {editRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2">No pending edit requests</p>
                <p className="text-sm mt-1">Requests from instructors will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {editRequests.map((request) => (
                  <div
                    key={request.id}
                    className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="font-semibold text-gray-900">{request.course_name}</h3>
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Course:</span> {request.course_name} ({request.course_code})
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Section:</span> {request.section}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Instructor:</span> {request.instructor_name}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Requested By:</span> {request.requested_by_name}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Date:</span> {new Date(request.attendance_date).toLocaleDateString()}
                          </p>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Reason:</span> {request.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => request.status === 'pending' && setSelectedRequest(request)}
                          disabled={request.status !== 'pending'}
                          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                            request.status === 'pending'
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-green-600 text-white opacity-40 cursor-not-allowed'
                          }`}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Review Request Modal */}
      {selectedRequest && selectedRequest.status === 'pending' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6">Review Edit Request</h3>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Course Information</h4>
                  <p className="text-sm text-gray-600">Course: {selectedRequest.course_name}</p>
                  <p className="text-sm text-gray-600">Code: {selectedRequest.course_code}</p>
                  <p className="text-sm text-gray-600">Section: {selectedRequest.section}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Request Details</h4>
                  <p className="text-sm text-gray-600">Instructor: {selectedRequest.instructor_name}</p>
                  <p className="text-sm text-gray-600">Requested By: {selectedRequest.requested_by_name}</p>
                  <p className="text-sm text-gray-600">Date: {new Date(selectedRequest.attendance_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Reason</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">{selectedRequest.reason}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setAdminNotes('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEditRequest(selectedRequest.id, 'reject')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleEditRequest(selectedRequest.id, 'approve')}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AdminAttendanceManagement;
