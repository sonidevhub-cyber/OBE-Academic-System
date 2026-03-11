import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface SystemMetrics {
  serverStatus: 'online' | 'offline' | 'warning';
  databaseStatus: 'online' | 'offline' | 'warning';
  apiResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
}

const SystemHealthWidget: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    serverStatus: 'online',
    databaseStatus: 'online',
    apiResponseTime: 245,
    memoryUsage: 67,
    cpuUsage: 34,
    activeUsers: 1247,
    totalRequests: 15420,
    errorRate: 0.02,
  });

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api/monitoring/health/`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch system health metrics:', error);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '●';
      case 'warning': return '▲';
      case 'offline': return '●';
      default: return '●';
    }
  };

  const getUsageColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-500';
    if (value >= thresholds.warning) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 rounded-xl shadow-lg border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${getStatusColor(metrics.serverStatus)}`}>
            {getStatusIcon(metrics.serverStatus)} Server
          </span>
          <span className={`text-sm font-medium ${getStatusColor(metrics.databaseStatus)}`}>
            {getStatusIcon(metrics.databaseStatus)} Database
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* API Response Time */}
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">{metrics.apiResponseTime}ms</div>
          <div className="text-sm text-gray-600">Response Time</div>
          <div className={`text-xs mt-1 ${getUsageColor(metrics.apiResponseTime, { warning: 300, critical: 500 })}`}>
            {metrics.apiResponseTime < 300 ? 'Good' : metrics.apiResponseTime < 500 ? 'Slow' : 'Critical'}
          </div>
        </div>

        {/* Memory Usage */}
        <div className="text-center">
          <div className={`text-xl font-bold ${getUsageColor(metrics.memoryUsage, { warning: 70, critical: 85 })}`}>
            {metrics.memoryUsage}%
          </div>
          <div className="text-sm text-gray-600">Memory</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div
              className={`h-2 rounded-full ${metrics.memoryUsage >= 85 ? 'bg-red-500' : metrics.memoryUsage >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${metrics.memoryUsage}%` }}
            ></div>
          </div>
        </div>

        {/* CPU Usage */}
        <div className="text-center">
          <div className={`text-xl font-bold ${getUsageColor(metrics.cpuUsage, { warning: 60, critical: 80 })}`}>
            {metrics.cpuUsage}%
          </div>
          <div className="text-sm text-gray-600">CPU</div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div
              className={`h-2 rounded-full ${metrics.cpuUsage >= 80 ? 'bg-red-500' : metrics.cpuUsage >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${metrics.cpuUsage}%` }}
            ></div>
          </div>
        </div>

        {/* Active Users */}
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">{metrics.activeUsers.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Active Users</div>
          <div className="text-xs text-green-600 mt-1">+12% from yesterday</div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Requests (24h)</span>
          <span className="font-semibold text-gray-900">{metrics.totalRequests.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Error Rate</span>
          <span className={`font-semibold ${getUsageColor(metrics.errorRate * 100, { warning: 2, critical: 5 })}`}>
            {(metrics.errorRate * 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default SystemHealthWidget;
