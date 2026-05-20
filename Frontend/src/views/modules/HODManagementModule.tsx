import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, PlusIcon, XMarkIcon, PencilIcon, UserGroupIcon } from '@heroicons/react/24/outline';

interface DepartmentInfo {
  id: number;
  name: string;
  code?: string;
}

interface HOD {
  id: number;
  user_id?: number;
  username?: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
    username: string;
  };
  first_name?: string;
  last_name?: string;
  email?: string;
  name?: string;
  employee_id: string;
  department: string | DepartmentInfo;
  department_name?: string;
  roles?: string[];
  active_role?: string;
  is_active?: boolean;
  status?: string;
  joining_date?: string;
  retirement_date?: string;
  phone?: string;
  created_at?: string;
  image?: string;
}

interface CreateHODForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  department: string;
  phone: string;
  joining_date: string;
  roles: string[];
  profile_pic?: File | null;
}

interface EditHODForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  roles: string[];
  password?: string;
}

interface Department {
  department_id: number;
  name: string;
  code: string;
  description?: string;
}

interface HODManagementProps {
  token: string;
  onRequestAction?: (requestId: number, action: string) => Promise<void>;
}

const getFullImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/media/')) {
    return `http://localhost:8000${url}`;
  }
  return `http://localhost:8000/media/${url}`;
};

const HODManagementModule: React.FC<HODManagementProps> = ({ token }) => {
  const [hods, setHods] = useState<HOD[]>([]);
  const [retiredHods, setRetiredHods] = useState<HOD[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [editingHod, setEditingHod] = useState<HOD | null>(null);
  const [expandedHod, setExpandedHod] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'retired'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [formMessage, setFormMessage] = useState('');
  const [departmentWarning, setDepartmentWarning] = useState<string>('');

  const [coordinatorExpanded, setCoordinatorExpanded] = useState(false);

  const [editProfilePicFile, setEditProfilePicFile] = useState<File | null>(null);
  const [editProfilePicPreview, setEditProfilePicPreview] = useState<string | null>(null);
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  const [editCoordinatorExpanded, setEditCoordinatorExpanded] = useState(false);

  const [formData, setFormData] = useState<CreateHODForm>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    department: '',
    phone: '',
    joining_date: new Date().toISOString().split('T')[0],
    roles: ['hod'],
    profile_pic: null,
  });

  const [editFormData, setEditFormData] = useState<EditHODForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    roles: ['hod'],
    password: '',
  });

  const [retireDate, setRetireDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchHODs = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/register/admin/hod-records/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHods(data.data || data || []);
      }
    } catch (error) {
      console.error('Error fetching HODs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRetiredHods = async (departmentId?: string) => {
    try {
      let url = 'http://localhost:8000/api/register/admin/retired-hods/';
      if (departmentId) {
        url += `?department_id=${departmentId}`;
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRetiredHods(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching retired HODs:', error);
    }
  };

  const checkDepartmentHOD = async (departmentId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/register/admin/check-department-hod/?department_id=${departmentId}`, {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.has_active_hod) {
          setDepartmentWarning(`Warning: Department already has an active HOD (${data.hod.name}). Creating a new HOD will replace them.`);
        } else {
          setDepartmentWarning('');
        }
      }
    } catch (error) {
      console.error('Error checking department HOD:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/register/admin/hod-departments/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHODs();
      fetchDepartments();
      if (filterStatus === 'retired') {
        fetchRetiredHods(filterDepartment);
      }
    }
  }, [token, filterStatus, filterDepartment]);

  const handleDepartmentChange = (deptId: string) => {
    setFormData({ ...formData, department: deptId });
    if (deptId) {
      checkDepartmentHOD(deptId);
    } else {
      setDepartmentWarning('');
    }
  };

  const handleAddHOD = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('first_name', formData.first_name);
      formDataToSend.append('last_name', formData.last_name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('department', formData.department);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('joining_date', formData.joining_date);
      formDataToSend.append('roles', JSON.stringify(formData.roles));
      
      if (formData.profile_pic) {
        formDataToSend.append('profile_pic', formData.profile_pic);
      }

      const response = await fetch('http://localhost:8000/api/register/admin/create-hod/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const payload = await response.json();
        const createdEmployeeId = payload?.employee_id;
        setFormMessage(`✓ HOD created successfully!${createdEmployeeId ? ` Employee ID: ${createdEmployeeId}` : ''}`);
        setTimeout(() => {
          setShowAddForm(false);
          setFormData({
            first_name: '',
            last_name: '',
            email: '',
            password: '',
            department: '',
            phone: '',
            joining_date: new Date().toISOString().split('T')[0],
            roles: ['hod'],
            profile_pic: null,
          });
          setFormMessage('');
          setDepartmentWarning('');
          fetchHODs();
        }, 1500);
      } else {
        const error = await response.json();
        setFormMessage(`✗ Error: ${error.error || 'Failed to create HOD'}`);
      }
    } catch (error) {
      console.error('Error creating HOD:', error);
      setFormMessage('✗ Failed to create HOD');
    }
  };

  const handleEditClick = (hod: HOD) => {
    const fallbackFullName = (hod.name || '').trim();
    const fallbackNameParts = fallbackFullName ? fallbackFullName.split(/\s+/) : [];
    const fallbackFirstName = fallbackNameParts[0] || '';
    const fallbackLastName = fallbackNameParts.length > 1 ? fallbackNameParts.slice(1).join(' ') : '';

    setEditingHod(hod);
    setEditFormData({
      first_name: hod.user?.first_name || hod.first_name || fallbackFirstName,
      last_name: hod.user?.last_name || hod.last_name || fallbackLastName,
      email: hod.user?.email || hod.email || '',
      phone: hod.phone || '',
      department: typeof hod.department === 'object' ? String(hod.department.id) : hod.department,
      roles: hod.roles || ['hod'],
      password: '',
    });
    setEditProfilePicFile(null);
    setEditProfilePicPreview(null);
    setEditPassword('');
    setEditShowPassword(false);
    setShowEditForm(true);
    setExpandedHod(null);
    setEditCoordinatorExpanded((hod.roles || []).includes('coordinator'));
  };

  const handleEditProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setEditProfilePicFile(file);
    setEditProfilePicPreview(URL.createObjectURL(file));
  };

  const handleSaveEdit = async () => {
    if (!editingHod) return;
    setFormMessage('');

    try {
      if (editProfilePicFile || editPassword) {
        const formDataToSend = new FormData();
        formDataToSend.append('first_name', editFormData.first_name);
        formDataToSend.append('last_name', editFormData.last_name);
        formDataToSend.append('email', editFormData.email);
        formDataToSend.append('phone', editFormData.phone);
        formDataToSend.append('department', editFormData.department);
        formDataToSend.append('roles', JSON.stringify(editFormData.roles));
        
        if (editPassword) {
          formDataToSend.append('password', editPassword);
        }
        
        if (editProfilePicFile) {
          formDataToSend.append('profile_pic', editProfilePicFile);
        }

        const response = await fetch(`http://localhost:8000/api/register/admin/hod/${editingHod.id}/edit/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${token}`,
          },
          body: formDataToSend,
        });

        if (response.ok) {
          setFormMessage('✓ HOD updated successfully!');
          setTimeout(() => {
            setShowEditForm(false);
            setEditingHod(null);
            setFormMessage('');
            setEditPassword('');
            setEditProfilePicFile(null);
            setEditProfilePicPreview(null);
            fetchHODs();
          }, 1500);
        } else {
          const error = await response.json();
          setFormMessage(`✗ Error: ${error.error || 'Failed to update HOD'}`);
        }
      } else {
        const response = await fetch(`http://localhost:8000/api/register/admin/hod/${editingHod.id}/edit/`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editFormData),
        });

        if (response.ok) {
          setFormMessage('✓ HOD updated successfully!');
          setTimeout(() => {
            setShowEditForm(false);
            setEditingHod(null);
            setFormMessage('');
            fetchHODs();
          }, 1500);
        } else {
          const error = await response.json();
          setFormMessage(`✗ Error: ${error.error || 'Failed to update HOD'}`);
        }
      }
    } catch (error) {
      console.error('Error updating HOD:', error);
      setFormMessage('✗ Failed to update HOD');
    }
  };

  const handleRetireClick = (hod: HOD) => {
    setEditingHod(hod);
    setShowRetireModal(true);
    setExpandedHod(null);
  };

  const handleConfirmRetire = async () => {
    if (!editingHod) return;
    setFormMessage('');

    try {
      const response = await fetch(`http://localhost:8000/api/register/admin/hod/${editingHod.id}/retire/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ retirement_date: retireDate }),
      });

      if (response.ok) {
        setFormMessage('✓ HOD retired successfully!');
        setTimeout(() => {
          setShowRetireModal(false);
          setEditingHod(null);
          setFormMessage('');
          fetchHODs();
          fetchRetiredHods(filterDepartment);
        }, 1500);
      } else {
        const error = await response.json();
        setFormMessage(`✗ Error: ${error.error || 'Failed to retire HOD'}`);
      }
    } catch (error) {
      console.error('Error retiring HOD:', error);
      setFormMessage('✗ Failed to retire HOD');
    }
  };

  const handleReactivateClick = async (hod: HOD) => {
    setFormMessage('');

    try {
      const response = await fetch(`http://localhost:8000/api/register/admin/hod/${hod.id}/reactivate/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setFormMessage('✓ HOD reactivated successfully!');
        setTimeout(() => {
          setFormMessage('');
          fetchHODs();
          fetchRetiredHods(filterDepartment);
        }, 1500);
      } else {
        const error = await response.json();
        setFormMessage(`✗ Error: ${error.error || 'Failed to reactivate HOD'}`);
      }
    } catch (error) {
      console.error('Error reactivating HOD:', error);
      setFormMessage('✗ Failed to reactivate HOD');
    }
  };

  // Handle role toggle - instructor can be assigned independently (with or without coordinator)
  const handleToggleRole = (role: string, isEdit: boolean = false) => {
    if (isEdit) {
      let newRoles = editFormData.roles.includes(role)
        ? editFormData.roles.filter(r => r !== role)
        : [...editFormData.roles, role];
      
      if (!newRoles.includes('hod')) {
        newRoles.push('hod');
      }
      
      setEditFormData({ ...editFormData, roles: newRoles });
      setEditCoordinatorExpanded(newRoles.includes('coordinator'));
    } else {
      let newRoles = formData.roles.includes(role)
        ? formData.roles.filter(r => r !== role)
        : [...formData.roles, role];
      
      if (!newRoles.includes('hod')) {
        newRoles.push('hod');
      }
      
      setFormData({ ...formData, roles: newRoles });
      setCoordinatorExpanded(newRoles.includes('coordinator'));
    }
  };
  
  // Instructor can always be toggled - no dependency on coordinator
  const canToggleInstructor = (isEdit: boolean = false) => {
    return true;
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      hod: 'bg-purple-100 text-purple-800 border border-purple-300',
      coordinator: 'bg-blue-100 text-blue-800 border border-blue-300',
      instructor: 'bg-green-100 text-green-800 border border-green-300',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: { [key: string]: string } = {
      hod: 'Head of Department',
      coordinator: 'Coordinator',
      instructor: 'Instructor',
    };
    return labels[role] || role;
  };

  const getHodName = (hod: HOD) => {
    if (hod.user) {
      return `${hod.user.first_name} ${hod.user.last_name}`;
    }
    return `${hod.first_name || ''} ${hod.last_name || ''}`.trim() || hod.name || 'Unknown';
  };

  const getHodUsername = (hod: HOD) => {
    return hod.username || hod.user?.username || 'N/A';
  };

  const getHodEmail = (hod: HOD) => {
    return hod.user?.email || hod.email || 'N/A';
  };

  const getHodDept = (hod: HOD) => {
    if (typeof hod.department === 'object' && hod.department !== null) {
      const deptInfo = hod.department as DepartmentInfo;
      return deptInfo.name || deptInfo.code || 'N/A';
    }
    return hod.department || hod.department_name || 'N/A';
  };

  const isHodActive = (hod: HOD) => {
    return hod.is_active !== false && !hod.retirement_date && hod.status !== 'retired';
  };

  const HODAvatar: React.FC<{ hod: HOD; size?: 'small' | 'large' }> = ({ hod, size = 'small' }) => {
    const [imageError, setImageError] = useState(false);
    const sizeClass = size === 'large' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
    const imageSizeClass = size === 'large' ? 'w-14 h-14' : 'w-10 h-10';
    
    const name = getHodName(hod);
    
    if (hod.image && !imageError) {
      return (
        <img 
          src={getFullImageUrl(hod.image)} 
          alt={name} 
          className={`${imageSizeClass} rounded-full object-cover`}
          onError={() => setImageError(true)}
        />
      );
    }
    
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold`}>
        {name.charAt(0)}
      </div>
    );
  };

  const filteredHods = hods.filter(hod => {
    if (filterStatus !== 'all') {
      const isActive = isHodActive(hod);
      if (filterStatus === 'active' && !isActive) return false;
      if (filterStatus === 'retired' && isActive) return false;
    }
    return true;
  });

  const displayHods = filterStatus === 'retired' ? retiredHods : filteredHods;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">HOD Management</h2>
          <p className="text-gray-600 mt-1">Manage Heads of Department with multi-role support</p>
        </div>
        {filterStatus !== 'retired' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            <PlusIcon className="w-5 h-5" />
            Add HOD
          </motion.button>
        )}
      </div>

      {formMessage && (
        <div className={`p-3 rounded-lg ${formMessage.includes('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {formMessage}
        </div>
      )}

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900">Create New HOD</h3>
              <button
                onClick={() => { setShowAddForm(false); setDepartmentWarning(''); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {departmentWarning && (
              <div className="p-3 rounded-lg bg-yellow-100 text-yellow-800 mb-4">
                {departmentWarning}
              </div>
            )}

            <form onSubmit={handleAddHOD} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="First Name"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  required
                  value={formData.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="date"
                  required
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, profile_pic: e.target.files?.[0] || null })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                <p className="font-semibold mb-3 text-gray-900">Select Roles (HOD is mandatory)</p>
                <div className="flex flex-wrap gap-4">
                  {['hod', 'coordinator', 'instructor'].map(role => (
                    <label key={role} className="flex items-center gap-3 cursor-pointer px-4 py-2 bg-white rounded-lg border border-gray-300 hover:border-purple-400 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.roles.includes(role)}
                        onChange={() => handleToggleRole(role)}
                        disabled={role === 'hod'}
                        className="w-4 h-4 rounded text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">{getRoleLabel(role)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setDepartmentWarning(''); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Create HOD
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditForm && editingHod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Edit HOD Profile</h3>
                <button onClick={() => setShowEditForm(false)} className="p-1 hover:bg-gray-100 rounded">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Profile Picture</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                      {editProfilePicPreview ? (
                        <img src={editProfilePicPreview} alt="preview" className="w-20 h-20 object-cover" />
                      ) : editingHod.image ? (
                        <img src={getFullImageUrl(editingHod.image)} alt="current" className="w-20 h-20 object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-white">
                          {getHodName(editingHod).charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <span>Change Photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleEditProfilePicChange} 
                          className="hidden" 
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-1">Upload JPG, PNG or GIF</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Personal Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      required
                      value={editFormData.first_name}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      required
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      required
                      value={editFormData.department}
                      onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.department_id} value={dept.department_id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Change Password (Optional)</h4>
                  <div className="relative">
                    <input
                      type={editShowPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Enter new password to change"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setEditShowPassword(!editShowPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm"
                    >
                      {editShowPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Leave empty to keep current password</p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                  <p className="font-semibold mb-3 text-gray-900">Manage Roles</p>
                  <div className="flex flex-wrap gap-4">
                    {['hod', 'coordinator', 'instructor'].map(role => (
                      <label key={role} className="flex items-center gap-3 cursor-pointer px-4 py-2 bg-white rounded-lg border border-gray-300 hover:border-purple-400 transition-colors">
                        <input
                          type="checkbox"
                          checked={editFormData.roles.includes(role)}
                          onChange={() => handleToggleRole(role, true)}
                          disabled={role === 'hod'}
                          className="w-4 h-4 rounded text-purple-600"
                        />
                        <span className="text-sm font-medium text-gray-700">{getRoleLabel(role)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => setShowEditForm(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRetireModal && editingHod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Retire HOD</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to retire <strong>{getHodName(editingHod)}</strong> from {getHodDept(editingHod)}?
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Retirement Date</label>
                <input
                  type="date"
                  required
                  value={retireDate}
                  onChange={(e) => setRetireDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowRetireModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRetire}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Confirm Retirement
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {['all', 'active', 'retired'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterStatus === status
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {filterStatus === 'retired' && (
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading HODs...</p>
          </div>
        ) : displayHods.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <p className="text-gray-600 mt-2">
              {filterStatus === 'retired' ? 'No retired HODs found' : 'No HODs found'}
            </p>
          </div>
        ) : (
          displayHods.map(hod => (
            <motion.div
              key={hod.id}
              layout
              className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
            >
              <button
                onClick={() => setExpandedHod(expandedHod === hod.id ? null : hod.id)}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                    <HODAvatar hod={hod} size="large" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900">{getHodName(hod)}</h3>
                    <p className="text-sm text-gray-600">{getHodDept(hod)}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {hod.roles && hod.roles.map(role => (
                      <span key={role} className={`text-xs font-bold px-3 py-1 rounded-full ${getRoleColor(role)}`}>
                        {getRoleLabel(role)}
                      </span>
                    ))}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                    isHodActive(hod) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isHodActive(hod) ? 'ACTIVE' : 'RETIRED'}
                  </span>
                </div>
                <ChevronDownIcon className={`w-6 h-6 text-gray-600 transition-transform ${expandedHod === hod.id ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {expandedHod === hod.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-200 bg-gray-50 p-6"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">USERNAME</p>
                          <p className="font-bold text-lg text-gray-900 mt-1">@{getHodUsername(hod)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">EMPLOYEE ID</p>
                          <p className="font-bold text-lg text-gray-900 mt-1">{hod.employee_id}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">PHONE</p>
                          <p className="font-bold text-lg text-gray-900 mt-1">{hod.phone || '—'}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">EMAIL</p>
                          <p className="font-bold text-blue-600 truncate mt-1">{getHodEmail(hod)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">
                            {isHodActive(hod) ? 'JOINING DATE' : 'RETIREMENT DATE'}
                          </p>
                          <p className="font-bold text-gray-900 mt-1">
                            {isHodActive(hod) && hod.joining_date
                              ? new Date(hod.joining_date).toLocaleDateString()
                              : hod.retirement_date
                              ? new Date(hod.retirement_date).toLocaleDateString()
                              : '—'}
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">DEPARTMENT</p>
                          <p className="font-bold text-gray-900 mt-1">{getHodDept(hod)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">CURRENT ROLE</p>
                          <p className="font-bold text-purple-600 mt-1">{hod.active_role || 'hod'}</p>
                        </div>
                      </div>

                      {filterStatus !== 'retired' && (
                        <div className="flex gap-3 pt-4">
                          <button 
                            onClick={() => handleEditClick(hod)}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
                          >
                            <PencilIcon className="w-5 h-5" />
                            Edit HOD Profile
                          </button>
                          <button 
                            onClick={() => isHodActive(hod) ? handleRetireClick(hod) : handleReactivateClick(hod)}
                            className={`flex-1 px-4 py-3 rounded-lg transition-colors font-semibold ${
                              isHodActive(hod) 
                                ? 'bg-red-600 text-white hover:bg-red-700' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {isHodActive(hod) ? 'Retire' : 'Reactivate'}
                          </button>
                        </div>
                      )}

                      {filterStatus === 'retired' && (
                        <div className="flex gap-3 pt-4">
                          <button 
                            onClick={() => handleReactivateClick(hod)}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                          >
                            Reactivate HOD
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default HODManagementModule;
