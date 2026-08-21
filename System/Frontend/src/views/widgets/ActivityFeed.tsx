import React from 'react';
import { motion } from 'framer-motion';

const ActivityFeed = () => {
  const activities = [
    { user: "John Doe", action: "registered for Computer Science", time: "2 minutes ago", type: "registration" },
    { user: "Admin", action: "approved HOD request for Mathematics", time: "15 minutes ago", type: "approval" },
    { user: "Jane Smith", action: "submitted assignment for Physics", time: "1 hour ago", type: "submission" },
    { user: "System", action: "generated monthly attendance report", time: "2 hours ago", type: "system" }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'registration': return '👤';
      case 'approval': return '✅';
      case 'submission': return '📝';
      case 'system': return '⚙️';
      default: return '📋';
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
          >
            <span className="text-lg">{getActivityIcon(activity.type)}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-800">
                <span className="font-medium">{activity.user}</span> {activity.action}
              </p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;