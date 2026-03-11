import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService, AdminRecord, CreateAdminRequest } from '../../api/adminService';

interface AdminManagementProps {
  activeTab: string;
}

const AdminManagement: React.FC<AdminManagementProps> = ({ activeTab }) => {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employee_id: '',
    phone: '',
    role: 'admin' as 'super_admin' | 'admin' | 'department_admin',
    department_id: '',
    permissions: [] as string[],
    status: 'active' as 'active' | 'inactive',
    password: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [pendingAdmins, setPendingAdmins] = useState<AdminRecord[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const roleOptions = [
    { value: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-800' },
    { value: 'admin', label: 'Admin', color: 'bg-blue-100 text-blue-800' },
    { value: 'department_admin', label: 'Department Admin', color: 'bg-green-100 text-green-800' }
  ];

  const permissionOptions = [
    'user_management', 'department_management', 'course_management', 
    'results_management', 'attendance_management', 'reports_access',
    'system_settings', 'audit_logs'
  ];

  useEffect(() => {
    if (activeTab === 'admin-management') {
      // Force clear any cached state
      setAdmins([]);
      
      console.log('Current role:', getCurrentAdminRole());
      console.log('Auth data:', JSON.parse(localStorage.getItem('auth') || '{}'));
      
      loadAdmins();
      loadDepartments();
      if (getCurrentAdminRole() === 'super_admin') {
        loadPendingAdmins();
      }
    }
  }, [activeTab]);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getAllAdmins();
      setAdmins(response.data || response);
    } catch (error: any) {
      console.error('Error loading admins:', error);
      alert(`Failed to load admin data: ${error.response?.data?.message || error.message}`);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/academics/departments/', {
        headers: {
          'Authorization': `Token ${JSON.parse(localStorage.getItem('auth') || '{}').access_token || JSON.parse(localStorage.getItem('auth') || '{}').token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setDepartments(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartments([]);
    }
  }, []);

  const loadPendingAdmins = useCallback(async () => {
    console.log('Loading pending admins...');
    try {
      console.log('Making API call to /admin/pending-registrations/');
      const response = await adminService.getPendingRegistrations();
      console.log('Pending admins response:', response);
      setPendingAdmins(response.data || response);
    } catch (error: any) {
      console.error('Error loading pending admins:', error);
      console.error('Error details:', error.response?.data);
      setPendingAdmins([]);
    }
  }, []);

  const handleApproveAdmin = async (adminId: number, adminName: string) => {
    if (window.confirm(`Approve admin account for "${adminName}"?\n\nThis will activate their account and allow them to login.`)) {
      try {
        await adminService.approveAdminRegistration(adminId);
        alert(`✅ Admin account for "${adminName}" has been approved and activated!`);
        await loadPendingAdmins();
        await loadAdmins();
      } catch (error: any) {
        console.error('Error approving admin:', error);
        alert(`Error approving admin: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const getCurrentAdminId = () => {
    const authData = localStorage.getItem('auth');
    return authData ? JSON.parse(authData).user?.id : null;
  };

  const getCurrentAdminRole = () => {
    const authData = localStorage.getItem('auth');
    if (!authData) {
      console.log('No auth data found');
      return 'admin';
    }
    
    try {
      const parsed = JSON.parse(authData);
      const user = parsed.user;
      
      console.log('Auth user data:', {
        id: user?.id,
        username: user?.username,
        role: user?.role,
        is_superuser: user?.is_superuser,
        is_staff: user?.is_staff
      });
      
      // Check if user is superuser first
      if (user?.is_superuser === true) {
        console.log('User identified as super_admin via is_superuser');
        return 'super_admin';
      }
      
      // Check if username is superadmin
      if (user?.username === 'superadmin') {
        console.log('User identified as super_admin via username');
        return 'super_admin';
      }
      
      console.log('User role:', user?.role || 'admin');
      return user?.role || 'admin';
    } catch (e) {
      console.error('Error parsing auth data:', e);
      return 'admin';
    }
  };

  const isSuperAdmin = () => {
    return getCurrentAdminRole() === 'super_admin';
  };

  const canEditAdmin = (targetAdmin: AdminRecord) => {
    const currentRole = getCurrentAdminRole();
    const currentId = getCurrentAdminId();
    
    console.log('canEditAdmin check:', {
      currentRole,
      currentId,
      targetAdminId: targetAdmin.id,
      targetAdminRole: targetAdmin.role
    });
    
    // Super admin can edit anyone except themselves for role changes
    if (currentRole === 'super_admin') {
      console.log('Super admin can edit');
      return true;
    }
    
    // Regular admins can only edit lower-level admins
    if (currentRole === 'admin') {
      return targetAdmin.role === 'department_admin';
    }
    
    // Department admins can only edit themselves
    if (currentRole === 'department_admin') {
      return targetAdmin.id === currentId;
    }
    
    return false;
  };

  const canDeleteAdmin = (targetAdmin: AdminRecord) => {
    const currentRole = getCurrentAdminRole();
    const currentId = getCurrentAdminId();
    
    // Cannot delete self
    if (targetAdmin.id === currentId) return false;
    
    // Only super admin can delete other admins
    if (currentRole === 'super_admin') {
      // Cannot delete another super admin
      return targetAdmin.role !== 'super_admin';
    }
    
    return false;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Maximum size is 5MB.');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only JPEG, PNG, and GIF are allowed.');
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const adminData = {
        ...formData,
        department_id: formData.department_id ? parseInt(formData.department_id) : undefined
      };

      if (editingAdmin) {
        // Check if critical changes are being made
        const isCriticalChange = adminData.password || 
                                adminData.role !== editingAdmin.role || 
                                JSON.stringify(adminData.permissions) !== JSON.stringify(editingAdmin.permissions) ||
                                adminData.status !== editingAdmin.status;
        
        // Check permissions before making changes
        if (!canEditAdmin(editingAdmin)) {
          alert('❌ ACCESS DENIED\n\nYou do not have permission to edit this admin account.\n\nOnly higher-level admins can modify lower-level accounts.');
          return;
        }
        
        // Role and password change restrictions
        const currentRole = getCurrentAdminRole();
        const currentId = getCurrentAdminId();
        const isEditingSelf = editingAdmin.id === currentId;
        
        // Role change restrictions
        if (adminData.role && adminData.role !== editingAdmin.role) {
          if (currentRole !== 'super_admin') {
            alert('❌ ROLE CHANGE DENIED\n\nOnly Super Admin can change user roles.');
            return;
          }
          
          if (isEditingSelf) {
            alert('❌ SELF-ROLE CHANGE BLOCKED\n\nSuper Admin cannot change their own role.');
            return;
          }
          
          // Prevent multiple super admins
          if (adminData.role === 'super_admin') {
            const superAdminExists = admins.some(admin => admin.role === 'super_admin' && admin.id !== editingAdmin.id);
            if (superAdminExists) {
              alert('❌ MULTIPLE SUPER ADMINS BLOCKED\n\nOnly one Super Admin is allowed in the system.');
              return;
            }
          }
        }
        
        // Password change restrictions
        if (adminData.password && editingAdmin.id !== currentId && currentRole !== 'super_admin') {
          alert('❌ PASSWORD CHANGE DENIED\n\nYou can only change your own password.');
          return;
        }
        
        if (isCriticalChange && editingAdmin.id !== getCurrentAdminId()) {
          const confirmed = window.confirm(
            `⚠️ SECURITY WARNING\n\n` +
            `You are about to make critical changes to ${editingAdmin.name}'s account:\n` +
            `${adminData.password ? '• Password will be changed\n' : ''}` +
            `${adminData.role !== editingAdmin.role ? `• Role will change from ${editingAdmin.role} to ${adminData.role}\n` : ''}` +
            `${adminData.status !== editingAdmin.status ? `• Status will change to ${adminData.status}\n` : ''}` +
            `\nThis will immediately log them out of all sessions.\n\n` +
            `Continue with these changes?`
          );
          
          if (!confirmed) {
            return;
          }
        }
        
        console.log('Updating admin with data:', adminData);
        await adminService.updateAdmin(editingAdmin.id, adminData);
        
        // Upload image if selected
        if (selectedImage) {
          try {
            const imageResponse = await adminService.uploadAdminImage(editingAdmin.id, selectedImage);
            console.log('Image uploaded successfully:', imageResponse);
          } catch (error: any) {
            console.error('Error uploading image:', error);
            alert(`Failed to upload image: ${error.response?.data?.error || error.message}`);
          }
        }
        
        // Immediately update local state
        setAdmins(prev => prev.map(admin => 
          admin.id === editingAdmin.id 
            ? { ...admin, ...adminData }
            : admin
        ));
        
        const authData = localStorage.getItem('auth');
        const user = authData ? JSON.parse(authData).user : null;
        const isSuperUser = user?.is_superuser;
        
        if (isCriticalChange && editingAdmin.id !== getCurrentAdminId()) {
          alert(`✅ SUPER ADMIN ACTION COMPLETED\n\nChanges applied to ${editingAdmin.name}:\n${adminData.password ? '• Password changed\n' : ''}${adminData.role !== editingAdmin.role ? `• Role changed to ${adminData.role}\n` : ''}${adminData.status !== editingAdmin.status ? `• Status changed to ${adminData.status}\n` : ''}\nUser has been logged out of all sessions.`);
        } else {
          alert(`✅ ${isSuperUser ? 'SUPER ADMIN: ' : ''}Admin updated successfully!`);
        }
        
        // Force refresh from server after a short delay
        setTimeout(async () => {
          await loadAdmins();
          console.log('Admin list refreshed from server');
        }, 500);
      } else {
        // New admin registration - force lowest role and inactive status
        const newAdminData = {
          ...adminData,
          role: 'department_admin', // Always start with lowest role
          status: 'inactive', // Requires approval
          permissions: ['department_management'] // Basic permissions only
        };
        
        const createdAdmin = await adminService.createAdmin(newAdminData as CreateAdminRequest);
        
        // Upload image if selected
        if (selectedImage && createdAdmin.id) {
          try {
            const imageResponse = await adminService.uploadAdminImage(createdAdmin.id, selectedImage);
            console.log('Image uploaded successfully:', imageResponse);
          } catch (error: any) {
            console.error('Error uploading image:', error);
            alert(`Failed to upload image: ${error.response?.data?.error || error.message}`);
          }
        }
        
        alert('⚠️ Admin account created successfully!\n\nAccount Status: INACTIVE\nRole: Department Admin\n\nA Super Admin must activate this account before login is possible.');
        await loadAdmins();
      }

      await loadAdmins();
      resetForm();
    } catch (error: any) {
      console.error('Error saving admin:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error occurred';
      alert(`Error saving admin: ${errorMessage}`);
    }
  };

  const handleEdit = (admin: AdminRecord) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name,
      email: admin.email,
      employee_id: admin.employee_id,
      phone: admin.phone || '',
      role: admin.role,
      department_id: admin.department_id?.toString() || '',
      permissions: admin.permissions,
      status: admin.status,
      password: ''
    });
    setSelectedImage(null);
    setImagePreview(admin.image || '');
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete admin "${name}"?`)) {
      try {
        console.log('Deleting admin with ID:', id);
        await adminService.deleteAdmin(id);
        console.log('Delete successful, refreshing list...');
        await loadAdmins();
        setAdmins(prev => prev.filter(admin => admin.id !== id));
        alert('Admin deleted successfully!');
      } catch (error: any) {
        console.error('Error deleting admin:', error);
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error occurred';
        alert(`Error deleting admin: ${errorMessage}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      employee_id: '',
      phone: '',
      role: 'department_admin', // Default to lowest role
      department_id: '',
      permissions: [],
      status: 'inactive', // Default to inactive for approval
      password: ''
    });
    setSelectedImage(null);
    setImagePreview('');
    setEditingAdmin(null);
    setShowModal(false);
  };

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !selectedRole || admin.role === selectedRole;
    const matchesStatus = !selectedStatus || admin.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleColor = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen w-full bg-[#E8EFF8] p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Admin Management</h2>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                loadPendingAdmins();
                setShowPendingModal(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors relative flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Pending ({pendingAdmins.length})</span>
              {pendingAdmins.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingAdmins.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/>
              </svg>
              <span>Add Admin</span>
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Roles</option>
            {roleOptions.map(role => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Admins</p>
              <p className="text-3xl font-bold text-blue-900">{admins.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Active Admins</p>
              <p className="text-3xl font-bold text-green-900">{admins.filter(a => a.status === 'active').length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">Super Admins</p>
              <p className="text-3xl font-bold text-purple-900">{admins.filter(a => a.role === 'super_admin').length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-lg border border-amber-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-1">Dept Admins</p>
              <p className="text-3xl font-bold text-amber-900">{admins.filter(a => a.role === 'department_admin').length}</p>
            </div>
            <div className="p-3 bg-amber-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{filteredAdmins.length} Admins</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading admins...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {admin.image ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={admin.image} alt={admin.name} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">{admin.name.charAt(0)}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                          <div className="text-sm text-gray-500">{admin.email}</div>
                          <div className="text-xs text-gray-400">{admin.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(admin.role)}`}>
                        {roleOptions.find(r => r.value === admin.role)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {admin.department?.name || 'All Departments'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        admin.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {canEditAdmin(admin) ? (
                          <button
                            onClick={() => handleEdit(admin)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors duration-200 border border-blue-200"
                            title="Edit admin details"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg border border-gray-200 cursor-not-allowed" title="Insufficient permissions">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Edit
                          </span>
                        )}
                        {canDeleteAdmin(admin) ? (
                          <button
                            onClick={() => handleDelete(admin.id, admin.name)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200 border border-red-200"
                            title="Remove admin access"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg border border-gray-200 cursor-not-allowed" title="Insufficient permissions">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Remove
                          </span>
                        )}
                        <button
                          className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                          title="View admin profile"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Approvals Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Pending Admin Approvals ({pendingAdmins.length})
                  </h3>
                  <button onClick={() => setShowPendingModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {pendingAdmins.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No pending admin approvals</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAdmins.map((admin) => (
                      <div key={admin.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0 h-12 w-12">
                              {admin.image ? (
                                <img className="h-12 w-12 rounded-full object-cover" src={admin.image} alt={admin.name} />
                              ) : (
                                <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-gray-600 font-medium">{admin.name.charAt(0)}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">{admin.name}</h4>
                              <p className="text-sm text-gray-500">{admin.email}</p>
                              <p className="text-xs text-gray-400">Employee ID: {admin.employee_id}</p>
                              <p className="text-xs text-gray-400">Requested: {new Date(admin.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveAdmin(admin.id, admin.name)}
                              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDelete(admin.id, admin.name)}
                              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Admin Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
                  </h3>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Profile Image Upload */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                        {imagePreview ? (
                          <img 
                            src={imagePreview} 
                            alt="Preview"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              console.error('Image load error:', e);
                              setImagePreview('');
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center">
                            <svg className="h-8 w-8 text-gray-400 mb-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-gray-400">No Image</span>
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-indigo-600 rounded-full p-2 cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg">
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      {editingAdmin ? 'Click camera to change image' : 'Click camera to upload image'}
                      <br />
                      <span className="text-xs text-gray-400">Max 5MB • JPG, PNG, GIF</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                      <input
                        type="text"
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={editingAdmin?.id === getCurrentAdminId() || getCurrentAdminRole() !== 'super_admin'}
                      >
                        {roleOptions.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      {getCurrentAdminRole() !== 'super_admin' && (
                        <p className="text-xs text-gray-500 mt-1">
                          ℹ️ Only Super Admin can change roles
                        </p>
                      )}
                      {editingAdmin && editingAdmin.id === getCurrentAdminId() && (
                        <p className="text-xs text-gray-500 mt-1">
                          ℹ️ Cannot change your own role
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                      <select
                        value={formData.department_id}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={formData.role === 'super_admin'}
                      >
                        <option value="">All Departments</option>
                        {Array.isArray(departments) && departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {editingAdmin ? 'New Password (leave blank to keep current)' : 'Password'}
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required={!editingAdmin}
                        placeholder={editingAdmin ? "Enter new password to change" : "Enter secure password"}
                        disabled={!!(editingAdmin && editingAdmin.id !== getCurrentAdminId() && getCurrentAdminRole() !== 'super_admin')}
                      />
                      {editingAdmin && editingAdmin.id !== getCurrentAdminId() && getCurrentAdminRole() !== 'super_admin' && (
                        <p className="text-xs text-gray-500 mt-1">
                          ℹ️ You can only change your own password
                        </p>
                      )}
                      {editingAdmin && editingAdmin.id !== getCurrentAdminId() && getCurrentAdminRole() === 'super_admin' && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ Changing password will log this admin out of all sessions
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                    <div className="grid grid-cols-2 gap-2">
                      {permissionOptions.map(permission => (
                        <label key={permission} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, permissions: [...formData.permissions, permission] });
                              } else {
                                setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== permission) });
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">{permission.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      {editingAdmin ? 'Update Admin' : 'Create Admin'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminManagement;