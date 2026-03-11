import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import professionalAttendanceService, { InstructorClass } from '../../api/attendanceService';

interface ProfessionalAttendanceComponentProps {
  className?: string;
}

const ProfessionalAttendanceComponent: React.FC<ProfessionalAttendanceComponentProps> = ({ className = '' }) => {
  const [todayClasses, setTodayClasses] = useState<InstructorClass[]>([]);
  const [allClasses, setAllClasses] = useState<InstructorClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructorName, setInstructorName] = useState('');
  const [selectedClass, setSelectedClass] = useState<InstructorClass | null>(null);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'all'>('today');

  useEffect(() => {
    fetchInstructorClasses();
  }, []);

  const fetchInstructorClasses = async () => {
    try {
      setLoading(true);
      const data = await professionalAttendanceService.getInstructorClasses();
      setTodayClasses(data.today_classes);
      setAllClasses(data.all_classes);
      setInstructorName(data.instructor_name);
    } catch (error) {
      console.error('Error fetching instructor classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = (classItem: InstructorClass) => {
    setSelectedClass(classItem);
    // Initialize attendance data with all students as Present
    const initialData: Record<string, string> = {};
    classItem.students?.forEach(student => {
      initialData[student.student_id.toString()] = 'Present';
    });
    setAttendanceData(initialData);
  };

  const handleStatusChange = (studentId: number, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId.toString()]: status
    }));
  };

  const markAllPresent = () => {
    if (!selectedClass) return;
    const newData: Record<string, string> = {};
    selectedClass.students?.forEach(student => {
      newData[student.student_id] = 'Present';
    });
    setAttendanceData(newData);
  };

  const markAllAbsent = () => {
    if (!selectedClass) return;
    const newData: Record<string, string> = {};
    selectedClass.students?.forEach(student => {
      newData[student.student_id.toString()] = 'Absent';
    });
    setAttendanceData(newData);
  };

  const submitAttendance = async () => {
    if (!selectedClass) return;

    try {
      setSubmitting(true);
      const attendanceArray = Object.entries(attendanceData).map(([student_id, status]) => ({
        student_id: parseInt(student_id),
        status
      }));

      await professionalAttendanceService.markClassAttendance(
        selectedClass.timetable_id,
        attendanceArray
      );

      // Refresh classes
      await fetchInstructorClasses();
      setSelectedClass(null);
      setAttendanceData({});
      
      alert('Attendance marked successfully! Your attendance has been auto-marked as Present.');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading classes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-2">Professional Attendance System</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Welcome, {instructorName}</p>
            <p className="text-sm text-purple-200">Mark attendance for your assigned classes</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">
              {todayClasses.length} Today's Classes • {allClasses.length} Total Classes
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'today'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today's Classes ({todayClasses.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'all'
                  ? 'border-purple-500 text-purple-600 bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Classes ({allClasses.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'today' && (
            <div className="space-y-4">
              {todayClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Today</h3>
                  <p className="text-gray-600">You don't have any classes scheduled for today.</p>
                </div>
              ) : (
                todayClasses.map((classItem, index) => (
                  <motion.div
                    key={classItem.timetable_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-50 rounded-xl p-6 border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {classItem.course_name} ({classItem.course_code})
                        </h3>
                        <p className="text-gray-600 mt-1">
                          {classItem.semester} • Room: {classItem.room}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Time: {professionalAttendanceService.formatTimeSlot(classItem.start_time, classItem.end_time)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Students: {classItem.student_count}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {classItem.attendance_marked ? (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600 font-medium">Marked</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleMarkAttendance(classItem)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                          >
                            Mark Attendance
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="space-y-4">
              {allClasses.map((classItem, index) => (
                <motion.div
                  key={classItem.timetable_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-50 rounded-xl p-6 border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {classItem.course_name} ({classItem.course_code})
                      </h3>
                      <p className="text-gray-600 mt-1">
                        {classItem.semester} • Room: {classItem.room}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {classItem.day} • {professionalAttendanceService.formatTimeSlot(classItem.start_time, classItem.end_time)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Students: {classItem.student_count}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Marking Modal */}
      {selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">
                    Mark Attendance - {selectedClass.course_name}
                  </h3>
                  <p className="text-purple-100 mt-1">
                    {selectedClass.semester} • Room: {selectedClass.room}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClass(null)}
                  className="text-white hover:text-purple-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={markAllPresent}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  Mark All Present
                </button>
                <button
                  onClick={markAllAbsent}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                >
                  Mark All Absent
                </button>
              </div>

              {/* Students List */}
              <div className="space-y-3">
                {selectedClass.students?.map((student, index) => (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{student.name}</h4>
                      <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        {(['Present', 'Absent', 'Late'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(student.student_id, status)}
                            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                              attendanceData[student.student_id] === status
                                ? getStatusColor(status)
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>

                      <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(attendanceData[student.student_id] || 'Present')}`}>
                        {attendanceData[student.student_id] || 'Present'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Total Students: {selectedClass.students?.length || 0}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedClass(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAttendance}
                  disabled={submitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {submitting ? 'Submitting...' : 'Submit & Lock Attendance'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalAttendanceComponent;