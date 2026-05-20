import { api } from './api';

export interface UserCapabilities {
  can_teach: boolean;
  can_coordinate: boolean;
  can_manage_department: boolean;
  can_manage_institution: boolean;
  available_roles: string[];
  current_role: string;
}

export interface MultiRoleUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  active_role: string;
  profile_image?: string;
  capabilities: UserCapabilities;
}

class MultiRoleService {
  /**
   * Switch user's active role
   */
  async switchRole(role: string): Promise<{ user: MultiRoleUser; capabilities: UserCapabilities }> {
    try {
      const response = await api.post('/register/switch-role/', { role });
      
      // Update localStorage with new user data
      const authData = JSON.parse(localStorage.getItem('auth') || '{}');
      authData.user = response.data.user;
      localStorage.setItem('auth', JSON.stringify(authData));
      
      return response.data;
    } catch (error) {
      console.error('Error switching role:', error);
      throw error;
    }
  }

  /**
   * Get user's available roles and capabilities
   */
  async getUserRoles(): Promise<UserCapabilities> {
    try {
      const response = await api.get('/register/user-roles/');
      return response.data;
    } catch (error) {
      console.error('Error fetching user roles:', error);
      throw error;
    }
  }

  /**
   * Enable instructor role for HOD/Coordinator
   */
  async enableInstructorRole(): Promise<{ capabilities: UserCapabilities }> {
    try {
      const response = await api.post('/register/enable-instructor-role/');
      return response.data;
    } catch (error) {
      console.error('Error enabling instructor role:', error);
      throw error;
    }
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'student': 'Student',
      'instructor': 'Instructor',
      'coordinator': 'Coordinator',
      'hod': 'Head of Department',
      'admin': 'Administrator',
      'principal': 'Principal',
      'superuser': 'Super User'
    };
    return roleNames[role] || role.charAt(0).toUpperCase() + role.slice(1);
  }

  /**
   * Get role-based dashboard route
   */
  getDashboardRoute(role: string): string {
    const routes: { [key: string]: string } = {
      'student': '/student-dashboard',
      'instructor': '/instructor-dashboard',
      'coordinator': '/coordinator-dashboard',
      'hod': '/hod-dashboard',
      'admin': '/admin-dashboard',
      'principal': '/principal-dashboard'
    };
    return routes[role] || '/dashboard';
  }

  /**
   * Check if user can perform specific action
   */
  canPerformAction(capabilities: UserCapabilities, action: string): boolean {
    const actionMap: { [key: string]: keyof UserCapabilities } = {
      'teach': 'can_teach',
      'coordinate': 'can_coordinate',
      'manage_department': 'can_manage_department',
      'manage_institution': 'can_manage_institution'
    };
    
    const capabilityKey = actionMap[action];
    return capabilityKey ? Boolean(capabilities[capabilityKey]) : false;
  }

  /**
   * Get available actions for current role
   */
  getAvailableActions(capabilities: UserCapabilities): string[] {
    const actions: string[] = [];
    
    if (capabilities.can_teach) actions.push('teach');
    if (capabilities.can_coordinate) actions.push('coordinate');
    if (capabilities.can_manage_department) actions.push('manage_department');
    if (capabilities.can_manage_institution) actions.push('manage_institution');
    
    return actions;
  }

  /**
   * Setup multi-role system (Admin only)
   */
  async setupMultiRoleSystem(): Promise<void> {
    try {
      await api.post('/register/setup-multi-role/');
    } catch (error) {
      console.error('Error setting up multi-role system:', error);
      throw error;
    }
  }
}

export const multiRoleService = new MultiRoleService();