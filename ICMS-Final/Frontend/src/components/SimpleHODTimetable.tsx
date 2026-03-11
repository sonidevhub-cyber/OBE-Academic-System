import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SimpleHODTimetable: React.FC = () => {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [timetable, setTimetable] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClass, setNewClass] = useState({
    course_id: '',
    instructor_id: '',
    day: '',
    start_time: '',
    end_time: '',
    room: ''
  });

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/api/academics/hod/timetable/?action=form_data', {
        headers: { Authorization: `Token ${token}` }
      });
      setSemesters(response.data.semesters);
      setCourses(response.data.courses);
      setInstructors(response.data.instructors);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchTimetable = async (semesterId: string) => {
    try {
      const token = localStorage.getItem('token');
      const url = semesterId 
        ? `http://localhost:8000/api/academics/hod/timetable/?semester_id=${semesterId}`
        : 'http://localhost:8000/api/academics/hod/timetable/';
      
      const response = await axios.get(url, {
        headers: { Authorization: `Token ${token}` }
      });
      setTimetable(response.data.timetables);
    } catch (error) {
      console.error('Error fetching timetable:', error);
    }
  };

  const handleSemesterChange = (semesterId: string) => {
    setSelectedSemester(semesterId);
    fetchTimetable(semesterId);
  };

  
  const getFilteredCourses = () => {
    if (!selectedSemester) return courses;
    return courses.filter(course => course.semester_id === parseInt(selectedSemester));
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8000/api/academics/hod/timetable/', newClass, {
        headers: { Authorization: `Token ${token}` }
      });
      setShowAddForm(false);
      setNewClass({ course_id: '', instructor_id: '', day: '', start_time: '', end_time: '', room: '' });
      fetchTimetable(selectedSemester);
    } catch (error) {
      console.error('Error adding class:', error);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Semester:</label>
          <select
            value={selectedSemester}
            onChange={(e) => handleSemesterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Semesters</option>
            {semesters.map(sem => (
              <option key={sem.semester_id} value={sem.semester_id}>
                {sem.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {timetable.length} entries found
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add Class
          </button>
        </div>
      </div>

      {/* Add Class Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Add New Class</h3>
          <form onSubmit={handleAddClass} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course:</label>
              <select
                value={newClass.course_id}
                onChange={(e) => setNewClass({...newClass, course_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Course</option>
                {getFilteredCourses().map(course => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.name} ({course.code}) - {course.semester}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructor:</label>
              <select
                value={newClass.instructor_id}
                onChange={(e) => setNewClass({...newClass, instructor_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Instructor</option>
                {instructors.map(instructor => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name} ({instructor.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day:</label>
              <select
                value={newClass.day}
                onChange={(e) => setNewClass({...newClass, day: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Day</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room:</label>
              <input
                type="text"
                value={newClass.room}
                onChange={(e) => setNewClass({...newClass, room: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Room number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time:</label>
              <input
                type="time"
                value={newClass.start_time}
                onChange={(e) => setNewClass({...newClass, start_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time:</label>
              <input
                type="time"
                value={newClass.end_time}
                onChange={(e) => setNewClass({...newClass, end_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Class
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Timetable */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {timetable.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No timetable entries found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {timetable.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {entry.day}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.start_time} - {entry.end_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.course.name} ({entry.course.code})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.instructor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.room || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleHODTimetable;