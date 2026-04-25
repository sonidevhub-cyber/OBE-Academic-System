import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, CheckCircle, FileText, Clock } from 'lucide-react';
import AttendanceUpdateRequestsPanel from './AttendanceUpdateRequestsPanel';
import FacultySelfAttendanceComponent from './FacultySelfAttendanceComponent';
import attendanceReportsService, { StudentAttendanceRecord, FacultyAttendanceRecord } from '../../api/attendanceReportsService';

interface DepartmentStats {
  department_name: string;
  total_students: number;
  total_faculty: number;
  average_attendance: number;
  courses_count: number;
  today_present: number;
  today_absent: number;
  trend_percentage: number;
}

interface CourseAnalytics {
  course_name: string;
  course_code: string;
  instructor_name: string;
  semester: string;
  attendance_rate: number;
  total_classes: number;
  present_count: number;
  absent_count: number;
  trend: 'up' | 'down' | 'stable';
  risk_level: 'low' | 'medium' | 'high';
}

interface DepartmentSemester {
  semester_id: number;
  name: string;
}

interface DepartmentCourse {
  course_id: number;
  name: string;
  code: string;
  semester: number;
}

interface DepartmentInstructor {
  id: number;
  name: string;
}

interface HODAttendanceDashboardProps {
  className?: string;
}

const HODAttendanceDashboard: React.FC<HODAttendanceDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'courses' | 'reports' | 'requests' | 'self'>('analytics');
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats | null>(null);
  const [courseAnalytics, setCourseAnalytics] = useState<CourseAnalytics[]>([]);
  const [studentRecords, setStudentRecords] = useState<StudentAttendanceRecord[]>([]);
  const [instructorRecords, setInstructorRecords] = useState<FacultyAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentSemesters, setDepartmentSemesters] = useState<DepartmentSemester[]>([]);
  const [departmentCourses, setDepartmentCourses] = useState<DepartmentCourse[]>([]);
  const [departmentInstructors, setDepartmentInstructors] = useState<DepartmentInstructor[]>([]);
  const [reportSemesterId, setReportSemesterId] = useState('');
  const [reportCourseCode, setReportCourseCode] = useState('');
  const [reportInstructorName, setReportInstructorName] = useState('');

  useEffect(() => {
    fetchDepartmentContext();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchDepartmentStats();
    } else if (activeTab === 'courses') {
      fetchCourseAnalytics();
    } else if (activeTab === 'reports') {
      fetchDetailedReports();
    }
  }, [activeTab, selectedPeriod, selectedSemester]);

  const getDateRangeForSelectedPeriod = () => {
    const period = Number(selectedPeriod) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - Math.max(period, 1));

    const toDateString = (d: Date) => d.toISOString().split('T')[0];
    return {
      dateFrom: toDateString(startDate),
      dateTo: toDateString(endDate)
    };
  };

  const getAccessToken = () => {
    const token = localStorage.getItem('auth') || sessionStorage.getItem('auth');
    const authData = token ? JSON.parse(token) : null;
    return authData?.access_token;
  };

  const fetchDepartmentStats = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) return;

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/hod/stats/?period=${selectedPeriod}`, {
        headers: {
          Authorization: `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartmentStats(data);
      }
    } catch (error) {
      console.error('Error fetching department stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentContext = async () => {
    try {
      const accessToken = getAccessToken();
      if (!accessToken) return;

      const response = await fetch('http://127.0.0.1:8000/api/academics/hod/dashboard/', {
        headers: {
          Authorization: `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;
      const data = await response.json();
      setDepartmentName(data?.department?.name || '');
      setDepartmentSemesters(data?.semesters || []);
      setDepartmentCourses(data?.courses || []);
      setDepartmentInstructors(data?.instructors || []);
    } catch (error) {
      console.error('Error fetching HOD department context:', error);
    }
  };

  const fetchCourseAnalytics = async () => {
    setLoading(true);
    try {
      const accessToken = getAccessToken();
      if (!accessToken) return;

      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      if (selectedSemester) params.append('semester', selectedSemester);

      const response = await fetch(`http://127.0.0.1:8000/api/attendance/hod/courses/?${params}`, {
        headers: {
          Authorization: `Token ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCourseAnalytics(data.courses || []);
      }
    } catch (error) {
      console.error('Error fetching course analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedReports = async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRangeForSelectedPeriod();
      const [studentRes, facultyRes] = await Promise.all([
        attendanceReportsService.getStudentAttendanceDetails({ dateFrom, dateTo }),
        attendanceReportsService.getFacultyAttendanceDetails({ dateFrom, dateTo, facultyType: 'instructor' })
      ]);

      setStudentRecords(studentRes.records || []);
      setInstructorRecords(facultyRes.records || []);
    } catch (error) {
      console.error('Error fetching detailed reports:', error);
      setStudentRecords([]);
      setInstructorRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-400"></div>;
    }
  };

  const semesterCourseCodes = new Set(
    departmentCourses
      .filter((c) => !reportSemesterId || String(c.semester) === reportSemesterId)
      .map((c) => c.code)
  );

  const filteredStudentRecords = studentRecords.filter((record) => {
    if (reportCourseCode && record.course_code !== reportCourseCode) return false;
    if (reportInstructorName && record.instructor_name !== reportInstructorName) return false;
    if (reportSemesterId && !semesterCourseCodes.has(record.course_code)) return false;
    return true;
  });

  const filteredInstructorRecords = instructorRecords.filter((record) => {
    if (reportInstructorName && record.faculty_name !== reportInstructorName) return false;
    return true;
  });

  const filteredStudentPresentRate =
    filteredStudentRecords.length > 0
      ? Math.round((filteredStudentRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length / filteredStudentRecords.length) * 100)
      : 0;

  const filteredInstructorPresentRate =
    filteredInstructorRecords.length > 0
      ? Math.round((filteredInstructorRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length / filteredInstructorRecords.length) * 100)
      : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Department Attendance Analytics</h2>
        <p className="text-purple-100">Department attendance analytics with update-request oversight</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex space-x-1">
          {[
            { id: 'analytics', label: 'Department Analytics', icon: BarChart3 },
            { id: 'courses', label: 'Course Performance', icon: FileText },
            { id: 'reports', label: 'Student & Instructor Reports', icon: Users },
            { id: 'requests', label: 'Update Requests', icon: CheckCircle },
            { id: 'self', label: 'My Attendance', icon: Clock }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'analytics' | 'courses' | 'reports' | 'requests' | 'self')}
              className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab !== 'requests' && activeTab !== 'self' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Period:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 6 months</option>
                </select>
              </div>

              {activeTab === 'courses' && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Semester:</label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Semesters</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'analytics' && departmentStats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Department</p>
                      <p className="text-lg font-bold text-gray-900">{departmentStats.department_name}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Attendance</p>
                      <p className="text-2xl font-bold text-green-600">{departmentStats.average_attendance}%</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Trend</p>
                      <p className={`text-2xl font-bold ${departmentStats.trend_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {departmentStats.trend_percentage >= 0 ? '+' : ''}
                        {departmentStats.trend_percentage}%
                      </p>
                    </div>
                    <TrendingUp className={`w-8 h-8 ${departmentStats.trend_percentage >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Courses</p>
                      <p className="text-2xl font-bold text-purple-600">{departmentStats.courses_count}</p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-600" />
                  </div>
                </motion.div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{departmentStats.today_present}</div>
                    <div className="text-sm text-green-800">Present</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{departmentStats.today_absent}</div>
                    <div className="text-sm text-red-800">Absent</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {departmentStats.total_students > 0 ? Math.round((departmentStats.today_present / departmentStats.total_students) * 100) : 0}%
                    </div>
                    <div className="text-sm text-blue-800">Attendance Rate</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Course Performance Analysis</h3>
                <p className="text-gray-600 text-sm">Detailed attendance analytics for each course</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courseAnalytics.map((course, index) => (
                      <motion.tr key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{course.course_name}</div>
                            <div className="text-sm text-gray-500">{course.course_code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.instructor_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.semester}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              course.attendance_rate >= 85
                                ? 'bg-green-100 text-green-800'
                                : course.attendance_rate >= 75
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {course.attendance_rate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.total_classes}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getTrendIcon(course.trend)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(course.risk_level)}`}>
                            {course.risk_level.charAt(0).toUpperCase() + course.risk_level.slice(1)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {courseAnalytics.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No course analytics data available for the selected period.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">HOD Attendance Reports</h3>
                <p className="text-sm text-gray-600">Student attendance report and instructor attendance report in one place.</p>
                {departmentName && (
                  <p className="mt-2 text-sm text-indigo-700 font-medium">Department: {departmentName}</p>
                )}
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Student attendance update requests are reviewed by HOD/Coordinator in the Update Requests tab.
                  </div>
                </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Semester</label>
                    <select
                      value={reportSemesterId}
                      onChange={(e) => {
                        setReportSemesterId(e.target.value);
                        setReportCourseCode('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">All Semesters</option>
                      {departmentSemesters.map((sem) => (
                        <option key={sem.semester_id} value={sem.semester_id}>
                          {sem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
                    <select
                      value={reportCourseCode}
                      onChange={(e) => setReportCourseCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">All Courses</option>
                      {departmentCourses
                        .filter((c) => !reportSemesterId || String(c.semester) === reportSemesterId)
                        .map((course) => (
                          <option key={course.course_id} value={course.code}>
                            {course.code} - {course.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Instructor</label>
                    <select
                      value={reportInstructorName}
                      onChange={(e) => setReportInstructorName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">All Instructors</option>
                      {departmentInstructors.map((inst) => (
                        <option key={inst.id} value={inst.name}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm text-gray-600">Student Records</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredStudentRecords.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm text-gray-600">Student Present/Late</p>
                  <p className="text-2xl font-bold text-green-600">{filteredStudentPresentRate}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm text-gray-600">Instructor Records</p>
                  <p className="text-2xl font-bold text-purple-600">{filteredInstructorRecords.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm text-gray-600">Instructor Present/Late</p>
                  <p className="text-2xl font-bold text-indigo-600">{filteredInstructorPresentRate}%</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">Student Attendance Report</h4>
                </div>
                {filteredStudentRecords.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">No student attendance records found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudentRecords.slice(0, 100).map((record, idx) => (
                          <tr key={`${record.student_id}-${record.date}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{record.student_name}</div>
                              <div className="text-xs text-gray-500">{record.student_id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{record.course_name}</div>
                              <div className="text-xs text-gray-500">{record.course_code}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{record.instructor_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{record.date}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  record.status === 'Present'
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'Absent'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">Instructor Attendance Report</h4>
                </div>
                {filteredInstructorRecords.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500 text-center">No instructor attendance records found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marked Mode</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredInstructorRecords.slice(0, 100).map((record, idx) => (
                          <tr key={`${record.faculty_name}-${record.date}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{record.faculty_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{record.date}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  record.status === 'Present'
                                    ? 'bg-green-100 text-green-800'
                                    : record.status === 'Absent'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {record.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {record.auto_marked ? 'Auto-marked' : record.self_marked ? 'Self-marked' : 'Manual'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <AttendanceUpdateRequestsPanel
              title="Student Attendance Update Requests"
              subtitle="Approve or reject instructor requests to update submitted class attendance."
            />
          )}

          {activeTab === 'self' && (
            <FacultySelfAttendanceComponent />
          )}

        </>
      )}
    </div>
  );
};

export default HODAttendanceDashboard;
