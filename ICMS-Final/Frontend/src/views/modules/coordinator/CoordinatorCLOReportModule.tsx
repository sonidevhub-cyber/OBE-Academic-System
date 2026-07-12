
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, ArrowLeft, Download, RotateCw, CheckCircle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import obeService, {
  CLOMasterCompilationResponse,
  CLOMasterCompilationCourse,
  CLOMasterCompilationStudent,
  Batch
} from '../../../api/obeService';
import academicStructureService, { Program, Semester } from '../../../api/academicStructureService';
import { toast } from 'react-hot-toast';

type BatchCategory = 'all' | 'ongoing' | 'graduated';

const CoordinatorCLOReportModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allSemesters, setAllSemesters] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<BatchCategory>('all');
  const [report, setReport] = useState<CLOMasterCompilationResponse | null>(null);
  const [expandedCqi, setExpandedCqi] = useState<Set<string>>(new Set());

  const toggleCqi = (key: string) => {
    const newSet = new Set(expandedCqi);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedCqi(newSet);
  };

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [programsRes, batches] = await Promise.all([
          academicStructureService.getPrograms(),
          obeService.getAllBatches({ alumni_feedback: 'all' }),
        ]);
        const programs = programsRes.data;
        // Flatten all semesters from all programs
        const semesters = programs.flatMap((p: any) => p.semesters || []);
        // De-duplicate semesters by id
        const uniqueSemesters = Array.from(new Map(semesters.map((s: any) => [s.id, s])).values());
        setAllPrograms(programs);
        setAllSemesters(uniqueSemesters);
        setAllBatches(batches);
        
        if (batches.length > 0) {
          setSelectedProgramId(batches[0].program?.id || '');
          setSelectedBatchId(batches[0].id);
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Filter batches based on program and category
  const filteredBatches = selectedProgramId
    ? allBatches.filter((b) => {
        if (b.program?.id !== selectedProgramId) return false;
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      })
    : allBatches.filter((b) => {
        if (batchCategory === 'all') return true;
        if (batchCategory === 'ongoing') return b.status === 'active';
        if (batchCategory === 'graduated') return b.status === 'graduated';
        return true;
      });

  const loadReport = async (forceRefresh = false) => {
    if (!selectedProgramId || !selectedSemesterId || !selectedBatchId) return;

    setLoading(!report);
    try {
      const data = await obeService.getCLOMasterCompilation(
        selectedProgramId,
        selectedSemesterId,
        selectedBatchId,
        'json',
        forceRefresh
      );
      setReport(data as CLOMasterCompilationResponse);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load CLO Master Compilation');
    } finally {
      setLoading(false);
    }
  };

  // Fetch report when selections change
  useEffect(() => {
    loadReport(false);
  }, [selectedProgramId, selectedSemesterId, selectedBatchId]);

  useEffect(() => {
    if (!selectedProgramId || !selectedSemesterId || !selectedBatchId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadReport(false);
    }, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadReport(false);
      }
    };

    const handleFocus = () => {
      void loadReport(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedProgramId, selectedSemesterId, selectedBatchId]);

  // Handle export to Excel
  const handleExport = async () => {
    if (!report) return;

    try {
      const blob = await obeService.getCLOMasterCompilation(
        report.program.id,
        report.semester.id,
        selectedBatchId || undefined,
        'xlsx'
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CLO_Master_Compilation_${report.program.code}_${report.semester.name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Export successful!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export');
    }
  };

  const handleRefresh = () => {
    if (!selectedBatchId || !selectedSemesterId) return;

    const runRefresh = async () => {
      try {
        setLoading(true);
        await obeService.recalculateRetakeReports(selectedBatchId, selectedSemesterId);
        await loadReport(true);
        toast.success('Retake reports refreshed');
      } catch (error) {
        console.error(error);
        toast.error('Failed to refresh retake reports');
      } finally {
        setLoading(false);
      }
    };

    void runRefresh();
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FileBarChart className="w-6 h-6 text-indigo-600" />
              CLO Master Compilation
            </h2>
            <p className="text-gray-500 font-semibold mt-1">
              Semester-level live append of CLO attainment
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              <RotateCw className="w-4 h-4" />
              Refresh
            </button>
            {report && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </button>
            )}
          </div>
        </div>

        {/* Selection Area */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Program
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedSemesterId('');
                setSelectedBatchId('');
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="">Select a program</option>
              {allPrograms.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Batch Category
            </label>
            <select
              value={batchCategory}
              onChange={(e) => {
                setBatchCategory(e.target.value as BatchCategory);
                setSelectedBatchId('');
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="all">All Batches</option>
              <option value="ongoing">Ongoing</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value);
                setReport(null);
              }}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all"
            >
              <option value="">Select Semester</option>
              {allSemesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name} (Semester {s.number})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Select Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={!selectedProgramId}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 transition-all disabled:bg-gray-100"
            >
              <option value="">Select a batch</option>
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
        </div>
      )}

      {/* Report */}
      {!loading && report && (
        <>
          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border ${report.status.is_fully_compiled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-center gap-3">
              {report.status.is_fully_compiled ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <div className="font-black text-lg text-gray-800">
                  Courses Finalized: {report.status.finalized_count} / {report.status.total_count}
                </div>
                <div className="font-semibold text-gray-600">
                  {report.status.is_fully_compiled ? 'All courses finalized' : 'In Progress'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div 
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto w-full"
          >
            <div className="w-full">
            <table className="min-w-max text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50">
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-0 bg-gray-50 z-20">
                    Sr. No
                  </th>
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-[80px] bg-gray-50 z-20">
                    Reg. No
                  </th>
                  <th rowSpan={3} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wide border border-gray-200 sticky left-[180px] bg-gray-50 z-20">
                    Name
                  </th>
                  {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                    <th key={course.course_id} colSpan={course.clos.length} className="px-4 py-3 text-xs font-black text-indigo-700 uppercase tracking-wide border border-gray-200 bg-indigo-50">
                      {course.course_code}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  {/* Empty placeholders for the sticky left columns */}
                  {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                    course.clos.map((clo) => {
                      const cohortPercentage = clo.cohort_percentage ?? 0;
                      const kpiTarget = clo.kpi_target ?? 0;
                      const isAchieved = cohortPercentage >= kpiTarget;
                      return (
                        <th key={`${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200">
                          <div className="flex flex-col items-center gap-1">
                            {/* CLO Code with Target */}
                            <div className="font-semibold">
                              {clo.clo_code} (Target: {kpiTarget}%)
                            </div>
                            {/* Cohort Percentage */}
                            <div className="text-gray-500 text-xs">
                              {cohortPercentage.toFixed(2)}%
                            </div>
                            {/* Status Badge */}
                            <div className={`text-xs px-2 py-0.5 rounded-full ${isAchieved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {isAchieved ? '✅ Achieved' : '❌ CQI Triggered'}
                            </div>
                            {/* CQI Info Button */}
                            {clo.cqi && (
                              <button
                                onClick={() => toggleCqi(`${course.course_id}-${clo.clo_id}`)}
                                className="p-1 rounded-full hover:bg-indigo-100 text-indigo-600 flex items-center gap-1"
                              >
                                <Info size={14} />
                                {expandedCqi.has(`${course.course_id}-${clo.clo_id}`) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.students.map((student: CLOMasterCompilationStudent) => (
                  <React.Fragment key={student.sr_no}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-700 border border-gray-100 sticky left-0 bg-gray-50 z-10">
                        {student.sr_no}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-700 border border-gray-100 sticky left-[80px] bg-gray-50 z-10">
                        {student.reg_no}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 border border-gray-100 sticky left-[180px] bg-gray-50 z-10">
                        {student.name}
                      </td>
                      {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                        course.clos.map((clo) => {
                          const courseData = student.courses[course.course_id];
                          const cloData = courseData ? courseData[clo.clo_code] : null;
                          return (
                            <td key={`${student.sr_no}-${course.course_id}-${clo.clo_id}`} className={`px-3 py-2 text-center border border-gray-100 font-bold ${cloData ? (cloData.achieved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'text-gray-400'}`}>
                              {cloData ? `${cloData.score}%` : '-'}
                            </td>
                          );
                        })
                      ))}
                    </tr>
                    {/* Expanded CQI Row */}
                    {report.finalized_courses.some((c) => c.clos.some((clo) => clo.cqi && expandedCqi.has(`${c.course_id}-${clo.clo_id}`))) && (
                      <tr className="bg-yellow-50">
                        <td colSpan={3} className="px-4 py-2 sticky left-0 bg-yellow-50 z-10"></td>
                        {report.finalized_courses.map((course: CLOMasterCompilationCourse) => (
                          course.clos.map((clo) => {
                            const key = `${course.course_id}-${clo.clo_id}`;
                            if (clo.cqi && expandedCqi.has(key)) {
                              return (
                                <td key={key} colSpan={1} className="px-3 py-3 text-xs border border-gray-200 align-top">
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-bold text-gray-800">Reason:</span>
                                      <p className="mt-1 text-gray-700">{clo.cqi.reason}</p>
                                    </div>
                                    <div>
                                      <span className="font-bold text-gray-800">Action Plan:</span>
                                      <p className="mt-1 text-gray-700">{clo.cqi.action_plan}</p>
                                    </div>
                                    {clo.cqi.coordinator_comment && (
                                      <div>
                                        <span className="font-bold text-gray-800">Coordinator Comment:</span>
                                        <p className="mt-1 text-gray-700">{clo.cqi.coordinator_comment}</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            return <td key={key} colSpan={1} className="border border-gray-200"></td>;
                          })
                        ))}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {/* Summary Row 1: No. of Students Achieving CLOs KPI */}
                <tr className="border-t-2 border-gray-300 bg-indigo-50">
                  <td colSpan={3} className="px-4 py-3 font-black text-indigo-800 border border-gray-200 sticky left-0 bg-indigo-50 z-10">
                    No. of Students Achieving CLOs KPI (50%):
                  </td>
                  {report.finalized_courses.map((course) => 
                    course.clos.map((clo) => {
                      // Count achieved students for this clo
                      let achievedCount = 0;
                      for (const student of report.students) {
                        const courseData = student.courses[course.course_id];
                        const cloData = courseData ? courseData[clo.clo_code] : null;
                        if (cloData && cloData.achieved) {
                          achievedCount++;
                        }
                      }
                      return (
                        <td key={`count-${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-center border border-gray-200 font-black text-indigo-800">
                          {achievedCount}
                        </td>
                      );
                    })
                  )}
                </tr>
                {/* Summary Row 2: Percentage of Students Achieving CLOs KPI */}
                <tr className="border-t border-gray-300 bg-indigo-50">
                  <td colSpan={3} className="px-4 py-3 font-black text-indigo-800 border border-gray-200 sticky left-0 bg-indigo-50 z-10">
                    % of Students Achieving CLOs at Cohort-Level (50%):
                  </td>
                  {report.finalized_courses.map((course) => 
                    course.clos.map((clo) => {
                      // Calculate percentage
                      let achievedCount = 0;
                      for (const student of report.students) {
                        const courseData = student.courses[course.course_id];
                        const cloData = courseData ? courseData[clo.clo_code] : null;
                        if (cloData && cloData.achieved) {
                          achievedCount++;
                        }
                      }
                      const percentage = report.summary.total_students > 0 
                        ? ((achievedCount / report.summary.total_students) * 100).toFixed(2)
                        : '0.00';
                      return (
                        <td key={`percentage-${course.course_id}-${clo.clo_id}`} className="px-3 py-2 text-center border border-gray-200 font-black text-indigo-800">
                          {percentage}%
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          {/* Pending Courses */}
          {report.pending_courses.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                Pending Courses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.pending_courses.map((pc) => (
                  <div key={pc.course_id} className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-black text-amber-800">{pc.course_code} - {pc.course_name}</div>
                      <div className="text-sm font-semibold text-amber-700">Instructor: {pc.instructor_name}</div>
                    </div>
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CoordinatorCLOReportModule;
