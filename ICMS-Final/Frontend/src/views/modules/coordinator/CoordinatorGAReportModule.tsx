import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronRight, Download } from 'lucide-react';
import obeService from '../../../api/obeService';
import { toast } from 'react-hot-toast';

const CoordinatorGAReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);

  // --- Fetch data ---
  // Fetch batches on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const batchesData = await obeService.getAllBatches();
        setBatches(batchesData);
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch batches');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch GA Report for selected batch and poll every 5 seconds
  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedBatchId) {
        setReportData(null);
        return;
      }

      setLoading(true);
      try {
        const data = await obeService.getBatchGAReport(selectedBatchId);
        setReportData(data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch GA report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();

    // Poll every 5 seconds
    const intervalId = setInterval(fetchReport, 5000);
    return () => clearInterval(intervalId);
  }, [selectedBatchId]);

  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);

  // --- Helpers ---
  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs(prev =>
      prev.includes(gaCode)
        ? prev.filter(code => code !== gaCode)
        : [...prev, gaCode]
    );
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
      case 'FULLY_APPROVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'Provisional - CQI Pending':
      case 'PENDING_HOD_APPROVAL':
      case 'SEMESTER_EARLY_WARNING':
        return 'bg-amber-100 text-amber-700';
      case 'BELOW_TARGET':
      case 'PROGRAM_MASTER_CQI':
        return 'bg-rose-100 text-rose-700';
      case 'SENT_BACK':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
      case 'FULLY_APPROVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'Provisional - CQI Pending':
      case 'BELOW_TARGET':
      case 'PENDING_HOD_APPROVAL':
      case 'SEMESTER_EARLY_WARNING':
      case 'PROGRAM_MASTER_CQI':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  // --- Render ---
  if (loading && !batches.length) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!selectedBatchId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
          <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
          <div className="mt-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Batch</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
        <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-xl font-black text-gray-900">No GA report found</h3>
      </div>
    );
  }

  if (reportData.status === 'NOT_READY') {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
              <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
            </div>
            <button
              onClick={() => setSelectedBatchId('')}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              Change Batch
            </button>
          </div>
          <div className="mt-6">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Select Batch</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>{batch.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h3 className="text-xl font-black text-gray-900 mb-2">GA Report Not Ready Yet</h3>
            <p className="text-gray-500 font-semibold">Please resolve the following issues</p>
          </div>

          {/* Readiness Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Courses Assessment Done</p>
                <span className="text-lg font-black text-gray-900">
                  {reportData.readiness.courses_assessment_done}/{reportData.readiness.courses_total}
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${(reportData.readiness.courses_assessment_done / reportData.readiness.courses_total) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">GA CQIs Fully Approved</p>
                <span className="text-lg font-black text-gray-900">
                  {reportData.readiness.cqi_fully_approved}/{reportData.readiness.cqi_total}
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: reportData.readiness.cqi_total > 0 ? `${(reportData.readiness.cqi_fully_approved / reportData.readiness.cqi_total) * 100}%` : '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Blocking Reasons */}
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
            <p className="text-sm font-black text-amber-700 uppercase tracking-widest mb-4">Blocking Reasons</p>
            <ul className="space-y-2">
              {reportData.readiness.blocking_reasons.map((reason: string, idx: number) => (
                <li key={idx} className="flex items-center gap-3 text-amber-800 font-medium">
                  <span className="text-amber-500">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (reportData.status === 'READY') {
    return (
      <div className="space-y-6">
        {/* Header Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">GA Reports</h2>
              <p className="text-gray-500 font-semibold mt-1">Automatically generated when all course CLO reports are finalized</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedBatchId('')}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                Change Batch
              </button>
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100">
                <Download size={18} />
                Export Report
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Batch</p>
              <p className="text-xl font-bold text-gray-800">{reportData.batch.code}</p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Graduating Semester</p>
              <p className="text-xl font-bold text-gray-800">{reportData.batch.graduating_semester}</p>
            </div>
          </div>
        </div>

        {/* GA Summary Cards */}
        <div>
          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-indigo-600" />
            Graduate Attribute Summary
          </h3>
          <div className="space-y-4">
            {reportData.ga_summary.map((ga: any) => (
              <motion.div
                key={ga.ga_code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* GA Header */}
                <div
                  className="p-6 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleGAExpansion(ga.ga_code)}
                >
                  <div className="flex items-center gap-4">
                    {expandedGAs.includes(ga.ga_code) ? <ChevronDown size={20} className="text-gray-500" /> : <ChevronRight size={20} className="text-gray-500" />}
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-xl font-bold text-gray-800">{ga.ga_code}</h4>
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(ga.status)}`}>
                          {getStatusIcon(ga.status)}
                          {ga.status}
                        </span>
                      </div>
                      <p className="text-gray-600 font-medium">{ga.title}</p>
                    </div>
                  </div>

                  {/* GA Scores */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">D_GA</p>
                      <p className="text-lg font-bold text-indigo-600">{ga.d_ga.toFixed(1)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">I_GA</p>
                      <p className="text-lg font-bold text-purple-600">{ga.i_ga.toFixed(1)}%</p>
                    </div>
                    <div className="text-center border-l border-gray-200 pl-6">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">F_GA</p>
                      <p className="text-xl font-black text-gray-900">{ga.f_ga.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* Expandable Contributing Courses */}
                {expandedGAs.includes(ga.ga_code) && (
                  <div className="border-t border-gray-100 bg-gray-50 p-6">
                    <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Contributing Courses</h5>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course Code</th>
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ga.contributing_courses.map((course: any, idx: number) => (
                            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-bold text-gray-700">{course.course_code}</td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{course.course_ga_score.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* CQI List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-indigo-600" />
            GA CQI Records
          </h3>
          {reportData.cqi_list.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-medium">
              No GA CQI records found
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">GA</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Trigger Type</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Remedy</th>
                    <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.cqi_list.map((cqi: any, idx: number) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-black text-gray-800">{cqi.ga_code}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${getStatusBadgeColor(cqi.trigger_type)}`}>
                          {cqi.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{cqi.reason}</td>
                      <td className="px-4 py-3 text-gray-700">{cqi.remedy}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${getStatusBadgeColor(cqi.status)}`}>
                          {cqi.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default CoordinatorGAReportModule;
