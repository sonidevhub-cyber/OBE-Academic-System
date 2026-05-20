import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Role {
  role: string;
  name: string;
  is_primary: boolean;
}

const UniversalRoleSwitcher: React.FC = () => {
  const { currentUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadAvailableRoles();
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      const response = await fetch('http://127.0.0.1:8000/api/register/available-roles/', {
        headers: { 'Authorization': `Token ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.available_roles || []);
      }
    } catch (error) {
      console.error('Error loading available roles:', error);
    }
  };

  const handleRoleSwitch = async (targetRole: string) => {
    if (!currentUser || targetRole === (currentUser.effective_role || currentUser.active_role || currentUser.role)) return;
    
    setLoading(true);
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      const response = await fetch('http://127.0.0.1:8000/api/register/switch-active-role/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: targetRole })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update user in context
        const updatedUser = {
          ...currentUser,
          role: data.role || targetRole,
          active_role: data.active_role || targetRole,
          effective_role: data.current_role || targetRole,
          roles: data.roles || currentUser.roles
        };
        updateUser(updatedUser);
        
        // Navigate to appropriate dashboard
        navigateToRoleDashboard(targetRole);
        setIsOpen(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to switch role'}`);
      }
    } catch (error) {
      console.error('Error switching role:', error);
      alert('Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  const navigateToRoleDashboard = (role: string) => {
    switch (role) {
      case 'hod':
        navigate('/hod');
        break;
      case 'coordinator':
        navigate('/coordinator');
        break;
      case 'instructor':
        navigate('/teacher');
        break;
      case 'admin':
        navigate('/admin');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const getCurrentRoleName = () => {
    const currentRole = currentUser?.effective_role || currentUser?.active_role || currentUser?.role;
    const role = availableRoles.find(r => r.role === currentRole);
    return role?.name || currentRole?.toUpperCase() || 'User';
  };

  if (!currentUser || availableRoles.length <= 1) {
    return null; // Don't show if user has only one role
  }

  // Only show if user actually has multiple role permissions
  const hasMultipleRoles = availableRoles.some(role => 
    role.role !== (currentUser.effective_role || currentUser.active_role || currentUser.role)
  );
  
  if (!hasMultipleRoles) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200 text-white border border-white border-opacity-30"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-sm font-medium">{getCurrentRoleName()}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">Switch Role</h3>
            <p className="text-xs text-gray-600">Select a role to switch to</p>
          </div>
          <div className="py-2">
            {availableRoles.map((role) => {
              const isCurrent = role.role === (currentUser.effective_role || currentUser.active_role || currentUser.role);
              return (
                <button
                  key={role.role}
                  onClick={() => handleRoleSwitch(role.role)}
                  disabled={loading || isCurrent}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    isCurrent ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      role.is_primary ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <div className="text-sm font-medium">{role.name}</div>
                      <div className="text-xs text-gray-500">
                        {role.is_primary ? 'Primary Role' : 'Additional Role'}
                      </div>
                    </div>
                  </div>
                  {isCurrent && (
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default UniversalRoleSwitcher;
