 
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TimetableManagement: React.FC = () => {
  const [selectedSemester, setSelectedSemester] = useState('');
  const [semesters, setSemesters] = useState<any[]>([]);
  const [department, setDepartment] = useState<any>(null);
  const [timetableData, setTimetableData] = useState<any>({});
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newClass, setNewClass] = useState({
    semester_id: '',
    course_id: '',
    instructor_id: '',
    day: 'monday',
    start_time: '09:00',
    end_time: '10:30',
    room: ''
  });

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (showAddModal && semesters.length === 0) {
      fetchDashboardData();
    }
  }, [showAddModal]);

  const fetchDashboardData = async () => {
    try {
      const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;

      const response = await axios.get('http://127.0.0.1:8000/api/hods/timetable/?action=form_data', {
        headers: { Authorization: `Token ${token}` }
      });

      console.log('Dashboard data:', response.data);

      // Set data from API response
      setSemesters(response.data.semesters || []);
      setAvailableCourses(response.data.courses || []);
      setAvailableInstructors(response.data.instructors || []);

      // Initially show all courses

      // Load timetable data
      await fetchTimetable();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Don't set fallback data - let it show empty lists so real data is used
      setSemesters([]);
      setAvailableCourses([]);
      setAvailableInstructors([]);
    }
  };

  const fetchTimetable = async () => {
    try {
      const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;

      const url = selectedSemester
        ? `http://127.0.0.1:8000/api/hods/timetable/?semester_id=${selectedSemester}`
        : 'http://127.0.0.1:8000/api/hods/timetable/';

      const response = await axios.get(url, {
        headers: { Authorization: `Token ${token}` }
      });

      console.log('Timetable data:', response.data);

      const formattedData: any = {};
      response.data.timetables?.forEach((entry: any) => {
        const dayCapitalized = entry.day.charAt(0).toUpperCase() + entry.day.slice(1);
        const key = `${dayCapitalized}-${entry.start_time}`;
        formattedData[key] = {
          subject: entry.course.name,
          instructor: entry.instructor.name,
          room: entry.room,
          semester: entry.course.semester || entry.semester?.name,
          time: `${entry.start_time}-${entry.end_time}`,
          id: entry.id
        };
      });
      setTimetableData(formattedData);

    } catch (error) {
      console.error('Error fetching timetable:', error);
    }
  };

  useEffect(() => {
    if (selectedSemester) {
      fetchTimetable();
    }
  }, [selectedSemester]);

  const deleteClass = async (day: string, time: string) => {
    const key = `${day}-${time}`;
    const classData = timetableData[key];

    if (classData?.id && window.confirm('Delete this class?')) {
      try {
        const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
        if (!storedAuth) {
          throw new Error('No authentication data found');
        }
        const authData = JSON.parse(storedAuth);
        const token = authData.access_token;

        await axios.delete(`http://127.0.0.1:8000/api/hods/timetable/${classData.id}/`, {
          headers: { Authorization: `Token ${token}` }
        });

        // Refresh timetable data after successful deletion
        await fetchTimetable();
      } catch (error) {
        console.error('Error deleting class:', error);
      }
    }
  };

  const handleAddClass = async () => {
    try {
      const storedAuth = sessionStorage.getItem('auth') || localStorage.getItem('auth');
      if (!storedAuth) {
        throw new Error('No authentication data found');
      }
      const authData = JSON.parse(storedAuth);
      const token = authData.access_token;

      const response = await axios.post('http://127.0.0.1:8000/api/hods/timetable/', newClass, {
        headers: { Authorization: `Token ${token}` }
      });

      // Refresh timetable data after successful addition
      await fetchTimetable();
      
      setShowAddModal(false);
      setNewClass({
        semester_id: '',
        course_id: '',
        instructor_id: '',
        day: 'monday',
        start_time: '09:00',
        end_time: '10:30',
        room: ''
      });
    } catch (error: any) {
      console.error('Error adding class:', error);
      const errorMessage = error.response?.data?.error || 'Error adding class';
      
      if (error.response?.data?.conflict_details) {
        const conflict = error.response.data.conflict_details;
        alert(`⚠️ SCHEDULING CONFLICT\n\n${errorMessage}\n\nExisting: ${conflict.existing_course} (${conflict.existing_time})\nNew: ${conflict.new_time}\n\nPlease choose a different time slot.`);
      } else {
        alert(errorMessage);
      }
    }
  };

  // Handle course selection - only set semester if not already selected
  const handleCourseChange = (courseId: string) => {
    const selectedCourse = availableCourses.find((course: any) => course.course_id === courseId);
    setNewClass({
      ...newClass,
      course_id: courseId,
      // Only set semester if it's empty, otherwise keep current selection
      semester_id: newClass.semester_id || (selectedCourse ? selectedCourse.semester_id.toString() : '')
    });
  };

  // Handle semester selection and reset course
  const handleSemesterChange = (semesterId: string) => {
    setNewClass({
      ...newClass,
      semester_id: semesterId,
      course_id: '' // Reset course when semester changes
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Timetable Management</h2>
              {selectedSemester && (
                <p className="text-gray-600 mt-1">
                  Showing: {semesters.find(s => s.semester_id.toString() === selectedSemester)?.name || 'Selected Semester'}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Semesters</option>
                {semesters.map(sem => (
                  <option key={sem.semester_id} value={sem.semester_id}>
                    {sem.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setModalLoading(true);
                  // Ensure we have fresh data when opening modal
                  fetchDashboardData().finally(() => setModalLoading(false));
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Add Class</span>
              </button>
            </div>
          </div>

          {/* Timetable Grid */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="grid grid-cols-8 gap-0">
              {/* Header Row */}
              <div className="bg-blue-600 p-4 font-semibold text-white border-b border-r border-gray-300">Time</div>
              {days.map(day => (
                <div
                  key={day}
                  className={`p-4 font-semibold text-center border-b border-r border-gray-300 ${
                    day === currentDay 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {day}
                </div>
              ))}

              {/* Time Slots */}
              {timeSlots.map(time => (
                <React.Fragment key={time}>
                  <div className="p-4 bg-gray-200 font-semibold text-gray-800 border-b border-r text-center">
                    {time}
                  </div>
                  {days.map(day => {
                    const classData = timetableData[`${day}-${time}`];
                    return (
                      <div
                        key={`${day}-${time}`}
                        className={`p-3 border-b border-r min-h-[100px] transition-all hover:bg-gray-50 ${
                          day === currentDay ? 'bg-orange-50' : 'bg-white'
                        }`}
                      >
                        {classData ? (
                          <div className="bg-blue-500 text-white p-4 rounded-lg shadow-md relative group hover:shadow-lg transition-all duration-200">
                            <button
                              onClick={() => deleteClass(day, time)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 shadow-lg"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <div className="text-sm font-bold mb-2 text-center">{classData.subject}</div>
                            <div className="text-xs opacity-95 mb-1">Instructor: {classData.instructor}</div>
                            <div className="text-xs opacity-95 mb-1">Room: {classData.room}</div>
                            {classData.semester && (
                              <div className="text-xs opacity-95 mb-1">Semester: {classData.semester}</div>
                            )}
                            <div className="text-xs opacity-90 mt-2 text-center bg-white bg-opacity-30 rounded py-1">{classData.time}</div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                            + Add Class
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Add Class Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-4">Add New Class</h3>
                {modalLoading && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading data...</p>
                  </div>
                )}
                
                {!modalLoading && (
                  <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Semester</label>
                        <select
                          value={newClass.semester_id}
                          onChange={(e) => handleSemesterChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Semester</option>
                          {semesters.map(sem => (
                            <option key={sem.semester_id} value={sem.semester_id}>
                              {sem.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Course</label>
                        <select
                          value={newClass.course_id}
                          onChange={(e) => handleCourseChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Course</option>
                          {availableCourses.filter(course => !newClass.semester_id || course.semester_id.toString() === newClass.semester_id).map((course: any) => (
                            <option key={course.course_id} value={course.course_id}>
                              {course.name} ({course.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Instructor</label>
                        <select
                          value={newClass.instructor_id}
                          onChange={(e) => setNewClass({...newClass, instructor_id: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Instructor</option>
                          {availableInstructors.length > 0 ? availableInstructors.map(instructor => (
                            <option key={instructor.id} value={instructor.id}>
                              {instructor.name} ({instructor.employee_id})
                            </option>
                          )) : (
                            <option disabled>No instructors available</option>
                          )}
                        </select>
                      </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Day</label>
                    <select
                      value={newClass.day}
                      onChange={(e) => setNewClass({...newClass, day: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Room</label>
                    <input
                      type="text"
                      value={newClass.room}
                      onChange={(e) => setNewClass({...newClass, room: e.target.value})}
                      placeholder="Room number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newClass.start_time}
                      onChange={(e) => setNewClass({...newClass, start_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <input
                      type="time"
                      value={newClass.end_time}
                      onChange={(e) => setNewClass({...newClass, end_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddClass}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Class
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default TimetableManagement;