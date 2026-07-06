import React, { useState } from 'react';
import {
  FileText,
  ArrowLeft,
  BookOpen,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Assessment {
  title: string;
  type: string;
  obtained: number;
  total: number;
  course?: { name: string } | string;
  semester?: { name: string } | string;
}

interface ResultData {
  assessments?: Assessment[];
  total?: number;
  percentage?: number;
  gpa?: number;
  status?: string;
}

interface CourseGroup {
  name: string;
  assessments: Assessment[];
}

interface StudentResultsProps {
  result: ResultData | null;
  loading: boolean;
}

const StudentResults: React.FC<StudentResultsProps> = ({ result, loading }) => {
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseGroup | null>(null);

  const getSemestersFromAssessments = (): string[] => {
    if (!result?.assessments) return ['All Semesters'];
    const semesterSet = new Set<string>();
    result.assessments.forEach((a) => {
      const semester = (a.semester as any)?.name || a.semester || 'All Semesters';
      semesterSet.add(semester as string);
    });
    return Array.from(semesterSet);
  };

  const getFilteredAssessments = (semesterLabel: string): Assessment[] => {
    if (!result?.assessments) return [];
    if (!semesterLabel || semesterLabel === 'All Semesters') return result.assessments;
    return result.assessments.filter((a) => {
      const s = (a.semester as any)?.name || a.semester || 'All Semesters';
      return s === semesterLabel;
    });
  };

  const groupBySubject = (assessments: Assessment[]): Record<string, Assessment[]> =>
    assessments.reduce((groups: Record<string, Assessment[]>, a) => {
      const subject = (a.course as any)?.name || a.course || 'Other';
      if (!groups[subject]) groups[subject] = [];
      groups[subject].push(a);
      return groups;
    }, {});

  const calcStats = (assessments: Assessment[]) => {
    const totalMarks = assessments.reduce((s, a) => s + (a.total || 0), 0);
    const obtainedMarks = assessments.reduce((s, a) => s + (a.obtained || 0), 0);
    const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '0.0';
    return { totalMarks, obtainedMarks, percentage };
  };

  const percentColor = (pct: number) =>
    pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600';

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  // ── Course Detail View ───────────────────────────────────────────────────────
  if (selectedCourse) {
    const { obtainedMarks, totalMarks, percentage } = calcStats(selectedCourse.assessments);

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedCourse(null)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-base bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Results
        </button>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800">{selectedCourse.name}</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Marks</p>
                <p className="text-3xl font-bold text-gray-900">
                  {obtainedMarks}
                  <span className="text-xl text-gray-400">/{totalMarks}</span>
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Percentage</p>
                <p className={`text-3xl font-bold ${percentColor(parseFloat(percentage))}`}>
                  {percentage}%
                </p>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assessments</p>
                <p className="text-3xl font-bold text-blue-600">{selectedCourse.assessments.length}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-100">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-pink-500" />
                  Assessments
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-4">Assessment</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4 text-center">Obtained</th>
                      <th className="px-6 py-4 text-center">Total</th>
                      <th className="px-6 py-4 text-center">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCourse.assessments.map((a, i) => {
                      const pct = a.total > 0 ? ((a.obtained / a.total) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-800">{a.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">{a.type}</td>
                          <td className="px-6 py-4 text-center font-semibold text-gray-900">{a.obtained}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-500">{a.total}</td>
                          <td className={`px-6 py-4 text-center font-semibold ${percentColor(parseFloat(pct))}`}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    );
  }

  // ── No Results ───────────────────────────────────────────────────────────────
  if (!result?.assessments?.length) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
        <p className="text-lg font-semibold">No results available</p>
      </div>
    );
  }

  // ── Semester List View ───────────────────────────────────────────────────────
  const assessmentSemesters = getSemestersFromAssessments();
  const semesterToDisplay = selectedSemester || assessmentSemesters[0] || null;
  const filteredAssessments = semesterToDisplay ? getFilteredAssessments(semesterToDisplay) : [];
  const groupedFilteredAssessments = groupBySubject(filteredAssessments);
  const semesterStats = calcStats(filteredAssessments);

  return (
    <div className="space-y-6">
      {/* Semester Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
      >
        <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-500" />
          Select Semester
        </label>
        <select
          value={semesterToDisplay || ''}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        >
          {assessmentSemesters.map((semester) => (
            <option key={semester} value={semester}>{semester}</option>
          ))}
        </select>
      </motion.div>

      {/* Semester Summary */}
      {semesterToDisplay && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
          >
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-500" />
              Overall Report — {semesterToDisplay}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Marks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {semesterStats.obtainedMarks}/{semesterStats.totalMarks}
                </p>
              </div>
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Percentage</p>
                <p className={`text-2xl font-bold ${percentColor(parseFloat(semesterStats.percentage))}`}>
                  {semesterStats.percentage}%
                </p>
              </div>
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assessments</p>
                <p className="text-2xl font-bold text-blue-600">{filteredAssessments.length}</p>
              </div>
            </div>
          </motion.div>

          {/* Course Cards */}
          <div className="space-y-4">
            {(Object.entries(groupedFilteredAssessments) as [string, Assessment[]][]).map(
              ([subjectName, assessments], idx) => {
                const { obtainedMarks, totalMarks, percentage } = calcStats(assessments);
                return (
                  <motion.div
                    key={subjectName}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.07 }}
                    onClick={() => setSelectedCourse({ name: subjectName, assessments })}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                          {subjectName}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">{assessments.length} assessments</p>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Marks</p>
                          <p className="font-bold text-gray-900">
                            {obtainedMarks}
                            <span className="text-gray-400 font-normal">/{totalMarks}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Score</p>
                          <p className={`text-xl font-bold ${percentColor(parseFloat(percentage))}`}>
                            {percentage}%
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  </motion.div>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentResults;
