import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faIdCard,
  faBuilding,
  faCalendarAlt,
  faGraduationCap,
  faBook,
  faCheckCircle,
  faClock,
  faStar,
  faDownload,
  faPrint,
  faTimes,
  faFileAlt,
  faChartLine,
  faTrophy,
  faCertificate,
  faSignature
} from '@fortawesome/free-solid-svg-icons';

interface Course {
  course_id: number;
  name: string;
  code: string;
  credits: number;
}

interface Result {
  id: number;
  subject: string;
  marks: number;
  grade: string;
  remarks: string;
  is_pending: boolean;
}

interface Student {
  id: number;
  name: string;
  email: string;
  student_id: string;
  enrollment_date: string;
  department: { name: string };
  semester: { name: string };
  image?: string;
}

interface ReportCardProps {
  student: Student;
  assignedCourses: Course[];
  results: Result[];
  onClose: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ student, assignedCourses, results, onClose }) => {
  // Calculate GPA and other stats
  const calculateGPA = () => {
    const completedResults = results.filter(r => !r.is_pending);
    if (completedResults.length === 0) return 0;

    const gradePoints: { [key: string]: number } = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'F': 0.0
    };

    const totalPoints = completedResults.reduce((sum, result) => {
      return sum + (gradePoints[result.grade] || 0);
    }, 0);

    return totalPoints / completedResults.length;
  };

  const gpa = calculateGPA();
  const totalCredits = assignedCourses.reduce((sum, course) => sum + course.credits, 0);
  const completedCourses = results.filter(r => !r.is_pending).length;

  // Get result for a course
  const getCourseResult = (courseName: string) => {
    return results.find(result => result.subject === courseName);
  };

  // Get grade color
  const getGradeColor = (grade: string, isPending: boolean) => {
    if (isPending) return 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-gray-300';
    if (grade.startsWith('A')) return 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300';
    if (grade.startsWith('B')) return 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300';
    if (grade.startsWith('C')) return 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300';
    if (grade.startsWith('D')) return 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-300';
    return 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('report-card-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${student.name}_Report_Card.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto border-4 border-gradient-to-r from-blue-500 to-purple-600">
        {/* Enhanced Header with actions */}
        <div className="flex justify-between items-center p-8 border-b-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-t-xl print:hidden shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white bg-opacity-20 rounded-full">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold">Student Report Card</h2>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleDownloadPDF}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-700 flex items-center space-x-2 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-semibold">Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 flex items-center space-x-2 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="font-semibold">Print</span>
            </button>
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Enhanced Report Card Content */}
        <div className="p-10 print:p-8" id="report-card-content" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
          {/* Enhanced Header */}
          <div className="text-center mb-10 border-b-4 border-gradient-to-r from-blue-500 to-purple-600 pb-6 bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mr-4 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">University Management Institute</h1>
                <h2 className="text-2xl font-semibold text-gray-700">Academic Report Card</h2>
              </div>
            </div>
            <div className="bg-gradient-to-r from-indigo-100 to-purple-100 p-4 rounded-lg border-2 border-indigo-200">
              <p className="text-xl text-gray-700 font-medium">Semester: <span className="font-bold text-indigo-600">{student.semester?.name || 'N/A'}</span></p>
              <p className="text-lg text-gray-600 mt-1">Generated on: <span className="font-semibold">{new Date().toLocaleDateString()}</span></p>
            </div>
          </div>

          {/* Enhanced Student Information */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-xl border-2 border-gray-200">
                {student.image ? (
                  <img
                    src={student.image}
                    alt={student.name}
                    className="w-40 h-40 object-cover rounded-xl border-4 border-gradient-to-r from-blue-400 to-purple-400 mx-auto shadow-lg"
                  />
                ) : (
                  <div className="w-40 h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center mx-auto shadow-lg border-4 border-gradient-to-r from-blue-300 to-purple-300">
                    <span className="text-4xl text-blue-600 font-bold">{student.name?.charAt(0) || 'S'}</span>
                  </div>
                )}
                <div className="text-center mt-4">
                  <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-full font-semibold shadow-md">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Active Student
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-xl border-2 border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <svg className="w-8 h-8 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Student Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                      <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Student Name</label>
                        <p className="text-lg font-bold text-gray-800">{student.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                      <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Student ID</label>
                        <p className="text-lg font-bold text-gray-800">{student.student_id}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-500">
                      <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Department</label>
                        <p className="text-lg font-bold text-gray-800">{student.department?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg border-l-4 border-indigo-500">
                      <svg className="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Semester</label>
                        <p className="text-lg font-bold text-gray-800">{student.semester?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border-l-4 border-orange-500">
                      <svg className="w-6 h-6 text-orange-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Enrollment Date</label>
                        <p className="text-lg font-bold text-gray-800">{new Date(student.enrollment_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-8 h-8 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600">Overall GPA</label>
                        <p className="text-3xl font-bold text-indigo-600">{gpa.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-4 py-2 rounded-full font-bold text-lg ${
                        gpa >= 3.5 ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-2 border-green-300' :
                        gpa >= 3.0 ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-2 border-blue-300' :
                        gpa >= 2.0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-2 border-yellow-300' :
                        'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-2 border-red-300'
                      }`}>
                        {gpa >= 3.5 ? 'Excellent' : gpa >= 3.0 ? 'Good' : gpa >= 2.0 ? 'Satisfactory' : 'Needs Improvement'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Course Results Table */}
          <div className="mb-10">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-xl mb-6">
              <h3 className="text-2xl font-bold flex items-center">
                <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Course Results
              </h3>
            </div>
            <div className="bg-white rounded-xl shadow-xl overflow-hidden border-2 border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <th className="border border-gray-300 px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Course Code</th>
                      <th className="border border-gray-300 px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Course Name</th>
                      <th className="border border-gray-300 px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Credits</th>
                      <th className="border border-gray-300 px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Marks</th>
                      <th className="border border-gray-300 px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Grade</th>
                      <th className="border border-gray-300 px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedCourses.map((course, index) => {
                      const result = getCourseResult(course.name);
                      const isPending = !result || result.is_pending;
                      const marks = result ? result.marks : 'N/A';
                      const grade = result && !result.is_pending ? result.grade : 'Pending';
                      const status = isPending ? 'Pending' : 'Completed';

                      return (
                        <tr key={course.course_id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gradient-to-r from-gray-50 to-gray-100'} hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-colors duration-200`}>
                          <td className="border border-gray-300 px-6 py-4 text-sm font-bold text-gray-800">{course.code}</td>
                          <td className="border border-gray-300 px-6 py-4 text-sm text-gray-800 font-medium">{course.name}</td>
                          <td className="border border-gray-300 px-6 py-4 text-center text-sm font-semibold text-blue-600">{course.credits}</td>
                          <td className="border border-gray-300 px-6 py-4 text-center text-sm font-bold text-gray-800">{marks}</td>
                          <td className="border border-gray-300 px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full border-2 ${getGradeColor(grade, isPending)} shadow-md`}>
                              {grade}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-sm">
                            <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full ${
                              status === 'Completed' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-2 border-green-300' : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-2 border-yellow-300'
                            } shadow-md`}>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {status === 'Completed' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                              </svg>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl shadow-xl border-2 border-blue-200 transform hover:scale-105 transition-transform duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-blue-600">{assignedCourses.length}</p>
                </div>
              </div>
              <h4 className="text-xl font-bold text-blue-800 mb-2">Total Courses</h4>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl shadow-xl border-2 border-green-200 transform hover:scale-105 transition-transform duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-green-600">{completedCourses}</p>
                </div>
              </div>
              <h4 className="text-xl font-bold text-green-800 mb-2">Completed Courses</h4>
              <div className="w-full bg-green-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full" style={{ width: `${(completedCourses / assignedCourses.length) * 100}%` }}></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-xl shadow-xl border-2 border-purple-200 transform hover:scale-105 transition-transform duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-purple-600">{totalCredits}</p>
                </div>
              </div>
              <h4 className="text-xl font-bold text-purple-800 mb-2">Total Credits</h4>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          {/* Enhanced Performance Remarks */}
          <div className="mb-10">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-xl mb-6">
              <h3 className="text-2xl font-bold flex items-center">
                <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                Performance Remarks
              </h3>
            </div>
            <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-xl border-2 border-gray-200">
              <div className="flex items-start space-x-6">
                <div className={`p-6 rounded-full shadow-lg ${
                  gpa >= 3.5 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                  gpa >= 3.0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                  gpa >= 2.0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                  'bg-gradient-to-r from-red-500 to-red-600'
                }`}>
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {gpa >= 3.5 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : gpa >= 3.0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    ) : gpa >= 2.0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-gray-800 mb-4">Academic Performance Summary</h4>
                  <div className={`p-6 rounded-lg border-2 shadow-md ${
                    gpa >= 3.5 ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-800' :
                    gpa >= 3.0 ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 text-blue-800' :
                    gpa >= 2.0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 text-yellow-800' :
                    'bg-gradient-to-r from-red-50 to-red-100 border-red-300 text-red-800'
                  }`}>
                    <p className="text-lg font-medium leading-relaxed">
                      {gpa >= 3.5 ? (
                        <>
                          <strong>Outstanding Performance!</strong> Congratulations on achieving excellent results. Your dedication and hard work have paid off remarkably well. Keep maintaining this exceptional standard and continue to excel in your academic journey.
                        </>
                      ) : gpa >= 3.0 ? (
                        <>
                          <strong>Good Performance!</strong> You have demonstrated solid academic abilities with commendable results. Continue building on your strengths and strive for even greater achievements in your studies.
                        </>
                      ) : gpa >= 2.0 ? (
                        <>
                          <strong>Satisfactory Performance.</strong> Your current results show room for improvement. Focus on enhancing your study habits, seek additional academic support when needed, and work towards achieving better outcomes in your courses.
                        </>
                      ) : (
                        <>
                          <strong>Performance Needs Improvement.</strong> Your current academic standing requires immediate attention. We strongly recommend seeking academic counseling, utilizing tutoring services, and developing a structured study plan to improve your performance.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-indigo-800">GPA Progress</p>
                          <p className="text-lg font-bold text-indigo-600">{gpa.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-purple-800">Completion Rate</p>
                          <p className="text-lg font-bold text-purple-600">{Math.round((completedCourses / assignedCourses.length) * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="md:col-span-1"></div>
            <div className="md:col-span-1 text-center">
              <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-xl border-2 border-gray-200">
                <h4 className="text-xl font-bold text-gray-800 mb-6 flex items-center justify-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Academic Advisor
                </h4>
                <div className="border-t-2 border-gradient-to-r from-blue-400 to-purple-400 pt-4">
                  <p className="text-sm text-gray-600 mb-2">Signature & Date</p>
                  <div className="h-16 border-b border-gray-300 mb-2"></div>
                  <p className="text-xs text-gray-500">Authorized Academic Personnel</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-1 text-center">
              <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-xl border-2 border-gray-200">
                <h4 className="text-xl font-bold text-gray-800 mb-6 flex items-center justify-center">
                  <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Department Head
                </h4>
                <div className="border-t-2 border-gradient-to-r from-green-400 to-blue-400 pt-4">
                  <p className="text-sm text-gray-600 mb-2">Signature & Date</p>
                  <div className="h-16 border-b border-gray-300 mb-2"></div>
                  <p className="text-xs text-gray-500">Department Authorization</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Footer */}
          <div className="text-center mt-12 bg-gradient-to-r from-gray-100 to-gray-200 p-8 rounded-xl shadow-lg border-2 border-gray-300">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h4 className="text-xl font-bold text-gray-800">Official Academic Record</h4>
            </div>
            <p className="text-gray-700 font-medium mb-2">University Management Institute</p>
            <p className="text-gray-600 mb-4">This is an official academic transcript and record of student performance.</p>
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-600">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Document ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Print Styles */}
      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          #report-card-content {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .shadow-lg, .shadow-xl {
            box-shadow: none !important;
          }
          .transform, .hover\\:scale-105 {
            transform: none !important;
          }
        }

        @page {
          size: A4;
          margin: 1cm;
        }
      `}</style>
    </div>
  );
};

export default ReportCard;
