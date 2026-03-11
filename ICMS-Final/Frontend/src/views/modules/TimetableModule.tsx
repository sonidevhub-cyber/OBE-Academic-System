import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

interface TimetableModuleProps {
  token: string;
  semesterId?: number;
  onEntryEdit?: (entry: TimetableEntry) => void;
  onEntryDelete?: (entryId: number) => void;
}

const TimetableModule: React.FC<TimetableModuleProps> = ({ 
  token, 
  semesterId, 
  onEntryEdit, 
  onEntryDelete 
}) => {
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const url = semesterId 
        ? `http://localhost:8000/api/academics/hod/timetable/?semester_id=${semesterId}`
        : `http://localhost:8000/api/academics/hod/timetable/`;
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimetableEntries(data.timetables || []);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [token, semesterId]);

  const deleteEntry = async (entryId: number) => {
    if (!window.confirm('Delete this timetable entry?')) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/academics/hod/timetable/${entryId}/`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setTimetableEntries(prev => prev.filter(entry => entry.id !== entryId));
        onEntryDelete?.(entryId);
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading timetable...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white p-6 rounded-lg shadow-md"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">
          Timetable {semesterId ? `- Semester ${semesterId}` : ''}
        </h3>
        <button
          onClick={fetchTimetable}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600"
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
                        onClick={() => onEntryEdit?.(entry)}
                        className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
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
    </motion.div>
  );
};

export default TimetableModule;