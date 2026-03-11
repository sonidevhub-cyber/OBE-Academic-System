import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Calendar, 
  BookOpen, 
  MapPin, 
  User, 
  Building, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Download,
  RefreshCw,
  Info
} from 'lucide-react';
import { api } from '../../api/api';

interface TimetableEntry {
  id: number;
  course_code: string;
  course_name: string;
  instructor_name: string;
  room: string;
  start_time: string;
  end_time: string;
  day: string;
  semester?: string;
  department?: string;
  credits?: number;
  type?: 'lecture' | 'lab' | 'tutorial';
}

interface ProfessionalTimetableProps {
  studentId?: string;
  instructorId?: string;
  semesterId?: string;
  darkMode?: boolean;
  viewType?: 'student' | 'instructor' | 'hod';
}

const ProfessionalTimetable: React.FC<ProfessionalTimetableProps> = ({
  studentId,
  instructorId,
  semesterId,
  darkMode = false,
  viewType = 'student'
}) => {
  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const days = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' }
  ];

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', 
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const getClassTypeColor = (type?: string) => {
    switch (type) {
      case 'lab': return darkMode ? 'bg-green-900 border-green-500' : 'bg-green-100 border-green-400';
      case 'tutorial': return darkMode ? 'bg-purple-900 border-purple-500' : 'bg-purple-100 border-purple-400';
      default: return darkMode ? 'bg-blue-900 border-blue-500' : 'bg-blue-100 border-blue-400';
    }
  };

  const getClassTypeIcon = (type?: string) => {
    switch (type) {
      case 'lab': return '🧪';
      case 'tutorial': return '📝';
      default: return '📚';
    }
  };

  useEffect(() => {
    fetchTimetable();
    // Listen for real-time timetable updates
    const handleTimetableUpdate = (event: CustomEvent) => {
      if (event.detail.type === 'timetable_update') {
        fetchTimetable();
      }
    };
    
    window.addEventListener('timetableUpdate', handleTimetableUpdate as EventListener);
    return () => window.removeEventListener('timetableUpdate', handleTimetableUpdate as EventListener);
  }, [studentId, instructorId, semesterId]);

  const fetchTimetable = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('instructors/timetable/');
      
      if (response.data && response.data.timetables) {
        const transformedData: TimetableEntry[] = response.data.timetables.map((item: any) => ({
          id: item.id,
          course_code: item.course.code,
          course_name: item.course.name,
          instructor_name: response.data.instructor.name,
          room: item.room,
          start_time: item.start_time,
          end_time: item.end_time,
          day: item.day.toLowerCase(),
          semester: item.semester.name,
          department: 'Computer Science',
          credits: 3,
          type: 'lecture' as const
        }));
        setTimetableData(transformedData);
      } else {
        setTimetableData([]);
      }
      
    } catch (err: any) {
      console.log('API error:', err.message);
      setTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  const getClassForTimeSlot = (day: string, timeSlot: string): TimetableEntry | null => {
    return timetableData.find(entry => {
      const entryStartHour = parseInt(entry.start_time.split(':')[0]);
      const slotHour = parseInt(timeSlot.split(':')[0]);
      return entry.day.toLowerCase() === day.toLowerCase() && entryStartHour === slotHour;
    }) || null;
  };

  const getCurrentTimeSlot = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return { currentHour, currentDay };
  };

  const isCurrentTimeSlot = (day: string, timeSlot: string) => {
    const { currentHour, currentDay } = getCurrentTimeSlot();
    const slotHour = parseInt(timeSlot.split(':')[0]);
    return day.toLowerCase() === currentDay && slotHour === currentHour;
  };

  const exportTimetable = async () => {
    try {
      const response = await fetch(`/api/timetable/export?type=${viewType}&id=${instructorId || studentId || semesterId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timetable-${viewType}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"
        />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-2xl ${darkMode ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-200'} border`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-red-500 text-white">
            <Info size={20} />
          </div>
          <h3 className="text-lg font-semibold text-red-800">Error Loading Timetable</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchTimetable}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`space-y-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}
    >
      {/* Header Section */}
      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-indigo-100 border-blue-200'} border shadow-lg`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
              <Calendar className="text-blue-500" size={32} />
              Professional Timetable
            </h1>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-lg`}>
              Complete schedule with room allocations and timing details
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-4 py-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-blue-500`}
            >
              <option value="all">All Classes</option>
              <option value="lecture">Lectures</option>
              <option value="lab">Labs</option>
              <option value="tutorial">Tutorials</option>
            </select>
            
            <button
              onClick={exportTimetable}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              Export
            </button>
            
            <button
              onClick={fetchTimetable}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Classes', value: timetableData.length, icon: BookOpen, color: 'blue' },
          { label: 'Unique Courses', value: new Set(timetableData.map(e => e.course_code)).size, icon: Calendar, color: 'green' },
          { label: 'Active Days', value: new Set(timetableData.map(e => e.day)).size, icon: Clock, color: 'purple' },
          { label: 'Total Credits', value: timetableData.reduce((sum, e) => sum + (e.credits || 0), 0), icon: Building, color: 'orange' }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {stat.label}
                </p>
                <p className={`text-3xl font-bold text-${stat.color}-600 mt-1`}>
                  {stat.value}
                </p>
              </div>
              <stat.icon className={`text-${stat.color}-500`} size={28} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Timetable Grid */}
      <div className={`rounded-2xl shadow-xl overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`p-4 text-left font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'} border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'} min-w-[100px]`}>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-blue-500" />
                    Time Slot
                  </div>
                </th>
                {days.map(day => (
                  <th key={day.key} className={`p-4 text-center font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'} border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'} min-w-[200px]`}>
                    <div className="flex flex-col items-center">
                      <span className="text-lg">{day.label}</span>
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{day.short}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((timeSlot, timeIndex) => (
                <tr key={timeSlot} className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'} hover:${darkMode ? 'bg-gray-750' : 'bg-gray-50'} transition-colors`}>
                  <td className={`p-4 font-semibold ${darkMode ? 'text-gray-300 bg-gray-750' : 'text-gray-600 bg-gray-50'} sticky left-0`}>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500" />
                      <span className="text-lg">{timeSlot}</span>
                    </div>
                  </td>
                  {days.map((day, dayIndex) => {
                    const classEntry = getClassForTimeSlot(day.key, timeSlot);
                    const isCurrentSlot = isCurrentTimeSlot(day.key, timeSlot);
                    
                    return (
                      <td key={`${day.key}-${timeSlot}`} className={`p-2 relative ${isCurrentSlot ? 'ring-2 ring-yellow-400' : ''}`}>
                        <AnimatePresence>
                          {classEntry ? (
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.9, opacity: 0 }}
                              transition={{ delay: (timeIndex + dayIndex) * 0.05 }}
                              className={`p-4 rounded-xl ${getClassTypeColor(classEntry.type)} border-l-4 cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
                              onClick={() => setShowDetails(showDetails === classEntry.id.toString() ? null : classEntry.id.toString())}
                            >
                              {/* Class Type Icon */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">{getClassTypeIcon(classEntry.type)}</span>
                                {isCurrentSlot && (
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                                )}
                              </div>

                              {/* Course Code */}
                              <div className={`font-bold text-sm mb-1 ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                                {classEntry.course_code}
                              </div>

                              {/* Course Name */}
                              <div className={`font-semibold text-xs mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'} line-clamp-2`}>
                                {classEntry.course_name}
                              </div>

                              {/* Instructor */}
                              <div className={`flex items-center gap-1 text-xs mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <User size={12} />
                                <span className="truncate">{classEntry.instructor_name}</span>
                              </div>

                              {/* Room */}
                              <div className={`flex items-center gap-1 text-xs mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <MapPin size={12} />
                                <span className="font-medium">{classEntry.room}</span>
                              </div>

                              {/* Time */}
                              <div className={`flex items-center gap-1 text-xs mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                <Clock size={12} />
                                <span>{classEntry.start_time} - {classEntry.end_time}</span>
                              </div>

                              {/* Credits */}
                              {classEntry.credits && (
                                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {classEntry.credits} Credits
                                </div>
                              )}

                              {/* Expanded Details */}
                              <AnimatePresence>
                                {showDetails === classEntry.id.toString() && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-2 pt-2 border-t border-gray-300"
                                  >
                                    <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                                      {classEntry.department && (
                                        <div><strong>Department:</strong> {classEntry.department}</div>
                                      )}
                                      {classEntry.semester && (
                                        <div><strong>Semester:</strong> {classEntry.semester}</div>
                                      )}
                                      <div><strong>Type:</strong> {classEntry.type || 'Lecture'}</div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ) : (
                            <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'} border-2 border-dashed ${darkMode ? 'border-gray-600' : 'border-gray-300'} h-32 flex items-center justify-center`}>
                              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} font-medium`}>
                                Free Period
                              </span>
                            </div>
                          )}
                        </AnimatePresence>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border shadow-lg`}>
        <h3 className="text-lg font-semibold mb-4">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-400 rounded"></div>
            <span className="text-sm">📚 Lecture</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-green-100 border-l-4 border-green-400 rounded"></div>
            <span className="text-sm">🧪 Laboratory</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-purple-100 border-l-4 border-purple-400 rounded"></div>
            <span className="text-sm">📝 Tutorial</span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {timetableData.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center py-16 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg`}
        >
          <Calendar className="mx-auto text-gray-400 mb-6" size={64} />
          <h3 className={`text-2xl font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
            No Timetable Available
          </h3>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-lg mb-6`}>
            Your timetable hasn't been set up yet. Please contact your department for more information.
          </p>
          <button
            onClick={fetchTimetable}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Check Again
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProfessionalTimetable;