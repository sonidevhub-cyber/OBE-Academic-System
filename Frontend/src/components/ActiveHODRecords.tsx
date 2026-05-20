import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hodService, HOD } from '../api/hodService';

interface ActiveHOD extends HOD {
  department_name: string;
  is_active: boolean;
  hire_date?: string;
  status: string;
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

const ActiveHODRecords: React.FC = () => {
  const [activeHods, setActiveHods] = useState<ActiveHOD[]>([]);
  const [selectedHod, setSelectedHod] = useState<ActiveHOD | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<ActiveHOD>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Profile picture and password state for edit modal
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  // Fetch HODs from backend
  const fetchHODs = async () => {
    try {
      setLoading(true);
      const response = await hodService.getAllHODs();
      console.log('HOD API Response:', response);
      if (response.success) {
        console.log('HOD Data received:', response.data);
        setActiveHods(response.data as ActiveHOD[]);
      } else {
        console.error('API returned success: false', response);
      }
    } catch (error) {
      console.error('Error fetching HODs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHODs();
  }, []);

  const handleEdit = (hod: ActiveHOD) => {
    setSelectedHod(hod);
    setEditFormData({ ...hod });
    setProfilePicFile(null);
    setProfilePicPreview(null);
    setPassword('');
    setShowEditModal(true);
  };

  const handleView = (hod: ActiveHOD) => {
    setSelectedHod(hod);
    setShowViewModal(true);
  };

  const handleRetire = (hod: ActiveHOD) => {
    setSelectedHod(hod);
    setShowRetireModal(true);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setProfilePicPreview(URL.createObjectURL(file));
  };

  const updateHod = async () => {
    if (!selectedHod || !editFormData) return;

    try {
      // Create updated data object
      const dataToSend: any = { ...editFormData };
      
      // Only include password if it's not empty
      if (password) {
        dataToSend.password = password;
      }

      const response = await hodService.updateHOD(selectedHod.id, dataToSend);
      if (response.success) {
        await fetchHODs(); // Refresh the list
        setShowEditModal(false);
        setSelectedHod(null);
        setPassword('');
        setProfilePicFile(null);
        setProfilePicPreview(null);
      }
    } catch (error) {
      console.error('Error updating HOD:', error);
      alert('Failed to update HOD');
    }
  };

  const retireHod = async () => {
    if (!selectedHod) return;

    try {
      const response = await hodService.retireHOD(selectedHod.id);
      if (response.success) {
        await fetchHODs(); // Refresh the list
        setShowRetireModal(false);
        setSelectedHod(null);
        alert(response.message);
      }
    } catch (error) {
      console.error('Error retiring HOD:', error);
      alert('Failed to retire HOD');
    }
  };

  const refreshRecords = () => {
    fetchHODs();
  };

  const filteredHods = activeHods.filter(hod => {
    // Show all HODs from the API since backend already filters for approved ones
    const matchesSearch = hod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         hod.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (hod.department_name && hod.department_name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // Debug log to see what data we're getting
  console.log('Active HODs data:', activeHods);
  console.log('Filtered HODs:', filteredHods);

  // Image error handler component
  const HODAvatar: React.FC<{ hod: ActiveHOD; size?: 'small' | 'large' }> = ({ hod, size = 'small' }) => {
    const [imageError, setImageError] = useState(false);
    const sizeClass = size === 'large' ? 'h-24 w-24 text-3xl' : 'h-16 w-16 text-xl';
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
      <span className={`${sizeClass} font-bold text-white`}>
        {hod.name?.charAt(0) || 'H'}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Active HOD Records</h2>
          <p className="text-gray-600 mt-1">Manage approved and active Head of Department records</p>
        </div>
        <button
          onClick={refreshRecords}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {filteredHods.length} active HOD{filteredHods.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => window.location.href = '/admin/hod-requests'}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approve Requests
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading HOD records...</p>
        </div>
      ) : (
        /* HOD Cards */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredHods.map((hod) => (
            <motion.div
              key={hod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200"
            >
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                    <HODAvatar hod={hod} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{hod.name}</h3>
                    <p className="text-sm text-gray-600">{hod.designation || 'Head of Department'}</p>
                    <div className="flex items-center mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{hod.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{hod.department_name}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>{hod.specialization}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleView(hod)}
                    className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(hod)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRetire(hod)}
                    className="flex-1 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
                  >
                    Retire
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredHods.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No Active HOD Records Found</h3>
          <p className="mt-1 text-sm text-gray-500 mb-4">
            {searchTerm ? 'No HOD records match your search criteria.' : 'There are currently no approved HOD records in the system.'}
          </p>
          {!searchTerm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  To create active HOD records, you need to approve HOD registration requests first.
                </p>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => window.location.href = '/admin/hod-requests'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Approve HOD Requests
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
                  <h3 className="text-xl font-bold text-gray-900">HOD Profile Details</h3>
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
                  <div className="flex items-center space-x-6">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                      <HODAvatar hod={selectedHod} size="large" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-gray-900">{selectedHod.name}</h4>
                      <p className="text-lg text-gray-600">Head of Department</p>
                      <div className="flex items-center mt-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          ✓ Active Status
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email Address</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Department</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.department_name}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Specialization</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedHod.specialization}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Hire Date</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedHod.hire_date ? new Date(selectedHod.hire_date).toLocaleDateString() : 'N/A'}
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
                <h3 className="text-xl font-bold text-gray-900">Edit HOD Profile</h3>
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
                    <div className="h-20 w-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                      {profilePicPreview ? (
                        <img src={profilePicPreview} alt="preview" className="h-20 w-20 object-cover" />
                      ) : selectedHod.image ? (
                        <img src={getFullImageUrl(selectedHod.image)} alt="current" className="h-20 w-20 object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-white">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Experience Years</label>
                      <input
                        type="number"
                        value={editFormData.experience_years || 0}
                        onChange={(e) => setEditFormData({ ...editFormData, experience_years: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
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
                  Update Profile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retire Modal */}
      <AnimatePresence>
        {showRetireModal && selectedHod && (
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
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100">
                    <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Retire HOD</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Are you sure you want to retire <strong>{selectedHod.name}</strong>? This will allow a new HOD to be assigned to the {selectedHod.department_name} department.
                  </p>
                </div>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setShowRetireModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={retireHod}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Retire HOD
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

export default ActiveHODRecords;
