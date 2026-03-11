import React, { useState, useEffect } from 'react';
import { multiRoleService, UserCapabilities } from '../../api/multiRoleService';

const MultiRoleManagement: React.FC = () => {
  const [setupLoading, setSetupLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const setupMultiRoleSystem = async () => {
    setSetupLoading(true);
    try {
      await multiRoleService.setupMultiRoleSystem();
      setMessage({ type: 'success', text: 'Multi-role system setup completed successfully!' });
    } catch (error) {
      console.error('Failed to setup multi-role system:', error);
      setMessage({ type: 'error', text: 'Failed to setup multi-role system' });
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-Role Management</h2>
          <p className="text-gray-600 mt-1">Manage user roles and capabilities</p>
        </div>
        <button
          onClick={setupMultiRoleSystem}
          disabled={setupLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span className={setupLoading ? 'animate-spin' : ''}>⚙️</span>
          {setupLoading ? 'Setting up...' : 'Setup Multi-Role System'}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};

export default MultiRoleManagement;