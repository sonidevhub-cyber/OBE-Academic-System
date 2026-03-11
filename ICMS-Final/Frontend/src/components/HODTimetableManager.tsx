import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Send, Users, Mail, Calendar } from 'lucide-react';
import ProfessionalTimetable from './timetable/ProfessionalTimetable';
import timetableNotificationService from '../api/timetableNotificationService';

interface Semester {
  id: string;
  name: string;
  status: 'draft' | 'approved';
  student_count: number;
}

const HODTimetableManager: React.FC = () => {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [darkMode] = useState(false);

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    // Mock data - replace with actual API call
    setSemesters([
      { id: '1', name: 'Fall 2024 - Semester 1', status: 'draft', student_count: 45 },
      { id: '2', name: 'Fall 2024 - Semester 3', status: 'approved', student_count: 38 },
      { id: '3', name: 'Fall 2024 - Semester 5', status: 'draft', student_count: 42 }
    ]);
  };

  const approveTimetable = async (semesterId: string) => {
    setLoading(true);
    try {
      // Update semester status
      setSemesters(prev => 
        prev.map(sem => 
          sem.id === semesterId 
            ? { ...sem, status: 'approved' as const }
            : sem
        )
      );

      // Get timetable data for notification
      const timetableData = { semester_id: semesterId };
      
      // Send notifications to all students
      await timetableNotificationService.notifyStudentsOnApproval(semesterId, timetableData);
      
      alert('Timetable approved and notifications sent to all students!');
    } catch (error) {
      console.error('Error approving timetable:', error);
      alert('Error approving timetable');
    } finally {
      setLoading(false);
    }
  };

  const assignClassToInstructor = async (instructorId: string, classDetails: any) => {
    try {
      // Send notification to instructor
      await timetableNotificationService.notifyInstructorAssignment(instructorId, classDetails);
      alert('Class assigned and instructor notified!');
    } catch (error) {
      console.error('Error assigning class:', error);
      alert('Error assigning class');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <h1 className="text-2xl font-bold mb-4">HOD Timetable Management</h1>
        
        {/* Semester Selection */}
        <div className="flex items-center gap-4">
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Semester</option>
            {semesters.map(sem => (
              <option key={sem.id} value={sem.id}>
                {sem.name} ({sem.status})
              </option>
            ))}
          </select>

          {selectedSemester && (
            <div className="flex gap-2">
              {semesters.find(s => s.id === selectedSemester)?.status === 'draft' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => approveTimetable(selectedSemester)}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={16} />
                  Approve & Notify Students
                </motion.button>
              )}
              
              <button
                onClick={() => {
                  const semester = semesters.find(s => s.id === selectedSemester);
                  if (semester) {
                    alert(`${semester.student_count} students will be notified`);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Users size={16} />
                View Students ({semesters.find(s => s.id === selectedSemester)?.student_count})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {semesters.map(semester => (
          <motion.div
            key={semester.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-xl shadow-lg border ${
              semester.status === 'approved' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{semester.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                semester.status === 'approved' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {semester.status}
              </span>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>{semester.student_count} Students</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>Semester {semester.id}</span>
              </div>
            </div>

            {semester.status === 'draft' && (
              <button
                onClick={() => approveTimetable(semester.id)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Send size={14} />
                Approve & Send to Students
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Professional Timetable */}
      {selectedSemester && (
        <ProfessionalTimetable 
          semesterId={selectedSemester}
          viewType="hod"
          darkMode={darkMode}
        />
      )}

      {/* Quick Actions */}
      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              // Mock instructor assignment
              assignClassToInstructor('INS001', {
                course_name: 'Computer Science',
                course_code: 'CS101',
                day: 'Monday',
                start_time: '09:00',
                room: 'Room A-101'
              });
            }}
            className="flex items-center gap-2 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Mail size={20} className="text-blue-600" />
            <div className="text-left">
              <div className="font-medium">Assign Class to Instructor</div>
              <div className="text-sm text-gray-600">Automatically notify instructor</div>
            </div>
          </button>

          <button
            onClick={() => {
              if (selectedSemester) {
                const semester = semesters.find(s => s.id === selectedSemester);
                alert(`Send bulk notification to ${semester?.student_count} students`);
              }
            }}
            className="flex items-center gap-2 p-4 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50 transition-colors"
          >
            <Users size={20} className="text-green-600" />
            <div className="text-left">
              <div className="font-medium">Notify All Students</div>
              <div className="text-sm text-gray-600">Send timetable updates</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HODTimetableManager;