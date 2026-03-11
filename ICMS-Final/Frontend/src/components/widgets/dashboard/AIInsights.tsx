import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Insight {
  id: string;
  type: 'performance' | 'enrollment' | 'finance' | 'system';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  icon: string;
}

const AIInsights: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([
    {
      id: '1',
      type: 'performance',
      priority: 'high',
      title: 'Student Performance Decline',
      description: 'Mathematics course performance has dropped 15% this semester',
      recommendation: 'Implement additional tutoring sessions and review curriculum',
      impact: 'High - Affects 45% of enrolled students',
      icon: '📊'
    },
    {
      id: '2',
      type: 'enrollment',
      priority: 'medium',
      title: 'Enrollment Pattern Detected',
      description: 'Computer Science course enrollment is 30% higher than predicted',
      recommendation: 'Consider adding additional sections or instructors',
      impact: 'Medium - Resource allocation needed',
      icon: '🎓'
    },
    {
      id: '3',
      type: 'finance',
      priority: 'low',
      title: 'Fee Collection Optimization',
      description: 'Late fee payments can be reduced by 20% with automated reminders',
      recommendation: 'Implement automated SMS/email payment reminders',
      impact: 'Low - Potential $50K annual savings',
      icon: '💰'
    },
    {
      id: '4',
      type: 'system',
      priority: 'high',
      title: 'System Load Prediction',
      description: 'Peak usage expected during exam week - prepare for 40% traffic increase',
      recommendation: 'Scale server resources and monitor performance closely',
      impact: 'High - System stability at risk',
      icon: '⚡'
    }
  ]);

  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance': return 'bg-blue-500';
      case 'enrollment': return 'bg-green-500';
      case 'finance': return 'bg-purple-500';
      case 'system': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
        </div>
        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
          Powered by AI
        </span>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border border-gray-200 rounded-lg p-4 hover:bg-indigo-50 transition-colors cursor-pointer"
            onClick={() => setSelectedInsight(insight)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {insight.title}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(insight.priority)}`}>
                      {insight.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {insight.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Impact:</span> {insight.impact}
                  </p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getTypeColor(insight.type)}`}></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Insight Detail Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{selectedInsight.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedInsight.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(selectedInsight.priority)}`}>
                    {selectedInsight.priority.toUpperCase()} PRIORITY
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Description</h4>
                  <p className="text-sm text-gray-600">
                    {selectedInsight.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">AI Recommendation</h4>
                  <p className="text-sm text-gray-600">
                    {selectedInsight.recommendation}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Impact Assessment</h4>
                  <p className="text-sm text-gray-600">
                    {selectedInsight.impact}
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors\"
                >
                  Dismiss
                </button>
                <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Take Action
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AIInsights;
