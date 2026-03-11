import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Student {
  id: string;
  name: string;
  status: 'P' | 'A' | 'L' | null;
}

const MarkAttendance: React.FC = () => {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [students, setStudents] = useState<Student[]>([
    { id: 'CW-112', name: 'Sadia Naz', status: null },
    { id: 'CW-113', name: 'Ahmed Ali', status: null },
    { id: 'CW-114', name: 'Fatima Khan', status: null },
    { id: 'CW-115', name: 'Hassan Ahmed', status: null },
    { id: 'CW-116', name: 'Ayesha Malik', status: null },
  ]);

  const departments = [
    { value: 'IT', label: 'Information Technology (CW309)' },
    { value: 'CS', label: 'Computer Science (CW310)' },
    { value: 'SE', label: 'Software Engineering (CW311)' }
  ];

  const semesters = [
    { value: '1', label: 'Semester 1' },
    { value: '2', label: 'Semester 2' },
    { value: '3', label: 'Semester 3' }
  ];

  const updateStudentStatus = (studentId: string, status: 'P' | 'A' | 'L') => {
    setStudents(prev => prev.map(student => 
      student.id === studentId ? { ...student, status } : student
    ));
  };

  const markAllPresent = () => {
    setStudents(prev => prev.map(student => ({ ...student, status: 'P' as const })));
  };

  const markAllAbsent = () => {
    setStudents(prev => prev.map(student => ({ ...student, status: 'A' as const })));
  };

  const saveAttendance = () => {
    console.log('Saving attendance:', students);
    alert('Attendance saved successfully!');
  };

  const getStatusButtonClass = (currentStatus: 'P' | 'A' | 'L' | null, buttonStatus: 'P' | 'A' | 'L') => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ';
    if (currentStatus === buttonStatus) {
      switch (buttonStatus) {
        case 'P': return baseClass + 'bg-green-500 text-white shadow-md';
        case 'A': return baseClass + 'bg-red-500 text-white shadow-md';
        case 'L': return baseClass + 'bg-yellow-500 text-white shadow-md';
      }
    }
    return baseClass + 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mark Attendance</h1>
          <p className="text-gray-600">Daily attendance marking with bulk actions</p>
        </div>

        {/* Department & Semester Selection */}
        <motion.div 
          className="bg-white rounded-2xl shadow-lg mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-purple-600 text-white p-4 rounded-t-2xl">
            <h2 className="text-xl font-semibold">Department & Semester Selection</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select Semester</option>
                  {semesters.map(sem => (
                    <option key={sem.value} value={sem.value}>{sem.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Attendance Table */}
        {selectedDepartment && selectedSemester && (
          <motion.div 
            className="bg-white rounded-2xl shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-purple-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-xl font-semibold">Student Attendance</h2>
              <div className="flex gap-3">
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
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 font-semibold text-gray-900">Student Details</th>
                      <th className="text-center py-4 px-4 font-semibold text-gray-900">Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-500">{student.id}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={() => updateStudentStatus(student.id, 'P')}
                              className={getStatusButtonClass(student.status, 'P')}
                            >
                              Present (P)
                            </button>
                            <button
                              onClick={() => updateStudentStatus(student.id, 'A')}
                              className={getStatusButtonClass(student.status, 'A')}
                            >
                              Absent (A)
                            </button>
                            <button
                              onClick={() => updateStudentStatus(student.id, 'L')}
                              className={getStatusButtonClass(student.status, 'L')}
                            >
                              Leave (L)
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                <motion.button
                  onClick={saveAttendance}
                  className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Save Attendance
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {(!selectedDepartment || !selectedSemester) && (
          <motion.div 
            className="bg-white rounded-2xl shadow-lg p-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select Department & Semester</h3>
            <p className="text-gray-600">Choose a department and semester to start marking attendance</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MarkAttendance;