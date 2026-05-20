import React from 'react';
import { motion } from 'framer-motion';

interface StatsProps {
  stats: {
    totalStudents: number;
    totalStaff: number;
    totalDepartments: number;
    totalCourses: number;
  };
  hodRequests?: {
    pending: number;
  };
  onNavigate?: (tab: any) => void;
}

const DashboardStats: React.FC<StatsProps> = ({ stats, hodRequests, onNavigate }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Students</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalStudents}</p>
          </div>
          <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 016 0z" />
            </svg>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Instructors</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalStaff}</p>
          </div>
          <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </motion.div>

      {hodRequests && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer"
          onClick={() => onNavigate?.('hod')}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-600 text-sm font-medium">HOD Requests</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{hodRequests.pending}</p>
              <p className="text-xs text-gray-500 mt-1">Click to manage</p>
            </div>
            <div className="h-14 w-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 cursor-pointer"
        onClick={() => onNavigate?.('admin-management')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Admins</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">3</p>
            <p className="text-xs text-gray-500 mt-1">Click to manage</p>
          </div>
          <div className="h-14 w-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardStats;