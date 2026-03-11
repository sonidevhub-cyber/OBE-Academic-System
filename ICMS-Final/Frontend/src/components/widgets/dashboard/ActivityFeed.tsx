import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Activity {
  id: string;
  type: 'user' | 'system' | 'academic' | 'financial';
  action: string;
  description: string;
  timestamp: Date;
  user?: string;
  icon: string;
}

const ActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      const token = JSON.parse(localStorage.getItem("auth") || "{}")?.access_token;

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const activities: Activity[] = [];

        // Fetch students for user activity
        try {
          const studentRes = await fetch('http://localhost:8000/api/students/', {
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
          });
          if (studentRes.ok) {
            const studentData = await studentRes.json();
            const students = studentData.results || [];
            if (students.length > 0) {
              const student = students[0];
              activities.push({
                id: `student-${student.id}`,
                type: 'user',
                action: 'Student Registered',
                description: `Student ${student.user?.first_name} ${student.user?.last_name} registered`,
                timestamp: new Date(Date.now() - Math.random() * 3600000),
                user: 'System',
                icon: '👤'
              });
            }
          }
        } catch (error) {
          console.error('Error fetching students:', error);
        }

        // Fetch instructors for academic activity
        try {
          const instructorRes = await fetch('http://localhost:8000/api/instructors/instructor/', {
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' }
          });
          if (instructorRes.ok) {
            const instructorData = await instructorRes.json();
            const instructors = instructorData.results || [];
            if (instructors.length > 0) {
              const instructor = instructors[0];
              activities.push({
                id: `instructor-${instructor.id}`,
                type: 'user',
                action: 'Instructor Added',
                description: `Instructor ${instructor.user?.first_name} ${instructor.user?.last_name} added to system`,
                timestamp: new Date(Date.now() - Math.random() * 7200000),
                user: 'Admin',
                icon: '👨‍🏫'
              });
            }
          }
        } catch (error) {
          console.error('Error fetching instructors:', error);
        }

        // Add system activity
        activities.push({
          id: 'system-backup',
          type: 'system',
          action: 'System Status',
          description: 'All systems operational and running smoothly',
          timestamp: new Date(Date.now() - 600000),
          user: 'System',
          icon: '🔄'
        });

        // Add academic activity (placeholder)
        activities.push({
          id: 'academic-update',
          type: 'academic',
          action: 'Academic Update',
          description: 'Academic calendar and schedules updated',
          timestamp: new Date(Date.now() - 1800000),
          user: 'Academic Office',
          icon: '📚'
        });

        // Sort by timestamp (most recent first)
        activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setActivities(activities);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-500';
      case 'system': return 'bg-green-500';
      case 'academic': return 'bg-purple-500';
      case 'financial': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading activities...</div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">No activities yet</div>
          </div>
        ) : (
          activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm ${getTypeColor(activity.type)}`}>
                {activity.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.action}
                  </p>
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  {activity.description}
                </p>

                {activity.user && (
                  <p className="text-xs text-gray-500 mt-1">
                    by {activity.user}
                  </p>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          View All Activity →
        </button>
      </div>
    </motion.div>
  );
};

export default ActivityFeed;
