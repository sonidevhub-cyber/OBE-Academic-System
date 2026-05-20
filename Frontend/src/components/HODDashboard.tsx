import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Semester {
  semester_id: number;
  name: string;
  semester_code: string;
}

interface Course {
  course_id: number;
  name: string;
  code: string;
  credits: number;
  semester: number;
}

interface Instructor {
  id: number;
  name: string;
  employee_id: string;
  specialization: string;
  designation?: string;
}

interface TimeSlot {
  day: string;
  start_time: string;
  end_time: string;
  instructor_id: number;
  course_id: number;
  semester_id: number;
  room?: string;
}

interface TimetableEntry {
  id: number;
  course: {
    id: number;
    name: string;
    code: string;
  };
  instructor: {
    id: number;
    name: string;
  };
  semester: {
    id: number;
    name: string;
  };
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

const HODDashboard: React.FC = () => {
  const [department, setDepartment] = useState<Department | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<Instructor[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [semesterCourses, setSemesterCourses] = useState<Course[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [showTimetable, setShowTimetable] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState<TimeSlot>({
    day: 'monday',
    start_time: '08:00',
    end_time: '09:30',
    instructor_id: 0,
    course_id: 0,
    semester_id: 0,
    room: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:8000/api/academics';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/hod/dashboard/`, {
        headers: { Authorization: `Token ${token}` }
      });

      setDepartment(response.data.department);
      setSemesters(response.data.semesters);
      setCourses(response.data.courses);
      setInstructors(response.data.instructors);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
      setLoading(false);
    }
  };

  const fetchSemesterCourses = async (semesterId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/hod/semesters/${semesterId}/courses/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setSemesterCourses(response.data.courses);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load semester courses');
    }
  };

  const checkAvailableInstructors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE}/hod/instructors/available/`, {
        day: newTimeSlot.day,
        start_time: newTimeSlot.start_time,
        end_time: newTimeSlot.end_time,
        department_id: department?.id
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      setAvailableInstructors(response.data.available_instructors);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check instructor availability');
    }
  };

  const createTimetableEntry = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/hod/timetable/`, newTimeSlot, {
        headers: { Authorization: `Token ${token}` }
      });
      
      alert('Timetable entry created successfully!');
      // Reset form
      setNewTimeSlot({
        day: 'monday',
        start_time: '08:00',
        end_time: '09:30',
        instructor_id: 0,
        course_id: 0,
        semester_id: selectedSemester || 0,
        room: ''
      });
      setAvailableInstructors([]);
      // Refresh timetable if showing
      if (showTimetable) {
        fetchTimetable(selectedSemester || undefined);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create timetable entry');
    }
  };

  const validateTimeSlot = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE}/hod/timeslot/validate/`, {
        day: newTimeSlot.day,
        start_time: newTimeSlot.start_time,
        end_time: newTimeSlot.end_time,
        room: newTimeSlot.room,
        instructor_id: newTimeSlot.instructor_id
      }, {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.data.is_valid) {
        alert('Time slot is available!');
      } else {
        alert(`Conflicts found: ${response.data.conflicts.join(', ')}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to validate time slot');
    }
  };

  const handleSemesterChange = (semesterId: number) => {
    setSelectedSemester(semesterId);
    setNewTimeSlot(prev => ({ ...prev, semester_id: semesterId }));
    fetchSemesterCourses(semesterId);
    if (showTimetable) {
      fetchTimetable(semesterId);
    }
  };

  const fetchTimetable = async (semesterId?: number) => {
    try {
      const token = localStorage.getItem('token');
      const url = semesterId 
        ? `${API_BASE}/hod/timetable/?semester_id=${semesterId}`
        : `${API_BASE}/hod/timetable/`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Token ${token}` }
      });
      setTimetableEntries(response.data.timetables);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load timetable');
    }
  };

  const deleteEntry = async (entryId: number) => {
    if (!confirm('Delete this timetable entry?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/hod/timetable/${entryId}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      
      setTimetableEntries(prev => prev.filter(entry => entry.id !== entryId));
      alert('Entry deleted successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete entry');
    }
  };

  const startEdit = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setNewTimeSlot({
      day: entry.day,
      start_time: entry.start_time,
      end_time: entry.end_time,
      instructor_id: entry.instructor.id,
      course_id: entry.course.id,
      semester_id: entry.semester.id,
      room: entry.room
    });
  };

  const updateEntry = async () => {
    if (!editingEntry) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/hod/timetable/${editingEntry.id}/`, {
        start_time: newTimeSlot.start_time,
        end_time: newTimeSlot.end_time,
        room: newTimeSlot.room,
        instructor_id: newTimeSlot.instructor_id
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      alert('Entry updated successfully!');
      setEditingEntry(null);
      fetchTimetable(selectedSemester || undefined);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update entry');
    }
  };

  const handleTimeSlotChange = () => {
    checkAvailableInstructors();
  };

  const toggleTimetableView = () => {
    setShowTimetable(!showTimetable);
    if (!showTimetable) {
      fetchTimetable(selectedSemester || undefined);
    }
  };

  if (loading) return <div className="p-4">Loading HOD Dashboard...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">HOD Dashboard</h1>
      
      {/* Department Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Department: {department?.name}</h2>
        <p className="text-gray-600">Code: {department?.code}</p>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>Semesters: {semesters.length}</div>
          <div>Courses: {courses.length}</div>
          <div>Instructors: {instructors.length}</div>
        </div>
      </div>

      {/* Semester Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="font-medium">Filter by Semester:</label>
            <select
              value={selectedSemester || ''}
              onChange={(e) => handleSemesterChange(Number(e.target.value))}
              className="p-2 border rounded-md"
            >
              <option value="">All Semesters</option>
              {semesters.map(semester => (
                <option key={semester.semester_id} value={semester.semester_id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTimetableView}
              className={`px-4 py-2 rounded-md ${showTimetable ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              {showTimetable ? 'Hide Timetable' : 'View Timetable'}
            </button>
          </div>
        </div>
      </div>

      {/* Timetable Display */}
      {showTimetable && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">
              Timetable {selectedSemester ? `- ${semesters.find(s => s.semester_id === selectedSemester)?.name}` : ''}
            </h3>
            <button
              onClick={() => fetchTimetable(selectedSemester || undefined)}
              className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
            >
              Refresh
            </button>
          </div>
          
          {timetableEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No timetable entries found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left">Day</th>
                    <th className="border p-2 text-left">Time</th>
                    <th className="border p-2 text-left">Course</th>
                    <th className="border p-2 text-left">Instructor</th>
                    <th className="border p-2 text-left">Room</th>
                    <th className="border p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timetableEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="border p-2 capitalize">{entry.day}</td>
                      <td className="border p-2">{entry.start_time} - {entry.end_time}</td>
                      <td className="border p-2">{entry.course.name} ({entry.course.code})</td>
                      <td className="border p-2">{entry.instructor.name}</td>
                      <td className="border p-2">{entry.room || 'N/A'}</td>
                      <td className="border p-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(entry)}
                            className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteEntry(entry.id)}
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Timetable Creation/Edit Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-xl font-semibold mb-4">
          {editingEntry ? 'Edit Timetable Entry' : 'Create Timetable Entry'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Semester Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Semester</label>
            <select
              value={selectedSemester || ''}
              onChange={(e) => handleSemesterChange(Number(e.target.value))}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Select Semester</option>
              {semesters.map(semester => (
                <option key={semester.semester_id} value={semester.semester_id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>

          {/* Course Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Course</label>
            <select
              value={newTimeSlot.course_id}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, course_id: Number(e.target.value) }))}
              className="w-full p-2 border rounded-md"
              disabled={!selectedSemester}
            >
              <option value={0}>Select Course</option>
              {semesterCourses.map(course => (
                <option key={course.course_id} value={course.course_id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
          </div>

          {/* Day Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Day</label>
            <select
              value={newTimeSlot.day}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, day: e.target.value }))}
              className="w-full p-2 border rounded-md"
            >
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-medium mb-2">Room</label>
            <input
              type="text"
              value={newTimeSlot.room}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, room: e.target.value }))}
              className="w-full p-2 border rounded-md"
              placeholder="Room number"
            />
          </div>

          {/* Custom Time Slots */}
          <div>
            <label className="block text-sm font-medium mb-2">Start Time</label>
            <input
              type="time"
              value={newTimeSlot.start_time}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, start_time: e.target.value }))}
              className="w-full p-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">End Time</label>
            <input
              type="time"
              value={newTimeSlot.end_time}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, end_time: e.target.value }))}
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>

        {/* Check Availability Button */}
        <div className="mb-4">
          <button
            onClick={handleTimeSlotChange}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 mr-2"
          >
            Check Available Instructors
          </button>
          <button
            onClick={validateTimeSlot}
            className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
          >
            Validate Time Slot
          </button>
        </div>

        {/* Available Instructors */}
        {availableInstructors.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Available Instructors</label>
            <select
              value={newTimeSlot.instructor_id}
              onChange={(e) => setNewTimeSlot(prev => ({ ...prev, instructor_id: Number(e.target.value) }))}
              className="w-full p-2 border rounded-md"
            >
              <option value={0}>Select Instructor</option>
              {availableInstructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name} ({instructor.employee_id}) - {instructor.specialization}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {editingEntry ? (
            <>
              <button
                onClick={updateEntry}
                disabled={!newTimeSlot.instructor_id}
                className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
              >
                Update Entry
              </button>
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setNewTimeSlot({
                    day: 'monday',
                    start_time: '08:00',
                    end_time: '09:30',
                    instructor_id: 0,
                    course_id: 0,
                    semester_id: selectedSemester || 0,
                    room: ''
                  });
                }}
                className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={createTimetableEntry}
              disabled={!newTimeSlot.instructor_id || !newTimeSlot.course_id || !newTimeSlot.semester_id}
              className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 disabled:bg-gray-400"
            >
              Create Timetable Entry
            </button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h4 className="font-semibold text-gray-700">Total Semesters</h4>
          <p className="text-2xl font-bold text-blue-600">{semesters.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h4 className="font-semibold text-gray-700">Total Courses</h4>
          <p className="text-2xl font-bold text-green-600">{courses.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h4 className="font-semibold text-gray-700">Total Instructors</h4>
          <p className="text-2xl font-bold text-purple-600">{instructors.length}</p>
        </div>
      </div>
    </div>
  );
};

export default HODDashboard;