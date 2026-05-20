import React from 'react';
import { motion } from 'framer-motion';

const AIInsights = () => {
  const insights = [
    { text: "Student attendance has improved by 15% this month", type: "positive" },
    { text: "Consider adding more evening classes for working students", type: "suggestion" },
    { text: "Computer Science department shows highest enrollment growth", type: "info" }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Insights</h3>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-3 rounded-lg border-l-4 ${
              insight.type === 'positive' ? 'bg-green-50 border-green-400' :
              insight.type === 'suggestion' ? 'bg-blue-50 border-blue-400' :
              'bg-gray-50 border-gray-400'
            }`}
          >
            <p className="text-sm text-gray-700">{insight.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AIInsights;