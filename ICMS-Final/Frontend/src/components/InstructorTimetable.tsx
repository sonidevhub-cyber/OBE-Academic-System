import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, BookOpen, Clock, MapPin, User, CheckCircle } from 'lucide-react';
import ProfessionalTimetable from './timetable/ProfessionalTimetable';
import { api } from '../api/api';
import { instructorCourseService } from '../api/instructorCourseService';

interface ClassAssignment {
  id: number;
  course_code: string;
  course_name: string;
  room: string;
  start_time: string;
  end_time: string;
  day: string;
  semester: string;
  department: string;
  credits: number;
  type: 'lecture' | 'lab' | 'tutorial';
  status: 'approved' | 'pending';
  approved_by: string;
  approved_date: string;
}

interface InstructorTimetableProps {
  instructorId?: string;
  darkMode?: boolean;
}

const InstructorTimetable: React.FC<InstructorTimetableProps> = ({ instructorId, darkMode = false }) => {
  const [activeTab, setActiveTab] = useState<'timetable' | 'classes'>('timetable');
  const [myClasses, setMyClasses] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'classes') {
      fetchMyClasses();
    }
  }, [activeTab, instructorId]);

  const fetchMyClasses = async () => {
    setLoading(true);
    try {
      const response = await instructorCourseService.getMyCourses();
      
      if (response.data) {
        const transformedClasses: ClassAssignment[] = response.data.map((course: any) => ({
          id: course.allocation_id,
          course_code: course.course_code,
          course_name: course.course_name,
          room: 'TBD',
          start_time: '09:00',
          end_time: '10:00',
          day: 'Monday',
          semester: course.semester_name,
          department: course.department,
          credits: course.credits,
          type: 'lecture' as const,
          status: course.status === 'approved' ? 'approved' : 'pending',
          approved_by: course.coordinator_name,
          approved_date: course.approved_at ? new Date(course.approved_at).toLocaleDateString() : 'N/A'
        }));
        setMyClasses(transformedClasses);
      } else {
        setMyClasses([]);
      }
    } catch (error) {
      console.log('API error, using mock data:', error);
      setMyClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lab': return darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
      case 'tutorial': return darkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800';
      default: return darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className={`space-y-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Tab Navigation */}
      <div className={`flex space-x-1 p-1 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'timetable'
              ? darkMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 shadow-md'
              : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar size={20} />
          Timetable View
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'classes'
              ? darkMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 shadow-md'
              : darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen size={20} />
          My Classes
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'timetable' ? (
        <ProfessionalTimetable 
          instructorId={instructorId}
          viewType="instructor"
          darkMode={darkMode}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-indigo-100 border-blue-200'} border shadow-lg`}>
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
              <BookOpen className="text-blue-500" size={28} />
              My Assigned Classes
            </h2>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Classes approved by HOD and assigned to you
            </p>
          </div>

          {/* Classes List */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"
              />
            </div>
          ) : (
            <div className="grid gap-4">
              {myClasses.map((classItem, index) => (
                <motion.div
                  key={classItem.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border shadow-lg hover:shadow-xl transition-all`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{classItem.course_code}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(classItem.type)}`}>
                          {classItem.type.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">Approved</span>
                        </div>
                      </div>
                      <p className={`text-lg font-medium mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {classItem.course_name}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-blue-500" size={16} />
                      <span className="text-sm font-medium">{classItem.day}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="text-green-500" size={16} />
                      <span className="text-sm">{classItem.start_time} - {classItem.end_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="text-red-500" size={16} />
                      <span className="text-sm font-medium">{classItem.room}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="text-purple-500" size={16} />
                      <span className="text-sm">{classItem.credits} Credits</span>
                    </div>
                  </div>

                  <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="font-medium">Department:</span> {classItem.department}
                      </div>
                      <div className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span className="font-medium">Approved by:</span> {classItem.approved_by} on {classItem.approved_date}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {myClasses.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-center py-16 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg`}
                >
                  <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className={`text-xl font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                    No Classes Assigned
                  </h3>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    You don't have any approved class assignments yet.
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default InstructorTimetable;