import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { multiRoleService } from '../api/multiRoleService';
import { useAuth } from '../context/AuthContext';

interface RoleSwitchButtonProps {
  targetRole: 'instructor' | 'coordinator' | 'hod';
  currentUserRoles: string[];
  className?: string;
}

const RoleSwitchButton: React.FC<RoleSwitchButtonProps> = ({ 
  targetRole, 
  currentUserRoles, 
  className = '' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { updateUser } = useAuth();
  const navigate = useNavigate();

  // Don't show if user doesn't have the target role
  if (!currentUserRoles.includes(targetRole)) {
    return null;
  }

  const handleRoleSwitch = async () => {
    setIsLoading(true);
    try {
      const result = await multiRoleService.switchRole(targetRole);
      updateUser(result.user as any);
      navigate(multiRoleService.getDashboardRoute(targetRole));
    } catch (error) {
      console.error('Failed to switch role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = () => {
    const labels = {
      'instructor': 'Switch to Instructor',
      'coordinator': 'Switch to Coordinator', 
      'hod': 'Switch to HOD'
    };
    return labels[targetRole];
  };

  return (
    <button
      onClick={handleRoleSwitch}
      disabled={isLoading}
      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors ${className}`}
    >
      {isLoading ? 'Switching...' : getRoleLabel()}
    </button>
  );
};

export default RoleSwitchButton;