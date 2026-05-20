import React from 'react';
import { Link } from 'react-router-dom';
import ActiveHODRecords from '../components/ActiveHODRecords';

const ActiveHODDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">ICMS - Active HOD Management</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/admin"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6">
        <ActiveHODRecords />
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              <strong>Features:</strong> View, Edit, Delete Active HOD Records | Local Storage | Real-time Updates
            </p>
            <p>
              Data is automatically saved to browser's local storage and persists between sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveHODDemo;