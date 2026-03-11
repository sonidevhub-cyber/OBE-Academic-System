import React, { useState, useEffect } from 'react';

interface AttendanceRecord {
  id: number;
  student_id: string;
  student_name: string;
  date: string;
  current_status: 'Present' | 'Absent' | 'Late';
}

interface EditRequest {
  id: number;
  attendance_id: number;
  student_name: string;
  date: string;
  current_status: string;
  proposed_status: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

const AttendanceEditRequest: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [proposedStatus, setProposedStatus] = useState<'Present' | 'Absent' | 'Late'>('Present');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubmittedAttendance();
    fetchEditRequests();
  }, []);

  const fetchSubmittedAttendance = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/academics/attendance/submitted/', {
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching submitted attendance:', error);
    }
  };

  const fetchEditRequests = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/academics/attendance/edit-requests/', {
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
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
    if (!selectedRecord || !reason.trim()) {
      alert('Please select a record and provide a reason');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/academics/attendance/edit-request/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token}`,
        },
        body: JSON.stringify({
          attendance_id: selectedRecord.id,
          proposed_status: proposedStatus,
          reason: reason
        })
      });

      if (response.ok) {
        alert('Edit request submitted successfully! Waiting for admin approval.');
        setSelectedRecord(null);
        setReason('');
        fetchEditRequests();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting edit request:', error);
      alert('Failed to submit edit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Request Attendance Edit</h2>
        
        {/* Submitted Attendance Records */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Submitted Attendance Records</h3>
          <div className="max-h-64 overflow-y-auto border rounded">
            {attendanceRecords.length === 0 ? (
              <p className="p-4 text-gray-500">No submitted attendance records found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{record.student_name}</div>
                          <div className="text-gray-500 text-xs">{record.student_id}</div>
                        </div>
                      </td>
                      <td className="p-3">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.current_status === 'Present' ? 'bg-green-100 text-green-800' :
                          record.current_status === 'Absent' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.current_status}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Request Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Edit Request Form */}
        {selectedRecord && (
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-semibold mb-3">Request Edit for {selectedRecord.student_name}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Current Status</label>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  selectedRecord.current_status === 'Present' ? 'bg-green-100 text-green-800' :
                  selectedRecord.current_status === 'Absent' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedRecord.current_status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Proposed Status</label>
                <select
                  value={proposedStatus}
                  onChange={(e) => setProposedStatus(e.target.value as 'Present' | 'Absent' | 'Late')}
                  className="w-full p-2 border rounded"
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <span className="block p-2 bg-gray-100 rounded text-sm">
                  {new Date(selectedRecord.date).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for Change</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide a detailed reason for this attendance change..."
                rows={3}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={submitEditRequest}
                disabled={loading || !reason.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  setReason('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Requests Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">My Edit Requests</h3>
        {editRequests.length === 0 ? (
          <p className="text-gray-500">No edit requests submitted</p>
        ) : (
          <div className="space-y-3">
            {editRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{request.student_name}</h4>
                    <p className="text-sm text-gray-600">
                      {new Date(request.date).toLocaleDateString()} - 
                      <span className="ml-1">
                        {request.current_status} → {request.proposed_status}
                      </span>
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{request.reason}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    request.status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Requested: {new Date(request.requested_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceEditRequest;