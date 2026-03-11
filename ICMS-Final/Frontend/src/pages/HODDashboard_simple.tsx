import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { instructorService } from '../api/studentInstructorService';
import { coordinatorService } from '../api/coordinatorService';

type TabId = 'dashboard' | 'instructors' | 'coordinators';

const HODDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [instructors, setInstructors] = useState<any[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await loadInstructors();
      await loadCoordinators();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const response = await instructorService.getAllInstructors();
      setInstructors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading instructors:', error);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCoordinators = async () => {
    try {
      const response = await coordinatorService.getCoordinators();
      setCoordinators(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading coordinators:', error);
      setCoordinators([]);
    }
  };

  const tabs = [
    { id: 'dashboard' as TabId, label: 'Dashboard' },
    { id: 'instructors' as TabId, label: 'Instructors' },
    { id: 'coordinators' as TabId, label: 'Coordinators' }
  ];

  const renderSidebar = () => (
    <div className="w-64 bg-gradient-to-b from-purple-800 to-indigo-900 text-white p-4 space-y-2 min-h-screen">
      <div className="mb-8 text-center">
        <h3 className="text-lg font-medium">HOD Portal</h3>
        <p className="text-sm text-purple-200">{currentUser?.name || 'Head of Department'}</p>
      </div>

      <nav>
        <ul className="space-y-2">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id ? 'bg-purple-700 text-white' : 'text-purple-100 hover:bg-purple-700'
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <button
            onClick={logout}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-medium text-gray-900">Total Instructors</h3>
                <p className="text-2xl font-bold text-purple-600">{instructors.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-medium text-gray-900">Total Coordinators</h3>
                <p className="text-2xl font-bold text-blue-600">{coordinators.length}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-medium text-gray-900">Department Rating</h3>
                <p className="text-2xl font-bold text-green-600">4.8/5</p>
              </div>
            </div>
          </div>
        );
      case 'instructors':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-medium mb-4">Department Instructors</h3>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="space-y-2">
                {instructors.map((instructor) => (
                  <div key={instructor.id} className="p-3 border rounded-lg">
                    <p className="font-medium">{instructor.name}</p>
                    <p className="text-sm text-gray-600">ID: {instructor.employee_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'coordinators':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-medium mb-4">Department Coordinators</h3>
            <div className="space-y-2">
              {coordinators.map((coordinator) => (
                <div key={coordinator.id} className="p-3 border rounded-lg">
                  <p className="font-medium">{coordinator.name}</p>
                  <p className="text-sm text-gray-600">ID: {coordinator.employee_id}</p>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <div>Dashboard content</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {renderSidebar()}
      <div className="flex-1 overflow-auto">
        <header className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg px-6 py-4">
          <h1 className="text-2xl font-bold text-white">
            {tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}
          </h1>
          <p className="text-purple-100">Welcome back, {currentUser?.name || 'Head of Department'}</p>
        </header>
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default HODDashboard;