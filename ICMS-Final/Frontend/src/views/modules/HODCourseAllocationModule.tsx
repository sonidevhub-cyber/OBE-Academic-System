import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import { coordinatorService, CourseAllocation } from '../../api/coordinatorService';
import { toast } from 'react-hot-toast';

const HODCourseAllocationModule: React.FC = () => {
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'proposed' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      const response = await coordinatorService.getCourseAllocations();
      // Adjust according to API response format
      const data = response.data?.data || response.data || [];
      if (Array.isArray(data)) {
        setAllocations(data);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
      toast.error('Failed to load course allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await coordinatorService.approveCourseAllocation(id, { comments: 'Approved by HOD' });
      toast.success('Allocation approved');
      fetchAllocations();
    } catch (error) {
      console.error('Error approving allocation:', error);
      toast.error('Failed to approve allocation');
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;

    try {
      await coordinatorService.rejectCourseAllocation(id, { reason });
      toast.success('Allocation rejected');
      fetchAllocations();
    } catch (error) {
      console.error('Error rejecting allocation:', error);
      toast.error('Failed to reject allocation');
    }
  };

  const filteredAllocations = allocations.filter(a => {
    const matchesSearch = 
      a.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center">Loading allocations...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by course or instructor..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-gray-400 h-5 w-5" />
          <select
            className="border rounded-lg px-3 py-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="proposed">Proposed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Course</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Instructor</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Batch</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAllocations.map((allocation) => (
              <tr key={allocation.allocation_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium">{allocation.course_name}</div>
                  <div className="text-sm text-gray-500">{allocation.course_code}</div>
                </td>
                <td className="px-6 py-4">{allocation.instructor_name}</td>
                <td className="px-6 py-4">{allocation.batch_name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    allocation.status === 'approved' || allocation.status === 'active' ? 'bg-green-100 text-green-800' :
                    allocation.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {allocation.status === 'proposed' && <Clock className="h-3 w-3 mr-1" />}
                    {allocation.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {allocation.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                    {allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {allocation.status === 'proposed' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApprove(allocation.allocation_id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Approve"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleReject(allocation.allocation_id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Reject"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredAllocations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No course allocations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HODCourseAllocationModule;
