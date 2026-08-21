import React, { useEffect, useState } from 'react';
import obeService from '../../../api/obeService';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';

const SACExitSurveyDashboard: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const [pendingData, setPendingData] = useState<any>(null);
  const [graduationInitiated, setGraduationInitiated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);

  useEffect(() => {
    if (batchId) {
      loadData();
    }
  }, [batchId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await obeService.getPendingExitSurveyForBatch(batchId!);
      setPendingData(data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateGraduation = async () => {
    if (!window.confirm('Are you sure you want to initiate graduation? Students who have already submitted will be graduated immediately. Others will auto-graduate as they submit. This cannot be undone.')) {
      return;
    }
    setIsInitiating(true);
    try {
      await obeService.initiateGraduationForBatch(batchId!);
      setGraduationInitiated(true);
      toast.success('Graduation initiated successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to initiate graduation');
    } finally {
      setIsInitiating(false);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Exit Survey Dashboard</h1>

      <div className="mb-6">
        {graduationInitiated ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <span className="font-semibold text-green-800">Graduation Initiated</span>
          </div>
        ) : (
          <button
            onClick={handleInitiateGraduation}
            disabled={isInitiating}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {isInitiating ? 'Initiating...' : 'Initiate Graduation'}
          </button>
        )}
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-lg font-medium">
          {pendingData?.pending_count || 0} pending exit surveys
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pendingData?.students.map((student: any) => (
              <tr key={student.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {student.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {student.registration_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SACExitSurveyDashboard;
