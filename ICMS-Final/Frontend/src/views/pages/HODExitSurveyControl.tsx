
import React, { useEffect, useState } from 'react';
import obeService from '../../api/obeService';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { GraduationCap, Users, CheckCircle2, XCircle } from 'lucide-react';

interface Batch {
  id: string;
  name: string;
  custom_id: string;
  program: any;
  current_semester: number;
  exit_survey_enabled: boolean;
  exit_survey_enabled_at: string | null;
  is_graduating_eligible: boolean;
  pending_exit_survey_count: number;
  graduation_status: 'not_graduating' | 'in_progress' | 'graduated_partial' | 'graduated_complete';
}

const HODExitSurveyControl: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const data = await obeService.getAllBatches();
      console.log("=== Raw Batches Data ===");
      console.log(data);
      console.log("=== Single Batch ===");
      if(data && data.length > 0){
        console.log(data[0]);
      }
      setBatches(data as Batch[]);
    } catch (error) {
      console.error("Error loading batches:", error);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const toggleExitSurvey = async (batchId: string) => {
    setToggling(batchId);
    try {
      const result = await obeService.toggleExitSurveyForBatch(batchId);
      setBatches(prev => prev.map(batch => 
        batch.id === batchId 
          ? { 
              ...batch, 
              exit_survey_enabled: result.exit_survey_enabled, 
              exit_survey_enabled_at: result.exit_survey_enabled_at,
              graduation_status: result.graduation_status as any
            } 
          : batch
      ));
      toast.success('Exit survey toggled successfully');
    } catch (error) {
      toast.error('Failed to toggle exit survey');
    } finally {
      setToggling(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'not_graduating':
        return 'bg-gray-100 text-gray-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'graduated_partial':
        return 'bg-yellow-100 text-yellow-700';
      case 'graduated_complete':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'not_graduating':
        return 'Not Graduating';
      case 'in_progress':
        return 'In Progress';
      case 'graduated_partial':
        return 'Graduated Partial';
      case 'graduated_complete':
        return 'Graduated Complete';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Exit Survey & Graduation Management</h2>
            <p className="text-gray-600 mt-1">Manage exit surveys and track graduation progress for your batches</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-100 border-t-indigo-500"></div>
        </div>
      ) : (
        <div className="grid gap-6">
          {batches.map((batch, index) => (
            <motion.div
              key={batch.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-xl font-bold text-gray-800">{batch.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClass(batch.graduation_status)}`}>
                      {getStatusLabel(batch.graduation_status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Program:</span> 
                      {batch.program?.name || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Semester:</span> 
                      {batch.current_semester} / {batch.program?.total_semesters || 0}
                    </div>
                    {batch.is_graduating_eligible && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-green-700">Eligible for Graduation</span>
                      </div>
                    )}
                    {batch.exit_survey_enabled && batch.is_graduating_eligible && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span>Pending: {batch.pending_exit_survey_count || 0}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {batch.is_graduating_eligible ? (
                    <button
                      onClick={() => toggleExitSurvey(batch.id)}
                      disabled={toggling === batch.id}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                        batch.exit_survey_enabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg'
                      } disabled:opacity-50`}
                    >
                      {toggling === batch.id 
                        ? 'Processing...' 
                        : batch.exit_survey_enabled 
                          ? 'Disable Exit Survey' 
                          : 'Enable Exit Survey'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-4 py-2 rounded-xl">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Batch not eligible yet</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HODExitSurveyControl;
