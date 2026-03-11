import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AttendanceRecord {
  [day: string]: string;
}

interface StudentAttendance {
  studentId: string;
  studentName: string;
  attendance: AttendanceRecord;
  percentage: number;
}

interface AttendanceReportCardProps {
  filters: { departmentId: string; semesterId: string };
}

const AttendanceReportCard: React.FC<AttendanceReportCardProps> = ({ filters }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [reportGenerated, setReportGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const [attendanceData, setAttendanceData] = useState<StudentAttendance[]>([]);
  const [departmentName, setDepartmentName] = useState('');
  const [semesterName, setSemesterName] = useState('');

  const years = ['2023', '2024', '2025', '2026'];
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const generateReport = async () => {
    if (!filters.departmentId || !filters.semesterId) {
      alert('Please select department and semester first');
      return;
    }

    setLoading(true);
    try {
      const storedAuth = localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;

      // Fetch students
      const studentsResponse = await fetch(`http://localhost:8000/api/students/?department_id=${filters.departmentId}&semester_id=${filters.semesterId}`);
      const students = studentsResponse.ok ? await studentsResponse.json() : [];

      // Fetch department and semester info
      const [deptResponse, semResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/academics/departments/${filters.departmentId}/`),
        fetch(`http://localhost:8000/api/academics/semesters/${filters.semesterId}/`)
      ]);

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartmentName(deptData.name);
      }
      if (semResponse.ok) {
        const semData = await semResponse.json();
        setSemesterName(semData.name);
      }

      // Fetch attendance data for the selected month/year
      const attendanceResponse = await fetch(
        `http://localhost:8000/api/instructors/attendance/reports/?department_id=${filters.departmentId}&semester_id=${filters.semesterId}&year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: { Authorization: `Token ${token}` }
        }
      );

      let attendanceRecords: any[] = [];
      if (attendanceResponse.ok) {
        attendanceRecords = await attendanceResponse.json();
      }

      // Format data for display
      const formattedData = students.map((student: any) => {
        const studentAttendance: AttendanceRecord = {};
        const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
        
        // Initialize all days
        for (let day = 1; day <= daysInMonth; day++) {
          studentAttendance[day.toString()] = '–';
        }

        // Fill in actual attendance data
        const studentRecords = attendanceRecords.filter((record: any) => record.student_id === student.student_id);
        studentRecords.forEach((record: any) => {
          const date = new Date(record.date);
          if (date.getMonth() + 1 === parseInt(selectedMonth) && date.getFullYear() === parseInt(selectedYear)) {
            studentAttendance[date.getDate().toString()] = record.status === 'Present' ? 'P' : record.status === 'Absent' ? 'A' : 'L';
          }
        });

        // Calculate percentage
        const totalDays = Object.values(studentAttendance).filter(status => status !== '–').length;
        const presentDays = Object.values(studentAttendance).filter(status => status === 'P').length;
        const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        return {
          studentId: student.student_id,
          studentName: student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim(),
          attendance: studentAttendance,
          percentage
        };
      });

      setAttendanceData(formattedData);
      setReportGenerated(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (attendanceData.length === 0) {
      alert('No data to export');
      return;
    }

    const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
    const selectedMonthName = months.find(m => m.value === selectedMonth)?.label || 'Month';
    const currentDate = new Date().toLocaleDateString();

    // Create CSV content with header information
    let csvContent = '';
    
    // University Header
    csvContent += 'FGPG - Fatima Gul Post Graduate College\n';
    csvContent += 'Monthly Attendance Report\n';
    csvContent += `Department: ${departmentName || 'N/A'}\n`;
    csvContent += `Semester: ${semesterName || 'N/A'}\n`;
    csvContent += `Month: ${selectedMonthName} ${selectedYear}\n`;
    csvContent += `Generated on: ${currentDate}\n`;
    csvContent += `Total Students: ${attendanceData.length}\n`;
    csvContent += '\n'; // Empty line
    
    // Column headers
    csvContent += 'Student ID,Student Name';
    
    // Add day headers
    for (let day = 1; day <= daysInMonth; day++) {
      csvContent += `,Day ${day}`;
    }
    csvContent += ',Attendance %,Status\n';

    // Add student data
    attendanceData.forEach(student => {
      let row = `${student.studentId},"${student.studentName}"`;
      
      // Add daily attendance
      for (let day = 1; day <= daysInMonth; day++) {
        const status = student.attendance[day.toString()] || '–';
        row += `,${status}`;
      }
      
      // Add percentage and status
      const status = student.percentage >= 75 ? 'Good' : student.percentage >= 60 ? 'Average' : 'Poor';
      row += `,${student.percentage}%,${status}\n`;
      csvContent += row;
    });

    // Add summary footer
    csvContent += '\n';
    csvContent += 'Summary:\n';
    const avgAttendance = attendanceData.reduce((sum, student) => sum + student.percentage, 0) / attendanceData.length;
    csvContent += `Average Attendance: ${avgAttendance.toFixed(1)}%\n`;
    csvContent += `Students with Good Attendance (>=75%): ${attendanceData.filter(s => s.percentage >= 75).length}\n`;
    csvContent += `Students with Poor Attendance (<60%): ${attendanceData.filter(s => s.percentage < 60).length}\n`;
    csvContent += '\n';
    csvContent += 'Legend: P=Present, A=Absent, L=Late, –=Holiday/Weekend\n';

    // Create and download file with timestamp to avoid caching
    const timestamp = new Date().getTime();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `FGPG_Attendance_${departmentName}_${semesterName}_${selectedMonthName}_${selectedYear}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportToExcel = () => {
    if (attendanceData.length === 0) {
      alert('No data to export');
      return;
    }

    const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
    const selectedMonthName = months.find(m => m.value === selectedMonth)?.label || 'Month';
    const currentDate = new Date().toLocaleDateString();

    // Create Excel-compatible HTML content
    let htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: center; }
            .header { background-color: #4CAF50; color: white; font-weight: bold; }
            .student-info { text-align: left; }
            .present { background-color: #d4edda; }
            .absent { background-color: #f8d7da; }
            .good { background-color: #28a745; color: white; }
            .average { background-color: #ffc107; color: white; }
            .poor { background-color: #dc3545; color: white; }
          </style>
        </head>
        <body>
          <h1>FGPG - Fatima Gul Post Graduate College</h1>
          <h2>Monthly Attendance Report</h2>
          <p><strong>Department:</strong> ${departmentName || 'N/A'}</p>
          <p><strong>Semester:</strong> ${semesterName || 'N/A'}</p>
          <p><strong>Month:</strong> ${selectedMonthName} ${selectedYear}</p>
          <p><strong>Generated on:</strong> ${currentDate}</p>
          <p><strong>Total Students:</strong> ${attendanceData.length}</p>
          <br>
          <table>
            <thead>
              <tr class="header">
                <th>Student ID</th>
                <th>Student Name</th>`;
    
    // Add day headers
    for (let day = 1; day <= daysInMonth; day++) {
      htmlContent += `<th>Day ${day}</th>`;
    }
    htmlContent += `<th>Attendance %</th><th>Status</th></tr></thead><tbody>`;

    // Add student data
    attendanceData.forEach(student => {
      htmlContent += `<tr><td>${student.studentId}</td><td class="student-info">${student.studentName}</td>`;
      
      // Add daily attendance
      for (let day = 1; day <= daysInMonth; day++) {
        const status = student.attendance[day.toString()] || '–';
        const cellClass = status === 'P' ? 'present' : status === 'A' ? 'absent' : '';
        htmlContent += `<td class="${cellClass}">${status}</td>`;
      }
      
      // Add percentage and status
      const statusText = student.percentage >= 75 ? 'Good' : student.percentage >= 60 ? 'Average' : 'Poor';
      const statusClass = student.percentage >= 75 ? 'good' : student.percentage >= 60 ? 'average' : 'poor';
      htmlContent += `<td>${student.percentage}%</td><td class="${statusClass}">${statusText}</td></tr>`;
    });

    // Add summary footer
    const avgAttendance = attendanceData.reduce((sum, student) => sum + student.percentage, 0) / attendanceData.length;
    htmlContent += `</tbody></table><br><h3>Summary:</h3>`;
    htmlContent += `<p>Average Attendance: ${avgAttendance.toFixed(1)}%</p>`;
    htmlContent += `<p>Students with Good Attendance (>=75%): ${attendanceData.filter(s => s.percentage >= 75).length}</p>`;
    htmlContent += `<p>Students with Poor Attendance (<60%): ${attendanceData.filter(s => s.percentage < 60).length}</p>`;
    htmlContent += `<br><p><strong>Legend:</strong> P=Present, A=Absent, L=Late, –=Holiday/Weekend</p>`;
    htmlContent += `</body></html>`;

    // Create and download Excel file
    const timestamp = new Date().getTime();
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `FGPG_Attendance_${departmentName}_${semesterName}_${selectedMonthName}_${selectedYear}_${timestamp}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const getAttendanceStyle = (status: string) => {
    switch (status) {
      case 'P':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'A':
        return 'bg-red-100 text-red-700 border-red-200';
      case '–':
        return 'bg-gray-100 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getPercentageStyle = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500 text-white';
    if (percentage >= 75) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  const selectedMonthName = months.find(m => m.value === selectedMonth)?.label || 'October';
  const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-purple-600 text-white p-6 rounded-t-2xl">
          <h1 className="text-2xl font-bold">Monthly Attendance Reports</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 border-x border-gray-200">
          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            <div className="mt-6">
              <button
                onClick={generateReport}
                disabled={loading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>

          {/* Department & Semester Info */}
          {reportGenerated && (
            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold text-gray-900">{departmentName} – {semesterName}</h2>
              <p className="text-gray-600">{selectedMonthName} {selectedYear}</p>
            </div>
          )}
        </div>

        {/* Report Table */}
        {reportGenerated && (
          <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-sm">
            <div className="p-6">
              <div className="flex justify-end mb-4 gap-3">
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 2v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900 sticky left-0 bg-white z-10 min-w-[200px]">
                          Student Details
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                          <th key={day} className="text-center py-3 px-2 font-medium text-gray-700 min-w-[40px]">
                            {day}
                          </th>
                        ))}
                        <th className="text-center py-3 px-4 font-medium text-gray-900 sticky right-0 bg-white z-10 min-w-[80px]">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.map((student, index) => (
                        <motion.tr
                          key={student.studentId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-4 px-4 sticky left-0 bg-white z-10">
                            <div>
                              <p className="font-medium text-gray-900">{student.studentName}</p>
                              <p className="text-sm text-gray-500">{student.studentId}</p>
                            </div>
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const status = student.attendance[day.toString()] || '–';
                            return (
                              <td key={day} className="py-4 px-2 text-center">
                                <span className={`inline-block w-6 h-6 rounded text-xs font-medium leading-6 border ${getAttendanceStyle(status)}`}>
                                  {status}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 text-center sticky right-0 bg-white z-10">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPercentageStyle(student.percentage)}`}>
                              {student.percentage}%
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {!reportGenerated && (
          <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-sm p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 2v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Monthly Report</h3>
            <p className="text-gray-600">Select year and month, then click "Generate Report" to view attendance data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReportCard;