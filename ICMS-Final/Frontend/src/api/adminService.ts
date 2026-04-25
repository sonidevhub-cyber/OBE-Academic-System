import axios from 'axios';

const API_BASE_URL = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api`;

// Get auth token
const getAuthToken = () => {
  const authData = localStorage.getItem('auth');
  return authData ? JSON.parse(authData).access_token || JSON.parse(authData).token : null;
};

// Create axios instance with auth
const createAuthAxios = () => {
  const token = getAuthToken();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

export interface AdminRecord {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'department_admin';
  permissions: string[];
  department_id?: number;
  department?: { id: number; name: string };
  created_at: string;
  last_login?: string;
  status: 'active' | 'inactive';
  image?: string;
}

export interface CreateAdminRequest {
  name: string;
  email: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'department_admin';
  permissions: string[];
  department_id?: number;
  status: 'active' | 'inactive';
  password: string;
}

export interface UpdateAdminRequest extends Partial<CreateAdminRequest> {
  id: number;
}

export const adminService = {
  // Get all admin records
  getAllAdmins: async () => {
    const api = createAuthAxios();
    const response = await api.get('/admin/admins/');
    return response.data;
  },

  // Get admin by ID
  getAdminById: async (id: number) => {
    const api = createAuthAxios();
    const response = await api.get(`/admin/admins/${id}/`);
    return response.data;
  },

  // Create new admin with security controls
  createAdmin: async (adminData: CreateAdminRequest) => {
    const api = createAuthAxios();

    const response = await api.post('/admin/admins/', adminData);
    return response.data;
  },

  // Update admin
  updateAdmin: async (id: number, adminData: Partial<UpdateAdminRequest>) => {
    const api = createAuthAxios();
    const response = await api.put(`/admin/admins/${id}/`, adminData);
    
    // Session invalidation handled by backend
    
    return response.data;
  },

  // Delete admin (soft delete by deactivating)
  deleteAdmin: async (id: number) => {
    const api = createAuthAxios();
    const response = await api.put(`/admin/admins/${id}/`, { is_active: false });
    return response.data;
  },

  // Update admin status
  updateAdminStatus: async (id: number, status: 'active' | 'inactive') => {
    const api = createAuthAxios();
    const response = await api.patch(`/admin/admins/${id}/status/`, { status });
    return response.data;
  },

  // Update admin permissions
  updateAdminPermissions: async (id: number, permissions: string[]) => {
    const api = createAuthAxios();
    const response = await api.patch(`/admin/admins/${id}/permissions/`, { permissions });
    return response.data;
  },

  // Get admin activity logs
  getAdminActivityLogs: async (adminId?: number) => {
    const api = createAuthAxios();
    const url = adminId ? `/admin/activity-logs/?admin_id=${adminId}` : '/admin/activity-logs/';
    const response = await api.get(url);
    return response.data;
  },

  // Get admin statistics
  getAdminStats: async () => {
    const api = createAuthAxios();
    const response = await api.get('/admin/stats/');
    return response.data;
  },

  // Reset admin password
  resetAdminPassword: async (id: number, newPassword: string) => {
    const api = createAuthAxios();
    const response = await api.post(`/admin/admins/${id}/reset-password/`, { 
      new_password: newPassword 
    });
    return response.data;
  },

  // Upload admin profile image
  uploadAdminImage: async (id: number, imageFile: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('image', imageFile);
    
    console.log(`Uploading image to: ${API_BASE_URL}/admin/admins/${id}/upload_image/`);
    
    const response = await axios.post(`${API_BASE_URL}/admin/admins/${id}/upload_image/`, formData, {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get available permissions
  getAvailablePermissions: async () => {
    const api = createAuthAxios();
    const response = await api.get('/admin/permissions/');
    return response.data;
  },

  // Validate admin credentials
  validateAdminCredentials: async (email: string, password: string) => {
    const api = createAuthAxios();
    const response = await api.post('/admin/validate-credentials/', { 
      email, 
      password 
    });
    return response.data;
  },

  // Security functions
  invalidateAdminSessions: async (adminId: number) => {
    const api = createAuthAxios();
    const response = await api.post(`/admin/admins/${adminId}/invalidate-sessions/`);
    return response.data;
  },

  // Get security audit logs
  getSecurityAuditLogs: async () => {
    const api = createAuthAxios();
    const response = await api.get('/admin/security-audit/');
    return response.data;
  },

  // Force password change on next login
  forcePasswordChange: async (adminId: number) => {
    const api = createAuthAxios();
    const response = await api.post(`/admin/admins/${adminId}/force-password-change/`);
    return response.data;
  },

  // Approve pending admin registration
  approveAdminRegistration: async (adminId: number) => {
    const api = createAuthAxios();
    const response = await api.post(`/admin/admins/${adminId}/approve/`);
    return response.data;
  },

  // Get pending admin registrations (Super Admin only)
  getPendingRegistrations: async () => {
    const api = createAuthAxios();
    const response = await api.get('/admin/pending-registrations/');
    return response.data;
  }
};

// Role hierarchy for permission checking
export const ROLE_HIERARCHY = {
  'super_admin': 3,
  'admin': 2, 
  'department_admin': 1
} as const;

// Permission matrix to prevent admin abuse
export const ADMIN_PERMISSIONS = {
  'super_admin': {
    can_edit_any_admin: true,
    can_delete_any_admin: true,
    can_change_roles: true,
    can_access_audit_logs: true,
    can_emergency_lockdown: true
  },
  'admin': {
    can_edit_lower_admins: true,
    can_delete_lower_admins: false,
    can_change_roles_lower: true,
    can_access_audit_logs: false,
    can_emergency_lockdown: false
  },
  'department_admin': {
    can_edit_self_only: true,
    can_delete_none: false,
    can_change_roles: false,
    can_access_audit_logs: false,
    can_emergency_lockdown: false
  }
} as const;

export default adminService;
