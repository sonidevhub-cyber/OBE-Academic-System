import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, CheckCircle, AlertCircle, XCircle, ArrowLeft } from 'lucide-react';
import obeService, { CLOReportResponse, CourseSession } from '../../../api/obeService';
import { toast } from 'react-hot-toast';

const CoordinatorCLOReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [courseSessions, setCourseSessions] = useState<CourseSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [cloReport, setCloReport] = useState<CLOReportResponse | null>(null);

  // Fetch all batches on mount
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

  // Fetch course sessions when a batch is selected
  useEffect(() => {
    const fetchSessions = async () => {
      if (!selectedBatchId) {
        setCourseSessions([]);
        setSelectedSessionId(null);
        return;
      }

      setLoading(true);
      try {
        const data = await obeService.getCourseSessions(selectedBatchId);
        setCourseSessions(data.sessions);
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch course sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [selectedBatchId]);

  // Fetch CLO Report when a course session is selected
  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedSessionId) {
        setCloReport(null);
        return;
      }

      setLoading(true);
      try {
        const data = await obeService.getCourseCLOReport(selectedSessionId);
        setCloReport(data);
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch CLO report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedSessionId]);

  // --- Helpers ---
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
        return 'bg-emerald-100 text-emerald-700';
      case 'Provisional - CQI Pending':
      case 'BELOW_TARGET':
      case 'NEEDS_REVIEW':
        return 'bg-amber-100 text-amber-700';
      case 'NOT_ASSESSED':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Finalized':
      case 'ACHIEVED':
        return <CheckCircle className="w-4 h-4" />;
      case 'Provisional - CQI Pending':
      case 'BELOW_TARGET':
      case 'NEEDS_REVIEW':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  // --- Render Content ---
  if (loading && !batches.length) {
    return (
      <div className="space-y-6 p-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!selectedBatchId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black text-gray-900">CLO Reports</h2>
          <p className="text-gray-500 font-semibold mt-1">Select a batch to view course reports</p>
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

  if (!selectedSessionId) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900">CLO Reports</h2>
              <p className="text-gray-500 font-semibold mt-1">Select a course to view detailed CLO report</p>
            </div>
            <button
              onClick={() => setSelectedBatchId('')}
              className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Change Batch
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))
          ) : courseSessions.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
              <FileBarChart className="w-16 h-16 text-gray-300 mx-auto mb-6" />
              <h3 className="text-xl font-black text-gray-900">No course sessions found for this batch</h3>
            </div>
          ) : (
            courseSessions.map(session => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedSessionId(session.id)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">{session.course.code}</h3>
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(session.assessment_status === 'ASSESSMENT_DONE' ? 'Finalized' : 'NOT_ASSESSED')}`}>
                    {getStatusIcon(session.assessment_status === 'ASSESSMENT_DONE' ? 'Finalized' : 'NOT_ASSESSED')}
                    {session.assessment_status === 'ASSESSMENT_DONE' ? 'Finalized' : 'In Progress'}
                  </span>
                </div>
                <p className="text-gray-600 font-medium mb-2">{session.course.name}</p>
                <p className="text-gray-400 text-sm">{session.semester_name}</p>
              </motion.div>
            ))
          )}
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
        {[1, 2].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-full mb-2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!cloReport) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center">
        <XCircle className="w-16 h-16 text-gray-300 mx-auto mb-6" />
        <h3 className="text-xl font-black text-gray-900">No CLO report found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Back Button */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedSessionId(null)}
            className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </button>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(cloReport.course.semester.includes('Done') ? 'Finalized' : 'NOT_ASSESSED')}`}>
            {getStatusIcon(cloReport.course.semester.includes('Done') ? 'Finalized' : 'NOT_ASSESSED')}
            Finalized
          </span>
        </div>
        <h2 className="text-2xl font-black text-gray-900">{cloReport.course.title}</h2>
        <p className="text-gray-500 font-semibold mt-1">{cloReport.course.code} • {cloReport.course.semester}</p>
      </div>

      {/* 1. CLO Summary Cards */}
      <div>
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-indigo-600" />
          CLO Summary
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {cloReport.clo_summary.map((clo) => (
            <motion.div
              key={clo.clo_code}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white p-6 rounded-2xl shadow-sm border ${clo.status === 'NOT_ASSESSED' ? 'border-dashed border-gray-300' : 'border-gray-100'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">{clo.clo_code}</h4>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(clo.status)}`}>
                  {getStatusIcon(clo.status)}
                  {clo.status}
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-4">{clo.description}</p>

              {clo.status !== 'NOT_ASSESSED' && clo.overall_attainment ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-semibold">Attainment</span>
                    <span className="font-black text-indigo-600">{clo.overall_attainment.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${clo.status === 'ACHIEVED' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${clo.overall_attainment}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold">Target KPI</span>
                    <span className="font-black text-gray-700">{clo.target_kpi}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">No assessments mapped yet</p>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Mapped Assessments</p>
                <div className="flex flex-wrap gap-2">
                  {clo.mapped_assessments.length > 0 ? (
                    clo.mapped_assessments.map((a) => (
                      <span key={a} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                        {a}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">None</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 2. Assessment Effectiveness Table */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-indigo-600" />
          Assessment Effectiveness
        </h3>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Assessment</th>
                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Mapped CLOs</th>
                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Avg Attainment</th>
                <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Effectiveness</th>
              </tr>
            </thead>
            <tbody>
              {cloReport.assessment_effectiveness.map((assmnt, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-700">
                    {assmnt.is_single_point_of_failure ? (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500" title="Single point of failure">⚠️</span>
                        {assmnt.assessment_name}
                      </div>
                    ) : (
                      assmnt.assessment_name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {assmnt.mapped_clos.map((cloCode) => (
                        <span key={cloCode} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold">
                          {cloCode}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-gray-700">{assmnt.avg_attainment.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${getStatusBadgeColor(assmnt.effectiveness)}`}>
                      {assmnt.effectiveness}
                    </span>
                    {assmnt.note && <p className="text-xs text-gray-500 mt-1">{assmnt.note}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. CQI List */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-indigo-600" />
          CQI Records
        </h3>
        {cloReport.cqi_list.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-medium">
            No CQI records found
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">CLO</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Action Plan</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Instructor</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Approved By</th>
                  <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {cloReport.cqi_list.map((cqi, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-black text-gray-800">{cqi.clo_code}</div>
                      <div className="text-xs text-gray-500">{cqi.clo_description}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-700">{cqi.course_code}</td>
                    <td className="px-4 py-3 text-gray-700">{cqi.reason}</td>
                    <td className="px-4 py-3 text-gray-700">{cqi.action_plan}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{cqi.instructor}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{cqi.approved_by}</td>
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
};

export default CoordinatorCLOReportModule;
