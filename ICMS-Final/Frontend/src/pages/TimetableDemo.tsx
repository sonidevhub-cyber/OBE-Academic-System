import React, { useState } from 'react';
import ProfessionalTimetable from '../components/timetable/ProfessionalTimetable';
import { Moon, Sun, Users, BookOpen, Calendar } from 'lucide-react';

const TimetableDemo: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [viewType, setViewType] = useState<'student' | 'instructor' | 'hod'>('student');
  const [selectedUser, setSelectedUser] = useState('');

  const mockUsers = {
    student: [
      { id: 'STU001', name: 'John Doe', department: 'Computer Science' },
      { id: 'STU002', name: 'Jane Smith', department: 'Mathematics' },
      { id: 'STU003', name: 'Mike Johnson', department: 'Physics' }
    ],
    instructor: [
      { id: 'INS001', name: 'Dr. Alice Brown', department: 'Computer Science' },
      { id: 'INS002', name: 'Prof. Robert Wilson', department: 'Mathematics' },
      { id: 'INS003', name: 'Dr. Sarah Davis', department: 'Physics' }
    ],
    hod: [
      { id: 'HOD001', name: 'Dr. Michael Chen', department: 'Computer Science' },
      { id: 'HOD002', name: 'Prof. Lisa Anderson', department: 'Mathematics' }
    ]
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleViewTypeChange = (type: 'student' | 'instructor' | 'hod') => {
    setViewType(type);
    setSelectedUser('');
  };

  const getViewTypeIcon = (type: string) => {
    switch (type) {
      case 'student': return <BookOpen size={20} />;
      case 'instructor': return <Users size={20} />;
      case 'hod': return <Calendar size={20} />;
      default: return <BookOpen size={20} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Professional Timetable System
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Type Selector */}
              <div className="flex items-center space-x-2">
                {(['student', 'instructor', 'hod'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleViewTypeChange(type)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewType === type
                        ? 'bg-blue-600 text-white'
                        : darkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {getViewTypeIcon(type)}
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>

              {/* User Selector */}
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                <option value="">Select {viewType}</option>
                {mockUsers[viewType].map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.department}
                  </option>
                ))}
              </select>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Timetable Component */}
        <ProfessionalTimetable
          studentId={viewType === 'student' ? selectedUser : undefined}
          instructorId={viewType === 'instructor' ? selectedUser : undefined}
          viewType={viewType}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
};

export default TimetableDemo;