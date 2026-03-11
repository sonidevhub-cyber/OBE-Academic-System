import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import attendanceService, { FacultyAttendance } from '../../api/attendanceService';

interface FacultyMember {
  id: number;
  name: string;
  type: 'Instructor' | 'Coordinator' | 'HOD';
  department: string;
  attendance: FacultyAttendance[];
  stats: {
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
}

const FacultyAttendanceComponent: React.FC = () => {
  const [facultyMembers, setFacultyMembers] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [selectedMember, setSelectedMember] = useState<FacultyMember | null>(null);

  useEffect(() => {
    loadFacultyAttendance();
  }, [dateRange]);

  const loadFacultyAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceService.getDepartmentAttendanceReport(
        dateRange.from,
        dateRange.to
      );
      
      // Process faculty attendance data
      const facultyData: FacultyMember[] = [];
      const facultyMap = new Map();

      response.faculty_attendance.forEach((attendance: any) => {
        const key = `${attendance.faculty_name}-${attendance.faculty_type}`;
        if (!facultyMap.has(key)) {
          facultyMap.set(key, {
            id: attendance.id,
            name: attendance.faculty_name,
            type: attendance.faculty_type,
            department: attendance.department_name,
            attendance: [],
            stats: { total: 0, present: 0, absent: 0, late: 0, percentage: 0 }
          });
        }
        
        const member = facultyMap.get(key);
        member.attendance.push(attendance);
        member.stats.total++;
        member.stats[attendance.status.toLowerCase()]++;
      });

      // Calculate percentages
      facultyMap.forEach((member) => {
        member.stats.percentage = member.stats.total > 0 
          ? Math.round((member.stats.present / member.stats.total) * 100)
          : 0;
      });

      setFacultyMembers(Array.from(facultyMap.values()));
    } catch (error) {
      console.error('Error loading faculty attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Absent': return 'bg-red-100 text-red-800';
      case 'Late': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading faculty attendance...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Faculty Attendance</h2>
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
          </div>
        </div>
      </div>

      {/* Faculty List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {facultyMembers.map((member) => (
          <motion.div
            key={`${member.name}-${member.type}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedMember(member)}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-600">{member.type}</p>
                <p className="text-xs text-gray-500">{member.department}</p>
              </div>
              <span className={`text-2xl font-bold ${getPercentageColor(member.stats.percentage)}`}>
                {member.stats.percentage}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 p-2 rounded">
                <div className="text-lg font-semibold text-green-600">{member.stats.present}</div>
                <div className="text-xs text-green-600">Present</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-lg font-semibold text-red-600">{member.stats.absent}</div>
                <div className="text-xs text-red-600">Absent</div>
              </div>
              <div className="bg-yellow-50 p-2 rounded">
                <div className="text-lg font-semibold text-yellow-600">{member.stats.late}</div>
                <div className="text-xs text-yellow-600">Late</div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <span className="text-sm text-gray-600">
                Total Days: {member.stats.total}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detailed View Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedMember.name}</h3>
                <p className="text-gray-600">{selectedMember.type} - {selectedMember.department}</p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{selectedMember.stats.total}</div>
                <div className="text-sm text-blue-600">Total Days</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{selectedMember.stats.present}</div>
                <div className="text-sm text-green-600">Present</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{selectedMember.stats.absent}</div>
                <div className="text-sm text-red-600">Absent</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{selectedMember.stats.late}</div>
                <div className="text-sm text-yellow-600">Late</div>
              </div>
            </div>

            {/* Attendance Records */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 mb-3">Attendance Records</h4>
              <div className="max-h-64 overflow-y-auto">
                {selectedMember.attendance
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((record, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">
                          {new Date(record.date).toLocaleDateString()}
                        </span>
                        {record.auto_marked && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Auto-marked
                          </span>
                        )}
                        {record.self_marked && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                            Self-marked
                          </span>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {facultyMembers.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No faculty attendance data</h3>
          <p className="mt-1 text-sm text-gray-500">No attendance records found for the selected date range.</p>
        </div>
      )}
    </div>
  );
};

export default FacultyAttendanceComponent;