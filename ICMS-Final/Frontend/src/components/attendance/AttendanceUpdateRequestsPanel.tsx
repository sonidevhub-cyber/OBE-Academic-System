import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface UpdateRequest {
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

interface AttendanceUpdateRequestsPanelProps {
  title?: string;
  subtitle?: string;
}

const AttendanceUpdateRequestsPanel: React.FC<AttendanceUpdateRequestsPanelProps> = ({
  title = 'Attendance Update Requests',
  subtitle = 'Review instructor requests to update submitted class attendance.'
}) => {
  const [requests, setRequests] = useState<UpdateRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<UpdateRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const getAuthToken = () => {
    const raw = localStorage.getItem('auth') || sessionStorage.getItem('auth') || '{}';
    const parsed = JSON.parse(raw);
    return parsed.access_token || parsed.token;
  };

  const fetchRequests = async (status: typeof statusFilter = statusFilter) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const query = status === 'all' ? '' : `?status=${status}`;

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/admin/update-requests/${query}`, {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data) ? data : data?.results || [];
        setRequests(normalized);
      } else {
        console.error('Failed to fetch update requests:', response.status);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching update requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      const token = getAuthToken();
      const response = await fetch('http://127.0.0.1:8000/api/attendance/admin/update-requests/', {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId,
          action,
          admin_notes: adminNotes
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Request updated.');
        setSelectedRequest(null);
        setAdminNotes('');
        fetchRequests(statusFilter);
      } else {
        const error = await response.json();
        alert(error?.error || error?.message || 'Failed to process request.');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Failed to process request.');
    }
  };

  useEffect(() => {
    fetchRequests(statusFilter);
  }, [statusFilter]);

  const statusBadge = (status: UpdateRequest['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'used':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          </div>
          <div className="flex items-center space-x-2">
            {[
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'all', label: 'All' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setStatusFilter(option.id as typeof statusFilter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                  statusFilter === option.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading requests...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Requests ({requests.length})
            </h4>
            {requests.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No requests found.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {requests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={`w-full text-left border rounded-lg p-3 transition ${
                      selectedRequest?.id === req.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{req.course_name}</p>
                        <p className="text-xs text-gray-500">{req.course_code} • {req.section}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">Requested by {req.requested_by_name}</p>
                    <p className="text-xs text-gray-500">Date: {new Date(req.attendance_date).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {selectedRequest ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Course</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedRequest.course_name} ({selectedRequest.course_code})</p>
                  <p className="text-sm text-gray-500 mt-1">Section: {selectedRequest.section}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Instructor</p>
                  <p className="text-sm font-medium text-gray-900">{selectedRequest.instructor_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-sm text-gray-800">{selectedRequest.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Notes (optional)</p>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Add notes for approval or rejection..."
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleAction(selectedRequest.id, 'reject')}
                    className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction(selectedRequest.id, 'approve')}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </button>
                </div>
                {selectedRequest.admin_notes && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Previous Notes</p>
                    <p className="text-sm text-gray-800">{selectedRequest.admin_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-16">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Select a request to review details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceUpdateRequestsPanel;
