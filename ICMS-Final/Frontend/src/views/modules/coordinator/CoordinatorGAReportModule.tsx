import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronRight, Download, Send, X, MessageSquare, History } from 'lucide-react';
import obeService from '../../../api/obeService';
import authService from '../../../api/authService';
import { toast } from 'react-hot-toast';
import { GACQIRecord, GACQIResubmissionHistory, GAReportItem, ReadinessResponse, BatchGAReportResponse } from '../../../api/obeService';

const CoordinatorGAReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [reportData, setReportData] = useState<GAReportItem[] | ReadinessResponse | BatchGAReportResponse | null>(null);
  const [isProgramEndReady, setIsProgramEndReady] = useState<boolean>(false);
  const [expandedGAs, setExpandedGAs] = useState<string[]>([]);
  const [expandedCqiForm, setExpandedCqiForm] = useState<string | null>(null);
  const [localCqiData, setLocalCqiData] = useState<Record<string, Partial<GACQIRecord>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [scope, setScope] = useState<'cohort' | 'student'>('cohort');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  // Get current user and role
  const currentAuth = authService.getCurrentUser();
  const isHod = currentAuth?.role === 'hod' || currentAuth?.user?.secondary_role === 'hod';
  const isCoordinator = currentAuth?.role === 'coordinator' || currentAuth?.user?.secondary_role === 'coordinator';


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

  // Fetch GA Report for selected batch
  useEffect(() => {
    const fetchReport = async () => {
      if (!selectedBatchId) {
        setReportData(null);
        setIsProgramEndReady(false);
        return;
      }

      setLoading(true);
      try {
        const params: any = { mode: 'cumulative', scope };
        if (scope === 'student' && selectedStudentId) {
          params.student_id = selectedStudentId;
        }
        const data = await obeService.getBatchGAReport(selectedBatchId, params);
        setReportData(data);
        // Check if data is the new format
        if (data && 'is_program_end_ready' in data) {
          setIsProgramEndReady(data.is_program_end_ready);
        } else {
          setIsProgramEndReady(false);
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to fetch GA report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedBatchId, scope, selectedStudentId]);

  const toggleGAExpansion = (gaCode: string) => {
    setExpandedGAs(prev =>
      prev.includes(gaCode)
        ? prev.filter(code => code !== gaCode)
        : [...prev, gaCode]
    );
  };

  const toggleCqiForm = (cqiId: string) => {
    setExpandedCqiForm(prev => prev === cqiId ? null : cqiId);
  };

  const toggleHistory = (cqiId: string) => {
    setExpandedHistory(prev => prev === cqiId ? null : cqiId);
  };

  const handleCqiInputChange = (cqiId: string, field: keyof GACQIRecord, value: any) => {
    setLocalCqiData(prev => ({
      ...prev,
      [cqiId]: {
        ...prev[cqiId],
        [field]: value
      }
    }));
  };

  const handleSaveDraft = async (cqi: any) => {
    setSubmitting(true);
    try {
      const data = localCqiData[cqi.id] || {};
      await obeService.updateGACQIRecord(cqi.id, data);
      toast.success('Draft saved successfully');
      // Refetch the report
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToHod = async (cqi: any) => {
    setSubmitting(true);
    try {
      const data = {
        ...(localCqiData[cqi.id] || {}),
        status: 'PENDING' as const
      };
      await obeService.updateGACQIRecord(cqi.id, data);
      toast.success('Submitted - awaiting HOD approval');
      // Refetch the report
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
      setExpandedCqiForm(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit to HOD');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveCqi = async (cqiId: string) => {
    setSubmitting(true);
    try {
      await obeService.approveGACQI(cqiId);
      toast.success('CQI approved');
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectCqi = async (cqiId: string) => {
    const comment = prompt('Please provide a rejection comment:');
    if (!comment) return;
    setSubmitting(true);
    try {
      await obeService.rejectGACQI(cqiId, comment);
      toast.success('CQI rejected');
      const params: any = { mode: 'cumulative', scope };
      if (scope === 'student' && selectedStudentId) {
        params.student_id = selectedStudentId;
      }
      const report = await obeService.getBatchGAReport(selectedBatchId, params);
      setReportData(report);
      if (report && 'is_program_end_ready' in report) {
        setIsProgramEndReady(report.is_program_end_ready);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(false);
    }
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
    return null;
  }

  // Type guard to check if it's a readiness response
  const isReadinessResponse = (data: any): data is ReadinessResponse => {
    return data && typeof data.ready === 'boolean';
  };

  // Type guard to check if it's a BatchGAReportResponse
  const isBatchGAReportResponse = (data: any): data is BatchGAReportResponse => {
    return data && typeof data.is_program_end_ready === 'boolean' && Array.isArray(data.ga_reports);
  };

  // Type guard to check if it's a GA array
  const isGAArray = (data: any): data is GAReportItem[] => {
    return Array.isArray(data);
  };

  // Helper to get GA items from report data
  const getGAItems = (): GAReportItem[] => {
    if (isBatchGAReportResponse(reportData)) {
      return reportData.ga_reports;
    } else if (isGAArray(reportData)) {
      return reportData;
    }
    return [];
  };

  // Handle readiness response (not ready)
  if (isReadinessResponse(reportData) && !reportData.ready) {
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
                  {reportData.finalized_courses ?? 0}/{reportData.total_courses ?? 0}
                </span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${((reportData.finalized_courses ?? 0) / (reportData.total_courses ?? 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Blocking Reasons */}
          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
            <p className="text-sm font-black text-amber-700 uppercase tracking-widest mb-4">Blocking Reasons</p>
            <ul className="space-y-2">
              {(reportData.missing_courses ?? []).map((course: string, idx: number) => (
                <li key={idx} className="flex items-center gap-3 text-amber-800 font-medium">
                  <span className="text-amber-500">•</span>
                  Course {course} assessment not done
                </li>
              ))}
              {(reportData.missing_courses ?? []).length === 0 && (
                <li className="flex items-center gap-3 text-amber-800 font-medium">
                  <span className="text-amber-500">•</span>
                  Report not ready
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // If neither array nor new response, return null
  if (!isGAArray(reportData) && !isBatchGAReportResponse(reportData)) {
    return null;
  }

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
        
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Scope</label>
            <select
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'cohort' | 'student')}
            >
              <option value="cohort">Cohort (Batch)</option>
              <option value="student">Student</option>
            </select>
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
        {getGAItems().map((ga: GAReportItem) => (

            <motion.div
              key={ga.ga_code ?? `ga-${Math.random()}`}
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
                    <p className="text-gray-600 font-medium">{ga.ga_title}</p>
                  </div>
                </div>

                {/* GA Attainment */}
                <div className="text-center">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">GA Attainment</p>
                  <p className="text-2xl font-black text-gray-900">{ga.ga_attainment?.toFixed(1) ?? '0.0'}%</p>
                  <p className="text-xs text-gray-500">KPI: {ga.kpi_threshold?.toFixed(1) ?? '0.0'}%</p>
                </div>
              </div>

              {/* Expandable Contributing Courses */}
              {expandedGAs.includes(ga.ga_code) && (
                <div className="border-t border-gray-100 bg-gray-50 p-6">
                  <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Contributing Courses</h5>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white mb-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                        <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                        <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ga.contributing_courses ?? []).map((course: any, idx: number) => (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-700">
                              {course.course_code ?? 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {course.course_name ?? 'N/A'}
                              {course.semester && (
                                <span className="ml-2 text-xs font-semibold text-gray-500">(Semester {course.semester})</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">{course.course_ga_score?.toFixed(1) ?? '0.0'}%</td>
                          <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students ?? '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                  {/* GA CQI Records (only for cohort and program end ready) */}
                  {scope === 'cohort' && isProgramEndReady && ga.ga_cqi_records && ga.ga_cqi_records.length > 0 && (
                    <div>
                      <h5 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">GA CQI Records</h5>
                      <div className="space-y-4">
                        {ga.ga_cqi_records.map((cqi: any) => (
                          <div key={cqi.id ?? `cqi-${Math.random()}`} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                            <div
                              className="p-4 flex items-center justify-between cursor-pointer bg-gray-50"
                              onClick={() => toggleCqiForm(cqi.id ?? '')}
                            >
                              <div className="flex items-center gap-3">
                                {expandedCqiForm === cqi.id ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(cqi.status ?? '')}`}>
                                      {getStatusIcon(cqi.status ?? '')}
                                      {cqi.status ?? 'N/A'}
                                    </span>
                                    <span className="text-sm font-bold text-gray-700">
                                      {cqi.cqi_level === 'SEMESTER' ? 'Semester End CQI' : cqi.cqi_level === 'CUMULATIVE' ? 'Program End CQI' : cqi.cqi_level ?? 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHistory(cqi.id ?? '');
                                  }}
                                  className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 font-medium text-sm"
                                >
                                  <History size={16} />
                                  History
                                </button>
                              </div>
                            </div>

                            {/* CQI History */}
                            {expandedHistory === cqi.id && (
                              <div className="p-4 border-t border-gray-100">
                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Submission History</div>
                                <div className="space-y-3">
                                  {cqi.history && cqi.history.length > 0 ? (
                                    cqi.history.map((history: GACQIResubmissionHistory, idx: number) => (
                                      <div key={history.id} className="bg-gray-50 p-3 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className={`text-xs font-black uppercase tracking-wider ${getStatusBadgeColor(history.status_at_time ?? '')}`}>
                                            {history.status_at_time}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {new Date(history.submitted_at).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                          {history.root_cause_snapshot && <div><span className="font-semibold">Root Cause:</span> {history.root_cause_snapshot}</div>}
                                          {history.remedial_plan_snapshot && <div><span className="font-semibold">Remedial Plan:</span> {history.remedial_plan_snapshot}</div>}
                                          {history.hod_comment_snapshot && <div><span className="font-semibold">HOD Comment:</span> {history.hod_comment_snapshot}</div>}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-500">No history available</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CQI Form */}
                            {expandedCqiForm === cqi.id && (
                              <div className="p-4 border-t border-gray-100">
                                {/* Contributing Courses (for context) */}
                {cqi.contributing_courses && cqi.contributing_courses.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileBarChart size={16} className="text-indigo-600" />
                      <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Contributing Courses (sorted by lowest GA score)</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Course</th>
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Course GA Score</th>
                            <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider text-center">Enrolled Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cqi.contributing_courses ?? []).map((course: any, idx: number) => (
                            <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-gray-700">
                                  {course.course_code ?? 'N/A'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {course.course_name ?? 'N/A'}
                                  {course.semester && (
                                    <span className="ml-2 text-xs font-semibold text-gray-500">(Semester {course.semester})</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{course.course_ga_score?.toFixed(1) ?? '0.0'}%</td>
                              <td className="px-4 py-3 text-center font-bold text-gray-700">{course.enrolled_students ?? '0'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                                {cqi.hod_comment && (
                                  <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                      <MessageSquare size={16} className="text-amber-600" />
                                      <span className="text-sm font-bold text-amber-700">HOD Comment</span>
                                    </div>
                                    <p className="text-sm text-amber-800">{cqi.hod_comment}</p>
                                  </div>
                                )}

                                {cqi.is_locked && (
                                  <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle size={16} className="text-green-600" />
                                      <span className="text-sm font-bold text-green-700">Locked - Program End CQI Approved</span>
                                    </div>
                                  </div>
                                )}

                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Root Cause</label>
                                    <textarea
                                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
                                      rows={3}
                                      value={localCqiData[cqi.id]?.root_cause ?? cqi.root_cause ?? ''}
                                      onChange={(e) => handleCqiInputChange(cqi.id ?? '', 'root_cause', e.target.value)}
                                      disabled={cqi.status === 'FULLY_APPROVED' || cqi.is_locked || !isCoordinator}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Remedial Plan</label>
                                    <textarea
                                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
                                      rows={3}
                                      value={localCqiData[cqi.id]?.remedial_plan ?? cqi.remedial_plan ?? ''}
                                      onChange={(e) => handleCqiInputChange(cqi.id ?? '', 'remedial_plan', e.target.value)}
                                      disabled={cqi.status === 'FULLY_APPROVED' || cqi.is_locked || !isCoordinator}
                                    />
                                  </div>

                                  <div className="flex items-center justify-between">
                                    {!cqi.is_locked && cqi.status !== 'FULLY_APPROVED' && (
                                      <div className="flex items-center gap-2">
                                        {cqi.status === 'PENDING' ? (
                                          <>
                                            {isHod && (
                                              <>
                                                <button
                                                  onClick={() => handleApproveCqi(cqi.id ?? '')}
                                                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                  disabled={submitting}
                                                >
                                                  <CheckCircle size={16} />
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => handleRejectCqi(cqi.id ?? '')}
                                                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                  disabled={submitting}
                                                >
                                                  <XCircle size={16} />
                                                  Reject
                                                </button>
                                              </>
                                            )}
                                          </>
                                        ) : (
                                          isCoordinator && (
                                            <>
                                              <button
                                                onClick={() => handleSaveDraft(cqi)}
                                                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                disabled={submitting}
                                              >
                                                Save Draft
                                              </button>
                                              <button
                                                onClick={() => handleSubmitToHod(cqi)}
                                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                                                disabled={submitting}
                                              >
                                                <Send size={16} />
                                                Submit to HOD
                                              </button>
                                            </>
                                          )
                                        )}
                                      </div>
                                    )}
                                    <button
                                      onClick={() => setExpandedCqiForm(null)}
                                      className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium"
                                    >
                                      <XCircle size={16} />
                                      Close
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoordinatorGAReportModule;
