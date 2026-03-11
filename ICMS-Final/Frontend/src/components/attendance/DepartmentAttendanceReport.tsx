import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import attendanceService from '../../api/attendanceService';

interface DepartmentStats {
  department: {
    name: string;
    code: string;
  };
  date_range: {
    from: string;
    to: string;
  };
  course_statistics: Record<string, {
    total: number;
    present: number;
    absent: number;
    late: number;
  }>;
  faculty_statistics: {
    total_records: number;
    present: number;
    absent: number;
    late: number;
    auto_marked: number;
    self_marked: number;
  };
  total_student_records: number;
  student_present: number;
  student_absent: number;
}

const DepartmentAttendanceReport: React.FC = () => {
  const [reportData, setReportData] = useState<DepartmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'faculty'>('overview');

  useEffect(() => {
    loadDepartmentReport();
  }, [dateRange]);

  const loadDepartmentReport = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getDepartmentAttendanceSummary(
        dateRange.from,
        dateRange.to
      );
      setReportData(data);
    } catch (error) {
      console.error('Error loading department report:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (present: number, total: number) => {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const exportReport = () => {
    if (!reportData) return;
    
    const csvContent = [
      ['Department Attendance Report'],
      [`Department: ${reportData.department.name} (${reportData.department.code})`],
      [`Period: ${reportData.date_range.from} to ${reportData.date_range.to}`],
      [''],
      ['STUDENT ATTENDANCE SUMMARY'],
      ['Total Records', 'Present', 'Absent', 'Attendance Rate'],
      [
        reportData.total_student_records.toString(),
        reportData.student_present.toString(),
        reportData.student_absent.toString(),
        `${calculatePercentage(reportData.student_present, reportData.total_student_records)}%`
      ],
      [''],
      ['FACULTY ATTENDANCE SUMMARY'],
      ['Total Records', 'Present', 'Absent', 'Late', 'Auto-marked', 'Self-marked'],
      [
        reportData.faculty_statistics.total_records.toString(),
        reportData.faculty_statistics.present.toString(),
        reportData.faculty_statistics.absent.toString(),
        reportData.faculty_statistics.late.toString(),
        reportData.faculty_statistics.auto_marked.toString(),
        reportData.faculty_statistics.self_marked.toString()
      ],
      [''],
      ['COURSE-WISE ATTENDANCE'],
      ['Course', 'Total', 'Present', 'Absent', 'Late', 'Attendance Rate'],
      ...Object.entries(reportData.course_statistics).map(([course, stats]) => [
        course,
        stats.total.toString(),
        stats.present.toString(),
        stats.absent.toString(),
        stats.late.toString(),
        `${calculatePercentage(stats.present, stats.total)}%`
      ])
    ];

    const csv = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `department-attendance-report-${reportData.date_range.from}-to-${reportData.date_range.to}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading department report...</span>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Department Attendance Report</h2>
            <p className="text-gray-600">{reportData.department.name} ({reportData.department.code})</p>
          </div>
          <div className="flex space-x-4">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={exportReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'courses', label: 'Course-wise' },
              { key: 'faculty', label: 'Faculty' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Student Attendance Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Attendance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Records:</span>
                <span className="font-semibold">{reportData.total_student_records}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Present:</span>
                <span className="font-semibold text-green-600">{reportData.student_present}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Absent:</span>
                <span className="font-semibold text-red-600">{reportData.student_absent}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Attendance Rate:</span>
                  <span className={`font-bold text-xl ${getPercentageColor(
                    calculatePercentage(reportData.student_present, reportData.total_student_records)
                  )}`}>
                    {calculatePercentage(reportData.student_present, reportData.total_student_records)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Faculty Attendance Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Faculty Attendance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Records:</span>
                <span className="font-semibold">{reportData.faculty_statistics.total_records}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Present:</span>
                <span className="font-semibold text-green-600">{reportData.faculty_statistics.present}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Absent:</span>
                <span className="font-semibold text-red-600">{reportData.faculty_statistics.absent}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Late:</span>
                <span className="font-semibold text-yellow-600">{reportData.faculty_statistics.late}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Attendance Rate:</span>
                  <span className={`font-bold text-xl ${getPercentageColor(
                    calculatePercentage(reportData.faculty_statistics.present, reportData.faculty_statistics.total_records)
                  )}`}>
                    {calculatePercentage(reportData.faculty_statistics.present, reportData.faculty_statistics.total_records)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course-wise Attendance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(reportData.course_statistics).map(([course, stats]) => {
                  const percentage = calculatePercentage(stats.present, stats.total);
                  return (
                    <tr key={course}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {course}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stats.total}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {stats.present}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {stats.absent}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                        {stats.late}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${getPercentageColor(percentage)}`}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Faculty Tab */}
      {activeTab === 'faculty' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Faculty Attendance Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{reportData.faculty_statistics.total_records}</div>
              <div className="text-sm text-blue-600">Total Records</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{reportData.faculty_statistics.present}</div>
              <div className="text-sm text-green-600">Present</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{reportData.faculty_statistics.absent}</div>
              <div className="text-sm text-red-600">Absent</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{reportData.faculty_statistics.late}</div>
              <div className="text-sm text-yellow-600">Late</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{reportData.faculty_statistics.auto_marked}</div>
              <div className="text-sm text-purple-600">Auto-marked</div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-indigo-600">{reportData.faculty_statistics.self_marked}</div>
              <div className="text-sm text-indigo-600">Self-marked</div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Faculty Attendance Insights</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Auto-marked attendance indicates faculty were present during teaching hours</p>
              <p>• Self-marked attendance shows proactive attendance management</p>
              <p>• Overall faculty attendance rate: <span className={`font-semibold ${getPercentageColor(
                calculatePercentage(reportData.faculty_statistics.present, reportData.faculty_statistics.total_records)
              )}`}>
                {calculatePercentage(reportData.faculty_statistics.present, reportData.faculty_statistics.total_records)}%
              </span></p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DepartmentAttendanceReport;