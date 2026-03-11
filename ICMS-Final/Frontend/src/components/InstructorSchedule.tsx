import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const InstructorSchedule: React.FC = () => {
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [timetableData, setTimetableData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('today');
  const [showTimetable, setShowTimetable] = useState(false);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      // Try multiple token storage formats (prioritize sessionStorage)
      let token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || localStorage.getItem('token');
      
      if (!token) {
        const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
        if (storedAuth) {
          const authData = JSON.parse(storedAuth);
          token = authData.access_token || authData.token;
        }
      }
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Fetching instructor timetable with token:', token?.substring(0, 10) + '...');
      console.log('Making request to:', 'http://localhost:8000/api/instructors/timetable/');
      
      // Debug: Check current user info
      try {
        const userResponse = await axios.get('http://localhost:8000/api/instructors/current-user/', {
          headers: { Authorization: `Token ${token}` }
        });
        console.log('👤 Current user info:', userResponse.data);
        
        if (!userResponse.data.has_instructor_profile) {
          console.error('❌ Current user has no instructor profile');
          console.log('💡 You need to login as an instructor user');
          setLoading(false);
          return;
        }
      } catch (userError: any) {
        console.error('User info error:', userError.response?.data);
      }
      
      const response = await axios.get('http://localhost:8000/api/instructors/timetable/', {
        headers: { Authorization: `Token ${token}` }
      });
      
      console.log('Instructor timetable response status:', response.status);
      console.log('Instructor timetable response data:', response.data);

      const data = response.data.timetables || [];
      console.log('Instructor timetables received:', data);
      
      // Set instructor name from timetable response if not already set
      if (response.data.instructor && response.data.instructor.name) {
        console.log('Setting instructor name from timetable response:', response.data.instructor.name);
        // You can use this to update instructor profile if needed
      }
      
      // Show instructor info from response
      if (response.data.instructor) {
        console.log('Logged in as instructor:', response.data.instructor);
      }
      
      setScheduleData(data);
      
      if (data.length === 0) {
        console.warn('❌ No timetable entries found for this instructor');
        console.log('🔍 Troubleshooting steps:');
        console.log('1. Check if instructor profile exists and is linked to current user');
        console.log('2. Verify HOD assigned classes to THIS instructor (not just employee_id 0874089)');
        console.log('3. Check if timetable entries have correct instructor foreign key');
        console.log('4. Verify instructor.user field points to current logged-in user');
      } else {
        console.log('✅ Found', data.length, 'timetable entries for instructor');
      }
      
      // Format for timetable grid
      const formattedData: any = {};
      data.forEach((entry: any) => {
        // Ensure proper day capitalization
        const dayName = entry.day.toLowerCase();
        const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        
        // Format time consistently (remove seconds if present)
        const startTime = entry.start_time.substring(0, 5); // Get HH:MM format
        const endTime = entry.end_time.substring(0, 5);
        
        const key = `${dayCapitalized}-${startTime}`;
        
        console.log('Formatting timetable entry:', {
          day: entry.day,
          dayCapitalized,
          startTime,
          key,
          course: entry.course.name
        });
        
        formattedData[key] = {
          subject: entry.course.name,
          courseCode: entry.course.code,
          room: entry.room,
          time: `${startTime}-${endTime}`,
          semester: entry.semester.name,
          id: entry.id
        };
      });
      
      console.log('Final formatted timetable data:', formattedData);
      setTimetableData(formattedData);
      
      // Debug: Log raw and formatted data
      console.log('Raw schedule data:', data);
      console.log('Formatted timetable data keys:', Object.keys(formattedData));
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      if (error.response?.status === 404) {
        console.error('Instructor profile not found - user may not be registered as instructor');
      } else if (error.response?.status === 401) {
        console.error('Authentication failed - check token');
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSchedule = () => {
    if (selectedDay === 'today') {
      return scheduleData.filter(item => 
        item.day.toLowerCase() === today.toLowerCase()
      );
    }
    return scheduleData.filter(item => 
      item.day.toLowerCase() === selectedDay.toLowerCase()
    );
  };

  const getTodaySchedule = () => {
    console.log('Today is:', today);
    console.log('Schedule data:', scheduleData);
    const filtered = scheduleData.filter(item => {
      console.log(`Comparing: '${item.day.toLowerCase()}' === '${today.toLowerCase()}'`);
      return item.day.toLowerCase() === today.toLowerCase();
    });
    console.log('Filtered today classes:', filtered);
    return filtered.sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Debug: Show current user info
  const debugCurrentUser = () => {
    const auth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
    if (auth) {
      const authData = JSON.parse(auth);
      console.log('Current user token info:', authData);
    }
  };
  debugCurrentUser();

  const todayClasses = getTodaySchedule();
  const filteredSchedule = getFilteredSchedule();

  return (
    <div className="space-y-6">
      {/* Today's Classes Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-6 text-white"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Today's Classes ({today})
        </h2>
        
        {todayClasses.length > 0 ? (
          <div className="space-y-3">
            {todayClasses.map((classItem, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <div>
                    <h3 className="font-semibold">{classItem.course.name}</h3>
                    <p className="text-sm opacity-90">{classItem.course.code}</p>
                    <p className="text-xs opacity-75">Room: {classItem.room}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-yellow-300">{classItem.start_time} - {classItem.end_time}</p>
                  <p className="text-xs opacity-75">{classItem.semester.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm opacity-75">No classes scheduled for today</p>
            <p className="mt-1 text-xs opacity-60">Check browser console for debug info</p>
          </div>
        )}
      </motion.div>

      {/* Timetable Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div 
          className="p-6 bg-gradient-to-r from-indigo-500 to-blue-600 text-white cursor-pointer hover:from-indigo-600 hover:to-blue-700 transition-all duration-300"
          onClick={() => setShowTimetable(!showTimetable)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-semibold">Full Timetable View</h3>
            </div>
            <motion.svg 
              className="h-5 w-5"
              animate={{ rotate: showTimetable ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </div>
          <p className="text-sm opacity-90 mt-1">Click to view your complete weekly timetable</p>
        </div>
        
        <AnimatePresence>
          {showTimetable && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-8 gap-0">
                    {/* Header Row */}
                    <div className="bg-indigo-600 p-3 font-semibold text-white text-center text-sm">Time</div>
                    {days.map(day => (
                      <div
                        key={day}
                        className={`p-3 font-semibold text-center text-sm ${
                          day === currentDay 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </div>
                    ))}

                    {/* Time Slots */}
                    {timeSlots.map(time => (
                      <React.Fragment key={time}>
                        <div className="p-3 bg-gray-200 font-medium text-gray-700 text-center text-sm">
                          {time}
                        </div>
                        {days.map(day => {
                          const key = `${day}-${time}`;
                          const classData = timetableData[key];
                          
                          return (
                            <div
                              key={key}
                              className={`p-2 min-h-[60px] text-xs border border-gray-200 ${
                                classData 
                                  ? 'bg-blue-50 hover:bg-blue-100 border-blue-200' 
                                  : 'bg-white hover:bg-gray-50'
                              } transition-colors`}
                            >
                              {classData ? (
                                <div className="h-full">
                                  <div className="font-semibold text-blue-800 mb-1 truncate text-xs">
                                    {classData.subject}
                                  </div>
                                  <div className="text-gray-600 truncate text-xs">
                                    {classData.courseCode}
                                  </div>
                                  <div className="text-gray-500 truncate text-xs">
                                    Room: {classData.room}
                                  </div>
                                  <div className="text-gray-400 truncate text-xs mt-1">
                                    {classData.time}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-400 text-center pt-4 text-xs">
                                  Free
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Weekly Schedule */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Weekly Schedule</h2>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">Today</option>
            {days.map(day => (
              <option key={day} value={day.toLowerCase()}>{day}</option>
            ))}
          </select>
        </div>

        {filteredSchedule.length > 0 ? (
          <div className="space-y-3">
            {filteredSchedule
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((classItem, index) => (
                <motion.div 
                  key={index} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div>
                      <h4 className="font-medium text-gray-900">{classItem.course.name}</h4>
                      <p className="text-sm text-gray-600">{classItem.course.code} • Room {classItem.room}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">{classItem.start_time} - {classItem.end_time}</p>
                    <p className="text-xs text-gray-500">{classItem.semester.name}</p>
                  </div>
                </motion.div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No classes scheduled for {selectedDay === 'today' ? 'today' : selectedDay}</p>
          </div>
        )}
      </motion.div>

      {/* Quick Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Today's Classes</h3>
          <p className="text-3xl font-bold">{todayClasses.length}</p>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Total Weekly Classes</h3>
          <p className="text-3xl font-bold">{scheduleData.length}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
          <h3 className="text-sm font-medium opacity-90">Unique Courses</h3>
          <p className="text-3xl font-bold">
            {new Set(scheduleData.map(item => item.course.code)).size}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default InstructorSchedule;