import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AttendanceRecord {
  attendance_id: number;
  student_name: string;
  student_id: string;
  course_name: string;
  course_code: string;
  date: string;
  current_status: 'Present' | 'Absent' | 'Late';
  is_submitted: boolean;
  can_edit: boolean;
}

interface EditRequest {
  id: number;
  student: {
    id: string;
    name: string;
  };
  course: {
    name: string;
    code: string;
  };
  date: string;
  current_status: string;
  proposed_status: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  admin_notes?: string;
}

const AttendanceEditRequestCard: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [requestForm, setRequestForm] = useState({
    reason: '',
    proposed_status: 'Present' as 'Present' | 'Absent' | 'Late'
  });
  const [activeTab, setActiveTab] = useState<'records' | 'requests'>('records');

  useEffect(() => {
    fetchSubmittedAttendance();
    fetchEditRequests();
  }, []);

  const fetchSubmittedAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const instructorId = localStorage.getItem('instructor_id') || '1';
      
      const response = await fetch(`http://localhost:8000/api/academics/attendance/submitted/?instructor_id=${instructorId}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching submitted attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditRequests = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const instructorId = localStorage.getItem('instructor_id') || '1';
      
      const response = await fetch(`http://localhost:8000/api/academics/attendance/edit-requests/?instructor_id=${instructorId}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEditRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    }
  };

  const submitEditRequest = async () => {
    if (!selectedRecord || !requestForm.reason.trim()) {
      alert('Please provide a reason for the edit request');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const instructorId = localStorage.getItem('instructor_id') || '1';

      const response = await fetch('http://localhost:8000/api/academics/attendance/edit-request/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attendance_id: selectedRecord.attendance_id,
          instructor_id: instructorId,
          reason: requestForm.reason,
          proposed_status: requestForm.proposed_status
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedRecord(null);
        setRequestForm({ reason: '', proposed_status: 'Present' });
        fetchEditRequests();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting edit request:', error);
      alert('Failed to submit edit request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Absent': return 'bg-red-100 text-red-800';
      case 'Late': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Attendance Edit Requests</h2>
        <p className="text-gray-600 mb-6">Request admin permission to edit submitted attendance records</p>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'records'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Submitted Records
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Requests ({editRequests.length})
          </button>
        </div>

        {/* Submitted Records Tab */}
        {activeTab === 'records' && (
          <div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading attendance records...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="mt-2">No submitted attendance records found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {attendanceRecords.map((record) => (
                      <div
                        key={record.attendance_id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-medium text-gray-900">{record.student_name}</h3>
                              <span className="text-sm text-gray-500">({record.student_id})</span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.current_status)}`}>
                                {record.current_status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {record.course_name} ({record.course_code}) - {new Date(record.date).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedRecord(record)}
                            disabled={record.can_edit}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              record.can_edit
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {record.can_edit ? 'Editable' : 'Request Edit'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Edit Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            {editRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7v8a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v8a2 2 0 002 2h2m0 0h8m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2H10z" />
                </svg>
                <p className="mt-2">No edit requests submitted</p>
              </div>
            ) : (
              <div className="space-y-4">
                {editRequests.map((request) => (
                  <div
                    key={request.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-900">{request.student.name}</h3>
                          <span className="text-sm text-gray-500">({request.student.id})</span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {request.course.name} ({request.course.code}) - {new Date(request.date).toLocaleDateString()}
                        </p>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Change:</span> {request.current_status} → {request.proposed_status}
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                        {request.admin_notes && (
                          <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded mt-2">
                            <span className="font-medium">Admin Notes:</span> {request.admin_notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {new Date(request.requested_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Request Modal */}
      {selectedRecord && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Request Attendance Edit</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Student: <span className="font-medium">{selectedRecord.student_name}</span></p>
                <p className="text-sm text-gray-600">Course: <span className="font-medium">{selectedRecord.course_name}</span></p>
                <p className="text-sm text-gray-600">Date: <span className="font-medium">{new Date(selectedRecord.date).toLocaleDateString()}</span></p>
                <p className="text-sm text-gray-600">Current Status: 
                  <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedRecord.current_status)}`}>
                    {selectedRecord.current_status}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposed Status
                </label>
                <select
                  value={requestForm.proposed_status}
                  onChange={(e) => setRequestForm({...requestForm, proposed_status: e.target.value as 'Present' | 'Absent' | 'Late'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Edit Request *
                </label>
                <textarea
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm({...requestForm, reason: e.target.value})}
                  placeholder="Please explain why this attendance record needs to be changed..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setSelectedRecord(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitEditRequest}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Request
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AttendanceEditRequestCard;