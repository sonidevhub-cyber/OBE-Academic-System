import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { multiRoleService } from '../../../api/multiRoleService';

interface HODRequest {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  phone: string;
  department_name: string;
  designation: string;
  experience_years: number;
  specialization: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface HODManagementProps {
  token: string;
  onRequestAction: (requestId: number, action: string) => Promise<void>;
}

const HODManagementModule: React.FC<HODManagementProps> = ({ token, onRequestAction }) => {
  const [hodRequests, setHodRequests] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [hodRequestsList, setHodRequestsList] = useState<HODRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const loadHodRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/hods/admin/requests/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const requests = data.requests || data.data || [];
        const stats = data.stats || {
          pending: requests.filter((r: any) => r.status === 'pending').length,
          approved: requests.filter((r: any) => r.status === 'approved').length,
          rejected: requests.filter((r: any) => r.status === 'rejected').length,
          total: requests.length
        };
        
        setHodRequestsList(requests);
        setHodRequests(stats);
      }
    } catch (error) {
      console.error('Error loading HOD requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Commented out - endpoint /api/hods/admin/requests/ does not exist
    // loadHodRequests();
  }, [token]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">HOD Registration Requests</h2>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              try {
                await multiRoleService.setupMultiRoleSystem();
                alert('Multi-role system setup completed! All HODs can now act as instructors and coordinators.');
              } catch (error) {
                console.error('Error setting up multi-role system:', error);
                alert('Failed to setup multi-role system. Check console for details.');
              }
            }}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Enable Multi-Role for All HODs
          </button>
          <button
            onClick={loadHodRequests}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          onClick={() => setSelectedFilter('all')}
          className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${selectedFilter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{hodRequests?.total || 0}</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setSelectedFilter('pending')}
          className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${selectedFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
        >
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-yellow-600">{hodRequests?.pending || 0}</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setSelectedFilter('approved')}
          className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${selectedFilter === 'approved' ? 'ring-2 ring-green-500' : ''}`}
        >
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-semibold text-green-600">{hodRequests?.approved || 0}</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setSelectedFilter('rejected')}
          className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${selectedFilter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-semibold text-red-600">{hodRequests?.rejected || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading requests...</p>
          </div>
        ) : hodRequestsList.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2">No HOD requests found.</p>
          </div>
        ) : (
          hodRequestsList
            .filter(request => selectedFilter === 'all' || request.status === selectedFilter)
            .map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
              <div className="p-6">
                {/* Status Badge */}
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {new Date(request.requested_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(request.requested_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{request.name}</h3>
                    <p className="text-sm text-gray-600">{request.designation}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{request.email}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{request.department_name}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>{request.specialization}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {request.status === 'pending' && (
                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => onRequestAction(request.id, 'approve')}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRequestAction(request.id, 'reject')}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default HODManagementModule;