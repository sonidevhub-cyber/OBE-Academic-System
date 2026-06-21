import React, { useState, useEffect, useMemo } from 'react';
import obeService, { GAReportItem, Batch, BatchGAReportResponse } from '../api/obeService';
import { toast } from 'react-hot-toast';
import authService from '../api/authService';

const GAReport: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [mode, setMode] = useState<'semester' | 'cumulative'>('cumulative');
  const [scope, setScope] = useState<'cohort' | 'student'>('cohort');
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [report, setReport] = useState<GAReportItem[] | { ready: boolean; [key: string]: any } | BatchGAReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedGA, setExpandedGA] = useState<string | null>(null);
  const [expandedCqiForm, setExpandedCqiForm] = useState<{ [key: string]: boolean }>({});
  const [localCqiData, setLocalCqiData] = useState<{ [key: string]: { root_cause: string; remedial_plan: string; hod_comment: string } }>({});
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});
  const [isProgramEndReady, setIsProgramEndReady] = useState<boolean>(false);

  // Get actual user role
  const authData = authService.getCurrentUser();
  const userRole = useMemo((): 'hod' | 'coordinator' | 'teacher' | 'student' => {
    if (authData?.role === 'hod' || authData?.user?.secondary_role === 'hod') return 'hod';
    if (authData?.role === 'coordinator' || authData?.user?.secondary_role === 'coordinator') return 'coordinator';
    if (authData?.role === 'teacher' || authData?.user?.secondary_role === 'teacher') return 'teacher';
    return 'student';
  }, [authData]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await obeService.getAllBatches();
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatch(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch batches:', error);
      }
    };
    fetchBatches();
  }, []);

  const gaItems = useMemo(() => {
    if (!report) return [];
    if ('ga_reports' in report) return report.ga_reports;
    if (Array.isArray(report)) return report;
    return [];
  }, [report]);

  useEffect(() => {
    if (!selectedBatch) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const params: any = { mode: 'cumulative', scope };
        if (scope === 'student' && selectedStudentId) {
          params.student_id = selectedStudentId;
        }
        console.log('Fetching GA report with params:', params);
        const data = await obeService.getBatchGAReport(selectedBatch, params);
        console.log('Received data:', data);
        setReport(data);
        
        // Set isProgramEndReady
        if ('is_program_end_ready' in data) {
          setIsProgramEndReady(data.is_program_end_ready);
        } else {
          setIsProgramEndReady(false);
        }

        // Initialize local CQI data
        const initialCqiData: typeof localCqiData = {};
        const items = 'ga_reports' in data ? data.ga_reports : (Array.isArray(data) ? data : []);
        items.forEach(ga => {
          ga.ga_cqi_records.forEach(cqi => {
            initialCqiData[cqi.id] = {
              root_cause: cqi.root_cause || '',
              remedial_plan: cqi.remedial_plan || '',
              hod_comment: ''
            };
          });
        });
        setLocalCqiData(initialCqiData);
      } catch (error) {
        console.error('Failed to fetch GA report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedBatch, scope, selectedStudentId]);

  const isReady = useMemo(() => {
    if (!report) return false;
    if ('ready' in report) return report.ready;
    return true;
  }, [report]);

  const failedGAs = useMemo(() => {
    return gaItems.filter((ga: GAReportItem) => ga.status === 'BELOW_TARGET');
  }, [gaItems]);

  const refreshReport = async () => {
    const params: any = { mode: 'cumulative', scope };
    if (scope === 'student' && selectedStudentId) {
      params.student_id = selectedStudentId;
    }
    const newReport = await obeService.getBatchGAReport(selectedBatch, params);
    setReport(newReport);
    if ('is_program_end_ready' in newReport) {
      setIsProgramEndReady(newReport.is_program_end_ready);
    }
  };

  const handleSaveDraft = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      await obeService.updateGACQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan
      });
      await refreshReport();
      toast.success('Draft saved successfully!');
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleSubmitToHod = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      // Update the existing record and set status to PENDING
      await obeService.updateGACQIRecord(cqiId, {
        root_cause: data.root_cause,
        remedial_plan: data.remedial_plan,
        status: 'PENDING'
      });
      await refreshReport();
      toast.success('Submitted — awaiting HOD approval!');
    } catch (error) {
      console.error('Failed to submit to HOD:', error);
      toast.error('Failed to submit to HOD');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleApprove = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      await obeService.approveGACQI(cqiId);
      await refreshReport();
      toast.success('CQI approved!');
    } catch (error) {
      console.error('Failed to approve CQI:', error);
      toast.error('Failed to approve CQI');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  const handleReject = async (cqiId: string) => {
    setSubmitting(prev => ({ ...prev, [cqiId]: true }));
    try {
      const data = localCqiData[cqiId];
      await obeService.rejectGACQI(cqiId, data.hod_comment);
      await refreshReport();
      toast.success('CQI sent back!');
    } catch (error) {
      console.error('Failed to reject CQI:', error);
      toast.error('Failed to reject CQI');
    } finally {
      setSubmitting(prev => ({ ...prev, [cqiId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">GA Attainment Report</h1>
          <p className="text-slate-500 font-medium mt-1">
            {batches.find(b => b.id === selectedBatch)?.name || 'Select a batch'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Batch:</span>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
          >
            {batches.map(batch => (
              <option key={batch.id} value={batch.id}>{batch.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Mode:</span>
          <button
            onClick={() => setMode('semester')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'semester'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Semester-wise
          </button>
          <button
            onClick={() => setMode('cumulative')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'cumulative'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Cumulative
          </button>
        </div>

        {mode === 'semester' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(Number(e.target.value))}
              className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Scope:</span>
          <button
            onClick={() => setScope('cohort')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scope === 'cohort'
              ? 'bg-green-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Cohort
          </button>
          <button
            onClick={() => setScope('student')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scope === 'student'
              ? 'bg-green-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Student
          </button>
        </div>

        {scope === 'student' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Student:</span>
            <input
              type="text"
              placeholder="Enter Student ID"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 outline-none"
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {!loading && !isReady && report && 'ready' in report && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg mb-8">
          <h3 className="text-yellow-900 font-bold text-lg">Report Not Ready</h3>
          <p className="text-yellow-800 mt-2">
            {report.message || `Finalized ${report.finalized_courses}/${report.total_courses} courses.`}
          </p>
          {report.missing_courses && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-yellow-700">Missing Courses:</h4>
              <ul className="list-disc list-inside text-sm text-yellow-800 mt-2">
                {report.missing_courses.map((course: string, idx: number) => (
                  <li key={idx}>{course}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && isReady && report && !('ready' in report) && (
        <div className="space-y-8">
          {/* GA Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {gaItems.map((ga: GAReportItem) => {
              const isExpanded = expandedGA === ga.ga_id;

              return (
                <div
                  key={ga.ga_id}
                  className={`bg-white rounded-[24px] shadow-sm border transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-500 border-transparent shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
                >
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => setExpandedGA(isExpanded ? null : ga.ga_id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800">
                        {ga.ga_code} — {ga.ga_title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${ga.status === 'ACHIEVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'}`}
                      >
                        {ga.status === 'ACHIEVED' ? 'Achieved ✅' : 'Below Target ❌'}
                      </span>
                    </div>

                    <div className="relative pt-2 pb-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">
                          Attainment: {ga.ga_attainment ? `${ga.ga_attainment.toFixed(1)}%` : 'N/A'}
                        </span>
                        <span className="text-indigo-600">KPI: {ga.kpi_threshold}%</span>
                      </div>
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                        {ga.ga_attainment !== null && (
                          <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${ga.status === 'ACHIEVED' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(ga.ga_attainment, 100)}%` }}
                          />
                        )}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-indigo-600 z-10"
                          style={{ left: `${ga.kpi_threshold}%` }}
                          title={`KPI: ${ga.kpi_threshold}%`}
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[24px] animate-in fade-in slide-in-from-top-2 duration-300">
                      <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">
                        Contributing Courses
                      </h4>
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider">
                                Course Code
                              </th>
                              <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                GA Score
                              </th>
                              {scope === 'cohort' && (
                                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">
                                  Enrolled Students
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {ga.contributing_courses.map((course: GAReportContributingCourse, idx: number) => (
                              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-slate-700">
                                  {course.course_code}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`text-sm font-black ${course.course_ga_score >= ga.kpi_threshold
                                      ? 'text-emerald-600'
                                      : 'text-rose-600'}`}
                                  >
                                    {course.course_ga_score.toFixed(1)}%
                                  </span>
                                </td>
                                {scope === 'cohort' && (
                                  <td className="px-4 py-3 text-center text-sm text-slate-600">
                                    {course.enrolled_students}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {scope === 'cohort' && isProgramEndReady && ga.ga_cqi_records.length > 0 && (
                        <div className="mt-6 space-y-4">
                          <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                            CQI Records
                          </h4>
                          {ga.ga_cqi_records.map((cqi: GACQIRecord, idx: number) => (
                            <div
                              key={idx}
                              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${cqi.status === 'FULLY_APPROVED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : cqi.status === 'SENT_BACK'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-blue-100 text-blue-700'}`}
                                  >
                                    {cqi.status}
                                  </span>
                                  <span className="text-sm font-bold text-slate-700">
                                    {cqi.cqi_level}
                                    {cqi.semester && ` — Semester ${cqi.semester}`}
                                  </span>
                                </div>
                                {cqi.attainment_value !== null && (
                                  <span className="text-sm text-slate-500">
                                    Attainment: {cqi.attainment_value.toFixed(1)}%
                                  </span>
                                )}
                              </div>

                              {/* Inline CQI Form for PENDING/SENT_BACK status */}
                              {(cqi.status === 'PENDING' || cqi.status === 'SENT_BACK') && (userRole === 'hod' || userRole === 'coordinator') && (
                                <div className="mt-4">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedCqiForm(prev => ({ ...prev, [cqi.id]: !prev[cqi.id] }));
                                    }}
                                    className="text-indigo-600 text-sm font-bold hover:underline mb-3 inline-block"
                                  >
                                    {expandedCqiForm[cqi.id] ? 'Hide Form' : 'Open CQI Form'}
                                  </button>

                                  {expandedCqiForm[cqi.id] && (
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-2">
                                      {cqi.status === 'SENT_BACK' && cqi.hod_comment && (
                                        <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg">
                                          <p className="text-sm font-bold text-yellow-900">HOD Comment:</p>
                                          <p className="text-sm text-yellow-800 mt-1">{cqi.hod_comment}</p>
                                        </div>
                                      )}

                                      {userRole === 'coordinator' && (
                                        <div className="space-y-4 mb-4">
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Root Cause
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.root_cause || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], root_cause: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={4}
                                              placeholder="Describe the root cause of the GA-level deficiency..."
                                              disabled={cqi.status === 'PENDING' && !cqi.is_locked}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Remedial Plan
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.remedial_plan || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], remedial_plan: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={4}
                                              placeholder="Describe the remedial action plan..."
                                              disabled={cqi.status === 'PENDING' && !cqi.is_locked}
                                            />
                                          </div>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveDraft(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-bold hover:bg-slate-600 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Saving...' : 'Save Draft'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSubmitToHod(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Submitting...' : 'Submit to HOD'}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {userRole === 'hod' && (
                                        <div className="space-y-4">
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Root Cause
                                            </label>
                                            <textarea
                                              value={cqi.root_cause || ''}
                                              disabled
                                              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-100"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              Remedial Plan
                                            </label>
                                            <textarea
                                              value={cqi.remedial_plan || ''}
                                              disabled
                                              className="w-full p-3 border border-slate-300 rounded-lg bg-slate-100"
                                              rows={4}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                              HOD Comment (if sending back)
                                            </label>
                                            <textarea
                                              value={localCqiData[cqi.id]?.hod_comment || ''}
                                              onChange={(e) => setLocalCqiData(prev => ({
                                                ...prev,
                                                [cqi.id]: { ...prev[cqi.id], hod_comment: e.target.value }
                                              }))}
                                              className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                              rows={3}
                                              placeholder="Enter comment if sending back..."
                                            />
                                          </div>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleApprove(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Approving...' : 'Approve'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReject(cqi.id);
                                              }}
                                              disabled={submitting[cqi.id]}
                                              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 disabled:bg-slate-400"
                                            >
                                              {submitting[cqi.id] ? 'Sending Back...' : 'Send Back'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Display existing CQI data */}
                              {cqi.root_cause && (
                                <div className="mb-2">
                                  <span className="text-xs font-bold text-slate-500 uppercase">Root Cause:</span>
                                  <p className="text-sm text-slate-700 mt-1">{cqi.root_cause}</p>
                                </div>
                              )}
                              {cqi.remedial_plan && (
                                <div>
                                  <span className="text-xs font-bold text-slate-500 uppercase">Remedial Plan:</span>
                                  <p className="text-sm text-slate-700 mt-1">{cqi.remedial_plan}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CQI Flags for Cohort (only when program end ready) */}
          {scope === 'cohort' && isProgramEndReady && failedGAs.length > 0 && (
            <div className="mt-12 space-y-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Continuous Quality Improvement (CQI) Required
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {failedGAs.map((ga: GAReportItem) => (
                  <div
                    key={ga.ga_id}
                    className="bg-white border-2 border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-rose-50 rounded-2xl">
                        <span className="text-rose-600 font-black text-lg">⚠️</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-rose-900">
                          {ga.ga_code} — {ga.ga_title}
                        </h4>
                        <p className="text-sm text-rose-700 mt-2">
                          Attainment: {ga.ga_attainment?.toFixed(1)}% (Target: {ga.kpi_threshold}%)
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GAReport;
