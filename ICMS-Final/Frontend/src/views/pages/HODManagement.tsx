import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HOD {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  phone: string;
  designation: string;
  specialization: string;
  experience_years: number;
  department: {
    id: number;
    name: string;
  };
  image?: string;
  created_at: string;
  updated_at?: string;
}

interface Department {
  department_id: number;
  name: string;
  code: string;
}

// Helper function to get full image URL
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

const HODManagement: React.FC = () => {
  const [hods, setHods] = useState<HOD[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHod, setSelectedHod] = useState<HOD | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<HOD>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  
  // Profile picture state for edit modal
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const getToken = () => {
    const authData = localStorage.getItem('auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.access_token || parsed.token;
    }
    return null;
  };
  
  const token = getToken();

  // Fetch HODs
  const fetchHods = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/register/admin/hod-records/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHods(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching HODs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/register/admin/hod-departments/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
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
    fetchHods();
    fetchDepartments();
  }, []);

  // Handle edit HOD
  const handleEdit = (hod: HOD) => {
    setSelectedHod(hod);
    setEditFormData({
      name: hod.name,
      email: hod.email,
      phone: hod.phone,
      designation: hod.designation,
      specialization: hod.specialization,
      experience_years: hod.experience_years,
      department: hod.department
    });
    setProfilePicFile(null);
    setProfilePicPreview(null);
    setPassword('');
    setShowEditModal(true);
  };

  // Handle view HOD details
  const handleView = (hod: HOD) => {
    setSelectedHod(hod);
    setShowViewModal(true);
  };

  // Handle delete HOD
  const handleDelete = (hod: HOD) => {
    setSelectedHod(hod);
    setShowDeleteModal(true);
  };

  // Handle profile picture change
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setProfilePicPreview(URL.createObjectURL(file));
  };

  // Update HOD
  const updateHod = async () => {
    if (!selectedHod) return;

    try {
      let response;
      
      // If a profile picture is provided, send multipart/form-data
      if (profilePicFile) {
        const fd = new FormData();
        Object.entries(editFormData).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            if (typeof v === 'object' && 'name' in v) {
              // Skip department object - just use the ID
            } else {
              fd.append(k, v as any);
            }
          }
        });
        fd.append('profile_pic', profilePicFile);
        if (password) {
          fd.append('password', password);
        }
        
        response = await fetch(`http://localhost:8000/api/register/admin/hod-records/${selectedHod.id}/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${token}`,
          },
          body: fd
        });
      } else {
        const dataToSend: any = { ...editFormData };
        if (password) {
          dataToSend.password = password;
        }
        
        response = await fetch(`http://localhost:8000/api/register/admin/hod-records/${selectedHod.id}/`, {
          method: 'PUT',
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataToSend)
        });
      }

      if (response.ok) {
        await fetchHods();
        setShowEditModal(false);
        setSelectedHod(null);
        setPassword('');
        setProfilePicFile(null);
        setProfilePicPreview(null);
        alert('HOD updated successfully!');
      } else {
        const errorText = await response.text();
        alert(`Failed to update HOD: ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating HOD:', error);
      alert('Error updating HOD');
    }
  };

  // Delete HOD
  const deleteHod = async () => {
    if (!selectedHod) return;

    try {
      const response = await fetch(`http://localhost:8000/api/register/admin/hod-records/${selectedHod.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchHods();
        setShowDeleteModal(false);
        setSelectedHod(null);
        alert('HOD deleted successfully!');
      } else {
        alert('Failed to delete HOD');
      }
    } catch (error) {
      console.error('Error deleting HOD:', error);
      alert('Error deleting HOD');
    }
  };

  // Filter HODs
  const filteredHods = hods.filter(hod => {
    const matchesSearch = hod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hod.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hod.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !filterDepartment || hod.department.name === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  // Image error handler fallback component
  const HODAvatar: React.FC<{ hod: HOD; size?: 'small' | 'large' }> = ({ hod, size = 'small' }) => {
    const [imageError, setImageError] = useState(false);
    const sizeClass = size === 'large' ? 'h-24 w-24 text-3xl' : 'h-16 w-16 text-2xl';
    const imageSizeClass = size === 'large' ? 'h-24 w-24' : 'h-16 w-16';
    
    if (hod.image && !imageError) {
      return (
        <img 
          src={getFullImageUrl(hod.image)} 
          alt={hod.name} 
          className={`${imageSizeClass} rounded-full object-cover`}
          onError={() => setImageError(true)}
        />
      );
    }
    
    return (
      <span className={`${sizeClass} font-bold text-purple-600`}>
        {hod.name?.charAt(0) || 'H'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">HOD Management</h2>
        <button
          onClick={fetchHods}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Department</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.department_id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* HODs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading HODs...</p>
          </div>
        ) : filteredHods.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2">No HODs found.</p>
          </div>
        ) : (
          filteredHods.map((hod) => (
            <motion.div
              key={hod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                    <HODAvatar hod={hod} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{hod.name}</h3>
                    <p className="text-sm text-gray-600">{hod.designation}</p>
                    <p className="text-xs text-gray-500">ID: {hod.employee_id}</p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{hod.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{hod.department?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>{hod.specialization}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleView(hod)}
                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEdit(hod)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(hod)}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {showViewModal && selectedHod && (
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
                  <h3 className="text-xl font-bold text-gray-900">HOD Details</h3>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="flex items-center space-x-6">
                    <div className="h-24 w-24 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                      <HODAvatar hod={selectedHod} size="large" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-gray-900">{selectedHod.name}</h4>
                      <p className="text-lg text-gray-600">{selectedHod.designation}</p>
                      <p className="text-sm text-gray-500">Employee ID: {selectedHod.employee_id}</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.phone}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Department</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.department?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Specialization</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.specialization}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Experience</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.experience_years} years</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Joined</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedHod.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedHod && (
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
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Edit HOD</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Profile Picture Section */}
                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Profile Picture</h4>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                      {profilePicPreview ? (
                        <img src={profilePicPreview} alt="preview" className="h-20 w-20 object-cover" />
                      ) : selectedHod.image ? (
                        <img src={getFullImageUrl(selectedHod.image)} alt="current" className="h-20 w-20 object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-purple-600">
                          {selectedHod.name?.charAt(0) || 'H'}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        <span>Change Photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleProfilePicChange} 
                          className="hidden" 
                        />
                      </label>
                      <p className="text-sm text-gray-500 mt-1">Upload JPG, PNG or GIF</p>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Personal Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={editFormData.email || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={editFormData.phone || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                      <input
                        type="text"
                        value={editFormData.designation || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                      <input
                        type="text"
                        value={editFormData.specialization || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, specialization: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years)</label>
                      <input
                        type="number"
                        value={editFormData.experience_years || 0}
                        onChange={(e) => setEditFormData({ ...editFormData, experience_years: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password Section */}
                <div className="bg-gray-50 border rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Change Password (Optional)</h4>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password to change"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Leave empty to keep current password</p>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateHod}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update HOD
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedHod && (
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
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            >
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Delete HOD</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Are you sure you want to delete <strong>{selectedHod.name}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteHod}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HODManagement;
