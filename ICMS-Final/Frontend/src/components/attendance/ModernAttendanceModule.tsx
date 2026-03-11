import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClockIcon, 
  UserGroupIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  CalendarIcon,
  AcademicCapIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface Student {
  id: string;
  name: string;
  email: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  profileImage?: string;
  attendancePercentage: number;
}

interface ClassSession {
  id: string;
  courseName: string;
  courseCode: string;
  semester: string;
  room: string;
  timeSlot: string;
  duration: string;
  students: Student[];
  isActive: boolean;
  canMarkAttendance: boolean;
  isSubmitted: boolean;
}

const ModernAttendanceModule: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Mock data - replace with actual API calls
  useEffect(() => {
    loadActiveSession();
  }, []);

  const loadActiveSession = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockSession: ClassSession = {
        id: '1',
        courseName: 'Advanced Database Systems',
        courseCode: 'CS-401',
        semester: 'Fall 2024 - 8th Semester',
        room: 'Lab-A-201',
        timeSlot: '09:00 AM - 10:30 AM',
        duration: '90 minutes',
        isActive: true,
        canMarkAttendance: true,
        isSubmitted: false,
        students: [
          { id: 'CS-2020-001', name: 'Ahmed Ali Khan', email: 'ahmed@example.com', status: 'Present', attendancePercentage: 92 },
          { id: 'CS-2020-002', name: 'Fatima Sheikh', email: 'fatima@example.com', status: 'Present', attendancePercentage: 88 },
          { id: 'CS-2020-003', name: 'Muhammad Hassan', email: 'hassan@example.com', status: 'Absent', attendancePercentage: 76 },
          { id: 'CS-2020-004', name: 'Ayesha Malik', email: 'ayesha@example.com', status: 'Late', attendancePercentage: 84 },
          { id: 'CS-2020-005', name: 'Omar Farooq', email: 'omar@example.com', status: 'Present', attendancePercentage: 95 },
        ]
      };
      setActiveSession(mockSession);
      setStudents(mockSession.students);
      setLoading(false);
    }, 1000);
  };

  const updateStudentStatus = (studentId: string, status: Student['status']) => {
    setStudents(prev => prev.map(student => 
      student.id === studentId ? { ...student, status } : student
    ));
  };

  const getStatusColor = (status: Student['status']) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800 border-green-200';
      case 'Absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'Late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Excused': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: Student['status']) => {
    switch (status) {
      case 'Present': return <CheckCircleIcon className="w-4 h-4" />;
      case 'Absent': return <XCircleIcon className="w-4 h-4" />;
      case 'Late': return <ExclamationTriangleIcon className="w-4 h-4" />;
      case 'Excused': return <CheckCircleIcon className="w-4 h-4" />;
      default: return null;
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || student.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const attendanceStats = {
    total: students.length,
    present: students.filter(s => s.status === 'Present').length,
    absent: students.filter(s => s.status === 'Absent').length,
    late: students.filter(s => s.status === 'Late').length,
    excused: students.filter(s => s.status === 'Excused').length,
  };

  const bulkMarkStatus = (status: Student['status']) => {
    setStudents(prev => prev.map(student => ({ ...student, status })));
    setShowBulkActions(false);
  };

  const submitAttendance = async () => {
    if (!window.confirm('Submit attendance? This will lock it for editing.')) return;
    
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      if (activeSession) {
        setActiveSession({ ...activeSession, isSubmitted: true, canMarkAttendance: false });
      }
      alert('Attendance submitted successfully!');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading attendance session...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-12 max-w-md">
          <ClockIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Session</h3>
          <p className="text-gray-600">You don't have any active classes right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2">{activeSession.courseName}</h1>
                <div className="flex items-center space-x-6 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <AcademicCapIcon className="w-5 h-5" />
                    <span>{activeSession.courseCode}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CalendarIcon className="w-5 h-5" />
                    <span>{activeSession.semester}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5" />
                    <span>{activeSession.timeSlot}</span>
                  </div>
                </div>
                <p className="text-blue-200 mt-2">Room: {activeSession.room} • Duration: {activeSession.duration}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
                <div className="text-blue-200">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{attendanceStats.total}</div>
                <div className="text-sm text-gray-600">Total Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{attendanceStats.present}</div>
                <div className="text-sm text-gray-600">Present</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
                <div className="text-sm text-gray-600">Absent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{attendanceStats.late}</div>
                <div className="text-sm text-gray-600">Late</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{attendanceStats.excused}</div>
                <div className="text-sm text-gray-600">Excused</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Controls Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <UserGroupIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Students</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
                <option value="Excused">Excused</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Bulk Actions
                </button>
                <AnimatePresence>
                  {showBulkActions && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10"
                    >
                      <div className="py-1">
                        <button
                          onClick={() => bulkMarkStatus('Present')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50"
                        >
                          Mark All Present
                        </button>
                        <button
                          onClick={() => bulkMarkStatus('Absent')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50"
                        >
                          Mark All Absent
                        </button>
                        <button
                          onClick={() => bulkMarkStatus('Late')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-yellow-50"
                        >
                          Mark All Late
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={submitAttendance}
                disabled={submitting || activeSession.isSubmitted}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  activeSession.isSubmitted
                    ? 'bg-green-100 text-green-800 cursor-not-allowed'
                    : submitting
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {submitting ? 'Submitting...' : activeSession.isSubmitted ? 'Submitted' : 'Submit & Lock'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Students Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredStudents.map((student, index) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {student.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.name}</h3>
                      <p className="text-sm text-gray-600">{student.id}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(student.status)} flex items-center space-x-1`}>
                    {getStatusIcon(student.status)}
                    <span>{student.status}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Attendance</span>
                    <span className="text-sm font-medium text-gray-900">{student.attendancePercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        student.attendancePercentage >= 75 ? 'bg-green-500' : 
                        student.attendancePercentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${student.attendancePercentage}%` }}
                    ></div>
                  </div>
                </div>

                {activeSession.canMarkAttendance && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['Present', 'Absent', 'Late', 'Excused'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStudentStatus(student.id, status)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                          student.status === status
                            ? getStatusColor(status)
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {filteredStudents.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ModernAttendanceModule;