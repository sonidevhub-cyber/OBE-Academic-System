import React from 'react';
import { motion } from 'framer-motion';

const QuickActions = () => {
  const actions = [
    { label: 'Add Student', icon: '👨‍🎓', color: 'bg-blue-500' },
    { label: 'Create Course', icon: '📚', color: 'bg-green-500' },
    { label: 'Generate Report', icon: '📊', color: 'bg-purple-500' },
    { label: 'Send Notice', icon: '📢', color: 'bg-orange-500' }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${action.color} text-white p-3 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity`}
          >
            <span className="text-lg">{action.icon}</span>
            <span>{action.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;