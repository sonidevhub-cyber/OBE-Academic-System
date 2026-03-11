import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Clock, Calendar, BookOpen, MapPin } from 'lucide-react';

interface TimetableEntry {
  id: number;
  subject: string;
  instructor: string;
  room: string;
  start_time: string;
  end_time: string;
  day: string;
}

interface TimetableProps {
  darkMode: boolean;
}

const Timetable: React.FC<TimetableProps> = ({ darkMode }) => {
  const [timetableData, setTimetableData] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      const endpoints = [
        'http://127.0.0.1:8000/api/timetable/',
        'http://127.0.0.1:8000/api/students/timetable/',
        'http://127.0.0.1:8000/api/schedule/'
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          console.log('Trying timetable endpoint:', endpoint);
          const response = await axios.get(endpoint, {
            headers: { Authorization: `Token ${token}` },
          });
          console.log('Timetable response from', endpoint, ':', response.data);
          if (response.data) {
            data = Array.isArray(response.data) ? response.data : 
                   response.data.schedule || response.data.timetable || response.data.results || [];
            if (data.length > 0) break;
          }
        } catch (endpointError: any) {
          console.log('Timetable endpoint failed:', endpoint, endpointError.response?.status);
          continue;
        }
      }
      
      if (data) {
        setTimetableData(data);
      } else {
        console.log('No timetable data found, showing empty schedule');
        setTimetableData([]);
      }
    } catch (error) {
      console.error('Timetable fetch error:', error);
      setTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  const getClassForTimeSlot = (day: string, time: string) => {
    return timetableData.find(entry => {
      const entryDay = entry.day?.toLowerCase() || '';
      const entryTime = entry.start_time?.substring(0, 5) || '';
      return entryDay === day.toLowerCase() && entryTime === time;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}
    >
      {/* Header */}
      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-blue-50 to-indigo-100'} border ${darkMode ? 'border-gray-700' : 'border-blue-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Calendar className="text-blue-500" size={28} />
            Weekly Timetable
          </h2>
          <div className={`px-4 py-2 rounded-full ${darkMode ? 'bg-blue-700' : 'bg-blue-100'} ${darkMode ? 'text-white' : 'text-blue-700'} font-semibold`}>
            Current Semester
          </div>
        </div>
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Your complete class schedule as set by the department HOD
        </p>
      </div>

      {/* Timetable Grid */}
      <div className={`rounded-2xl shadow-lg overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`p-4 text-left font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  Time
                </th>
                {days.map(day => (
                  <th key={day} className={`p-4 text-center font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(time => (
                <tr key={time} className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                  <td className={`p-4 font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${darkMode ? 'bg-gray-750' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500" />
                      {time}
                    </div>
                  </td>
                  {days.map(day => {
                    const classEntry = getClassForTimeSlot(day, time);
                    return (
                      <td key={`${day}-${time}`} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                        {classEntry ? (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900' : 'bg-blue-100'} border-l-4 border-blue-500`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <BookOpen size={14} className="text-blue-600" />
                              <span className={`font-semibold text-sm ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                                {classEntry.subject}
                              </span>
                            </div>
                            <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                              <div>{classEntry.instructor}</div>
                              <div className="flex items-center gap-1">
                                <MapPin size={12} />
                                {classEntry.room}
                              </div>
                              <div className="font-medium">
                                {classEntry.start_time.substring(0, 5)} - {classEntry.end_time.substring(0, 5)}
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} opacity-50`}>
                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Free
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Classes</h3>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {timetableData.length}
              </p>
            </div>
            <BookOpen className="text-blue-500" size={24} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Unique Subjects</h3>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {new Set(timetableData.map(entry => entry.subject)).size}
              </p>
            </div>
            <Calendar className="text-green-500" size={24} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className={`p-6 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Active Days</h3>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {new Set(timetableData.map(entry => entry.day)).size}
              </p>
            </div>
            <Clock className="text-purple-500" size={24} />
          </div>
        </motion.div>
      </div>

      {timetableData.length === 0 && (
        <div className={`text-center py-12 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-lg`}>
          <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
            No Timetable Available
          </h3>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Your department HOD hasn't set up the timetable yet. Please check back later.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default Timetable;