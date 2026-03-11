import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { multiRoleService, UserCapabilities } from '../api/multiRoleService';
import { FaUserTie, FaChalkboardTeacher, FaUsers, FaBuilding, FaCog } from 'react-icons/fa';

interface RoleSwitcherProps {
  className?: string;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ className = '' }) => {
  const { currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<UserCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadUserCapabilities();
    }
  }, [currentUser]);

  const loadUserCapabilities = async () => {
    try {
      const caps = await multiRoleService.getUserRoles();
      setCapabilities(caps);
    } catch (error) {
      console.error('Failed to load user capabilities:', error);
    }
  };

  const switchRole = async (role: string) => {
    if (isLoading || role === capabilities?.current_role) return;
    
    setIsLoading(true);
    try {
      const result = await multiRoleService.switchRole(role);
      
      // Update auth context
      updateUser(result.user as any);
      setCapabilities(result.capabilities);
      
      // Navigate to appropriate dashboard
      const dashboardRoute = multiRoleService.getDashboardRoute(role);
      navigate(dashboardRoute);
      
      setShowDropdown(false);
    } catch (error) {
      console.error('Failed to switch role:', error);
      alert('Failed to switch role. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    const icons: { [key: string]: React.ReactElement } = {
      'instructor': React.createElement('span', { className: 'w-4 h-4' }, '👨‍🏫'),
      'coordinator': React.createElement('span', { className: 'w-4 h-4' }, '👥'),
      'hod': React.createElement('span', { className: 'w-4 h-4' }, '🏢'),
      'admin': React.createElement('span', { className: 'w-4 h-4' }, '⚙️'),
      'principal': React.createElement('span', { className: 'w-4 h-4' }, '👔')
    };
    return icons[role] || React.createElement('span', { className: 'w-4 h-4' }, '👤');
  };

  if (!capabilities || !capabilities.available_roles || capabilities.available_roles.length <= 1) {
    return null;
  }

  // Only show roles that user can actually switch to (exclude current role)
  const switchableRoles = capabilities.available_roles.filter(role => role !== capabilities.current_role);
  
  if (switchableRoles.length === 0) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        disabled={isLoading}
      >
        {getRoleIcon(capabilities.current_role)}
        <span className="text-sm font-medium text-gray-700">
          {multiRoleService.getRoleDisplayName(capabilities.current_role)}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            showDropdown ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Switch Role</h3>
            <p className="text-xs text-gray-500 mt-1">Select your active role</p>
          </div>
          
          <div className="py-2">
            {switchableRoles.map((role) => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                disabled={isLoading}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 text-gray-700 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {getRoleIcon(role)}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Switch to {multiRoleService.getRoleDisplayName(role)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-600">
              <div className="font-medium mb-1">Current: {multiRoleService.getRoleDisplayName(capabilities.current_role)}</div>
              <div className="flex flex-wrap gap-1">
                {capabilities.can_teach && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Teach</span>
                )}
                {capabilities.can_coordinate && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Coordinate</span>
                )}
                {capabilities.can_manage_department && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">Manage Dept</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Overlay to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

export default RoleSwitcher;