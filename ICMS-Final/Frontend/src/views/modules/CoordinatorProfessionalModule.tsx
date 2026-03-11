import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { coordinatorService } from '../../api/coordinatorService';

interface PerformanceData {
  overall_performance: {
    proposal_success_rate: number;
    allocation_success_rate: number;
    total_proposals: number;
    total_allocations: number;
  };
  monthly_performance: Array<{
    month: string;
    proposals_created: number;
    proposals_approved: number;
    allocations_created: number;
    allocations_approved: number;
  }>;
}

interface WorkloadData {
  workload_summary: {
    total_active_allocations: number;
    unique_instructors: number;
    active_timetable_proposals: number;
  };
  instructor_distribution: Record<string, {
    courses: string[];
    total_courses: number;
  }>;
  time_slot_analysis: Record<string, Record<string, Array<{
    course: string;
    instructor: string;
    room: string;
  }>>>;
}

const CoordinatorProfessionalModule: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [workloadData, setWorkloadData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'workload' | 'development'>('overview');
  const [professionalInfo, setProfessionalInfo] = useState({
    training_hours: 0,
    certifications: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [performanceRes, workloadRes] = await Promise.all([
        coordinatorService.getPerformanceMetrics(),
        coordinatorService.getWorkloadAnalysis()
      ]);
      
      setPerformanceData(performanceRes.data);
      setWorkloadData(workloadRes.data);
    } catch (error) {
      console.error('Error fetching professional data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfessionalInfo = async () => {
    try {
      await coordinatorService.updateProfessionalInfo(professionalInfo);
      alert('Professional information updated successfully!');
    } catch (error) {
      console.error('Error updating professional info:', error);
      alert('Failed to update professional information');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'workload', label: 'Workload', icon: '⚖️' },
    { id: 'development', label: 'Development', icon: '🎓' }
  ];

  if (loading) return <div className='p-4'>Loading professional dashboard...</div>;

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <h2 className='text-2xl font-bold'>Professional Dashboard</h2>
        <div className='text-sm text-gray-600'>
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-md p-1'>
        <div className='flex space-x-1'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className='bg-white rounded-lg shadow-md p-6'>
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='space-y-6'
          >
            <h3 className='text-lg font-semibold'>Professional Overview</h3>

            {/* Key Metrics */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              <div className='bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg'>
                <div className='text-2xl font-bold text-blue-600'>
                  {performanceData?.overall_performance.proposal_success_rate.toFixed(1)}%
                </div>
                <div className='text-blue-800'>Proposal Success Rate</div>
              </div>
              <div className='bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg'>
                <div className='text-2xl font-bold text-green-600'>
                  {performanceData?.overall_performance.allocation_success_rate.toFixed(1)}%
                </div>
                <div className='text-green-800'>Allocation Success Rate</div>
              </div>
              <div className='bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg'>
                <div className='text-2xl font-bold text-purple-600'>
                  {workloadData?.workload_summary.total_active_allocations}
                </div>
                <div className='text-purple-800'>Active Allocations</div>
              </div>
              <div className='bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg'>
                <div className='text-2xl font-bold text-orange-600'>
                  {workloadData?.workload_summary.unique_instructors}
                </div>
                <div className='text-orange-800'>Instructors Managed</div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <h4 className='font-semibold mb-2'>Total Activity</h4>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span>Total Proposals:</span>
                    <span className='font-medium'>{performanceData?.overall_performance.total_proposals}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Total Allocations:</span>
                    <span className='font-medium'>{performanceData?.overall_performance.total_allocations}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Active Timetables:</span>
                    <span className='font-medium'>{workloadData?.workload_summary.active_timetable_proposals}</span>
                  </div>
                </div>
              </div>

              <div className='bg-gray-50 p-4 rounded-lg'>
                <h4 className='font-semibold mb-2'>Professional Development</h4>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span>Training Hours:</span>
                    <span className='font-medium'>{professionalInfo.training_hours}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Certifications:</span>
                    <span className='font-medium'>{professionalInfo.certifications ? 'Yes' : 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'performance' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold">Performance Analytics</h3>

            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-4">Proposal Performance</h4>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {performanceData?.overall_performance.proposal_success_rate.toFixed(1)}%
                </div>
                <p className="text-blue-700">
                  Success rate based on {performanceData?.overall_performance.total_proposals} total proposals
                </p>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-4">Allocation Performance</h4>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {performanceData?.overall_performance.allocation_success_rate.toFixed(1)}%
                </div>
                <p className="text-green-700">
                  Success rate based on {performanceData?.overall_performance.total_allocations} total allocations
                </p>
              </div>
            </div>

            {/* Monthly Performance */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">Monthly Performance (Last 6 Months)</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-4 py-2 text-left">Month</th>
                      <th className="px-4 py-2 text-left">Proposals Created</th>
                      <th className="px-4 py-2 text-left">Proposals Approved</th>
                      <th className="px-4 py-2 text-left">Allocations Created</th>
                      <th className="px-4 py-2 text-left">Allocations Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData?.monthly_performance.map((month, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2 font-medium">{month.month}</td>
                        <td className="px-4 py-2">{month.proposals_created}</td>
                        <td className="px-4 py-2 text-green-600">{month.proposals_approved}</td>
                        <td className="px-4 py-2">{month.allocations_created}</td>
                        <td className="px-4 py-2 text-green-600">{month.allocations_approved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'workload' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold">Workload Analysis</h3>

            {/* Workload Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {workloadData?.workload_summary.total_active_allocations}
                </div>
                <div className="text-blue-800">Active Allocations</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {workloadData?.workload_summary.unique_instructors}
                </div>
                <div className="text-green-800">Unique Instructors</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {workloadData?.workload_summary.active_timetable_proposals}
                </div>
                <div className="text-purple-800">Active Timetables</div>
              </div>
            </div>

            {/* Instructor Distribution */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">Instructor Course Distribution</h4>
              {workloadData?.instructor_distribution && Object.keys(workloadData.instructor_distribution).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(workloadData.instructor_distribution).map(([instructor, data]) => (
                    <div key={instructor} className="bg-white p-4 rounded-lg border">
                      <h5 className="font-medium mb-2">{instructor}</h5>
                      <div className="text-sm text-gray-600 mb-2">
                        Total Courses: {data.total_courses}
                      </div>
                      <div className="space-y-1">
                        {data.courses.slice(0, 3).map((course, index) => (
                          <div key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {course}
                          </div>
                        ))}
                        {data.courses.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{data.courses.length - 3} more courses
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No instructor distribution data available</p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'development' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-lg font-semibold">Professional Development</h3>

            {/* Update Professional Info */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">Update Professional Information</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Training Hours</label>
                  <input
                    type="number"
                    value={professionalInfo.training_hours}
                    onChange={(e) => setProfessionalInfo({
                      ...professionalInfo,
                      training_hours: parseInt(e.target.value) || 0
                    })}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter total training hours"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Certifications</label>
                  <textarea
                    value={professionalInfo.certifications}
                    onChange={(e) => setProfessionalInfo({
                      ...professionalInfo,
                      certifications: e.target.value
                    })}
                    className="w-full p-2 border rounded-md"
                    rows={4}
                    placeholder="List your certifications, separated by commas or new lines"
                  />
                </div>

                <button
                  onClick={handleUpdateProfessionalInfo}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Information
                </button>
              </div>
            </div>

            {/* Development Goals */}
            <div className="bg-white border rounded-lg p-6">
              <h4 className="font-semibold mb-4">Development Goals & Recommendations</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <h5 className="font-medium">Improve Proposal Success Rate</h5>
                    <p className="text-sm text-gray-600">
                      Current rate: {performanceData?.overall_performance.proposal_success_rate.toFixed(1)}%.
                      Consider reviewing rejected proposals for common patterns.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h5 className="font-medium">Professional Development</h5>
                    <p className="text-sm text-gray-600">
                      Consider attending workshops on academic coordination and timetable optimization.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div>
                    <h5 className="font-medium">Workload Balance</h5>
                    <p className="text-sm text-gray-600">
                      Monitor instructor workload distribution to ensure fair allocation of courses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CoordinatorProfessionalModule;