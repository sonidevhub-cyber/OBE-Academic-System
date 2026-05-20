import React from 'react';
import { useAuth } from '../context/AuthContext';

// Attendance/timetable/datesheet removed from student dashboard.

const StudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Student Panel</h1>
        <p className="text-blue-100 text-sm mt-1">Attendance/timetable/datesheet modules removed.</p>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-gray-100 rounded-xl shadow p-6">
          <p className="text-gray-700">Welcome, {currentUser?.name || 'User'}.</p>
        </div>

        <button
          onClick={logout}
          className="mt-6 w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default StudentDashboard;

