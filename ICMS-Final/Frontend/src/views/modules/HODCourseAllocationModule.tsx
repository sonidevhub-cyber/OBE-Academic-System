import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAllocations } from '../../context/AllocationContext';

type ManagementTab = 'proposed' | 'timetable' | 'records';

const HODCourseAllocationModule: React.FC = () => {
  const { allocations, updateAllocation, getProposedAllocations } = useAllocations();
  const [activeTab, setActiveTab] = useState<ManagementTab>('proposed');
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comments, setComments] = useState('');

  const proposedAllocations = getProposedAllocations();
  const reviewedAllocations = allocations.filter(a => a.status !== 'proposed');

  const handleAction = (allocation: any, action: 'approve' | 'reject') => {
    setSelectedAllocation(allocation);
    setActionType(action);
    setComments('');
    setShowModal(true);
  };

  const submitAction = async () => {
    try {
      updateAllocation(selectedAllocation.allocation_id, {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        hod_comments: comments,
        approved_at: new Date().toISOString()
      });
      
      setShowModal(false);
      alert(`Course allocation ${actionType}d successfully!`);
    } catch (error) {
      console.error('Error updating allocation:', error);
      alert('Failed to update allocation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'proposed': return '⏰';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  const pendingAllocations = proposedAllocations;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'proposed':
        return renderProposedAllocations();
      case 'timetable':
        return (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Timetable Approvals</h3>
            <p className="text-gray-600">Timetable approval functionality will be implemented here.</p>
          </div>
        );
      case 'records':
        return renderReviewedAllocations();
      default:
        return renderProposedAllocations();
    }
  };

  const renderProposedAllocations = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingAllocations.length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">⏰</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{allocations.filter(a => a.status === 'approved').length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">✅</div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{allocations.filter(a => a.status === 'rejected').length}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">❌</div>
          </div>
        </div>
      </div>

      {/* Pending Allocations */}
      {pendingAllocations.length > 0 ? (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-yellow-700">⏰ Pending Approvals</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingAllocations.map((allocation) => (
              <motion.div
                key={allocation.allocation_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-yellow-200 rounded-lg p-4 bg-yellow-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{allocation.course_name}</h3>
                    <p className="text-sm text-gray-500">{allocation.course_code}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(allocation.status)}`}>
                    {getStatusIcon(allocation.status)} {allocation.status}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <span className="font-medium w-20">Instructor:</span>
                    <span>{allocation.instructor_name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Semester:</span>
                    <span>{allocation.semester_name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Proposed by:</span>
                    <span>{allocation.coordinator_name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">Date:</span>
                    <span>{new Date(allocation.proposed_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {allocation.hod_comments && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-800">Coordinator Comments:</p>
                    <p className="text-sm text-blue-700">{allocation.hod_comments}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(allocation, 'approve')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleAction(allocation, 'reject')}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ❌ Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-100 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pending Allocations</h3>
          <p className="text-gray-600">All course allocations have been reviewed.</p>
        </div>
      )}
    </div>
  );

  const renderReviewedAllocations = () => (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">📋 Reviewed Allocations</h2>
      {reviewedAllocations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {reviewedAllocations.map((allocation) => (
            <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{allocation.course_name}</h3>
                  <p className="text-sm text-gray-500">{allocation.course_code}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(allocation.status)}`}>
                  {getStatusIcon(allocation.status)} {allocation.status}
                </div>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <div>👨🏫 {allocation.instructor_name}</div>
                <div>📅 {allocation.semester_name}</div>
                <div>📝 {allocation.coordinator_name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No reviewed allocations found</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-4">
          📋 Coordinator Management
        </h1>
        <div className="flex space-x-1 bg-white rounded-lg p-1">
          <button
            onClick={() => setActiveTab('proposed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'proposed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Proposed Course Allocations
          </button>
          <button
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'timetable'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📅 Timetable Approvals
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'records'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📚 Old Records
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Action Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {actionType === 'approve' ? '✅ Approve' : '❌ Reject'} Allocation
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ❌
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-lg">{selectedAllocation?.course_name}</h3>
              <p className="text-gray-600">Instructor: {selectedAllocation?.instructor_name}</p>
              <p className="text-gray-600">Semester: {selectedAllocation?.semester_name}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {actionType === 'approve' ? 'Approval Comments' : 'Rejection Reason'}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder={actionType === 'approve' ? 'Optional approval comments...' : 'Please provide reason for rejection...'}
                required={actionType === 'reject'}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                className={`flex-1 px-6 py-3 text-white rounded-lg font-medium transition-colors ${
                  actionType === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default HODCourseAllocationModule;