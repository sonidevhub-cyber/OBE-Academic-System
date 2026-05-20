import React from 'react';
import { motion } from 'framer-motion';

const SystemHealthWidget = () => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">System Health</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Server Status</span>
          <span className="text-green-600 font-medium">Online</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Database</span>
          <span className="text-green-600 font-medium">Connected</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">API Response</span>
          <span className="text-yellow-600 font-medium">125ms</span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthWidget;