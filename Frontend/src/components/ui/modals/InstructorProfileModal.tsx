import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { instructorService, departmentService, Instructor } from '../../../api/studentInstructorService';
import { toast } from 'react-toastify';
import { getProfileImageUrl } from '../../../utils/profileHelpers';
import { getFullImageUrl } from '../../../utils/imageHelpers';

// Utility function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

interface Department {
  id: number;
  department_id?: number;
  name: string;
  code: string;
}

interface InstructorProfileModalProps {
  instructor: Instructor;
  onClose: () => void;
  departmentName: string;
  onSuccess?: () => void;
  isOpen?: boolean;
}

const InstructorProfileModal: React.FC<InstructorProfileModalProps> = ({
  instructor,
  onClose,
  departmentName,
  onSuccess,
  isOpen = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(getProfileImageUrl(instructor) || null);

  const [formData, setFormData] = useState({
    name: instructor.name || '',
    phone: instructor.phone || '',
    department: (typeof instructor.department === 'object' && instructor.department !== null ? ((instructor.department as any).department_id || instructor.department.id) : '') || '',
    employment_type: instructor.employment_type || 'PERMANENT',
    designation: instructor.designation || '',
    specialization: instructor.specialization || '',
    experience_years: instructor.experience_years?.toString() || '',
    hire_date: instructor.hire_date ? new Date(instructor.hire_date).toISOString().split('T')[0] : '',
    address: instructor.address || '',
  });

  // Fetch departments for editing
  useEffect(() => {
    if (isEditing) {
      const fetchDepartments = async () => {
        try {
          const response = await departmentService.getAllDepartments();
          setDepartments(response.data);
        } catch (error) {
          console.error('Failed to fetch departments:', error);
        }
      };
      fetchDepartments();
    }
  }, [isEditing]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    // Reset form data and image
    setFormData({
      name: instructor.name || '',
      phone: instructor.phone || '',
      department: (typeof instructor.department === 'object' && instructor.department !== null ? instructor.department.id : '') || '',
      employment_type: instructor.employment_type || 'PERMANENT',
      designation: instructor.designation || '',
      specialization: instructor.specialization || '',
      experience_years: instructor.experience_years?.toString() || '',
      hire_date: instructor.hire_date ? new Date(instructor.hire_date).toISOString().split('T')[0] : '',
      address: instructor.address || '',
    });
    setImageFile(null);
    setImagePreview(getProfileImageUrl(instructor) || null);
  };

  const handleSave = async () => {
    if (!instructor.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name.trim()) {
        setError('Name is required.');
        setIsLoading(false);
        return;
      }

      if (!formData.phone.trim()) {
        setError('Phone number is required.');
        setIsLoading(false);
        return;
      }

      if (!formData.specialization.trim()) {
        setError('Specialization is required.');
        setIsLoading(false);
        return;
      }

      const formDataToSend = new FormData();

      // Add all form fields to FormData
      formDataToSend.append('name', formData.name);
      formDataToSend.append('phone', formData.phone);

      // For instructors, department is stored as department_id
      if (formData.department) {
        // Convert department id to string if it's a number
        const deptId = typeof formData.department === 'number' ? formData.department.toString() : formData.department;
        formDataToSend.append('department_id', deptId);
      }

      if (formData.employment_type) formDataToSend.append('employment_type', formData.employment_type);
      if (formData.designation) formDataToSend.append('designation', formData.designation);
      if (formData.specialization) formDataToSend.append('specialization', formData.specialization);
      if (formData.experience_years) formDataToSend.append('experience_years', String(parseInt(formData.experience_years, 10) || 0));
      if (formData.hire_date) formDataToSend.append('hire_date', formData.hire_date);
      if (formData.address) formDataToSend.append('address', formData.address);

      // Update instructor
      await instructorService.updateInstructor(instructor.id, formDataToSend);

      // Upload image if selected
      if (imageFile && imageFile instanceof File) {
        try {
          const imageFormData = new FormData();
          imageFormData.append('image', imageFile);
          await instructorService.uploadInstructorImage(instructor.id, imageFormData);
        } catch (uploadError) {
          console.error('Failed to upload instructor image:', uploadError);
          setError('Instructor updated but failed to upload image.');
        }
      }

      toast.success('Instructor profile updated successfully!');
      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Failed to update instructor:', error);
      setError(error.response?.data?.message || 'Failed to update instructor profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Instructor Profile</h2>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <div className="flex space-x-3">
                  <button
                    onClick={handleEdit}
                    title="Edit"
                    className="p-2 rounded-md hover:bg-blue-100 text-blue-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1 1v12m-4-4h8" />
                    </svg>
                  </button>

                </div>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-md hover:bg-gray-200 text-gray-800"
                    disabled={isLoading}
                    title="Cancel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={handleSave}
                    className="p-2 rounded-md hover:bg-green-600 bg-green-500 text-white flex items-center justify-center"
                    disabled={isLoading}
                    title="Save"
                  >
                    {isLoading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Save
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3 flex flex-col items-center">
              {isEditing ? (
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Profile Picture
                  </label>
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mb-2">
                      {imagePreview ? (
                        <img 
                          src={imagePreview.startsWith('blob:') ? imagePreview : (getFullImageUrl(imagePreview) || imagePreview)} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm transition-colors flex items-center space-x-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v6m0-6a3 3 0 100-6 3 3 0 000 6z" />
                      </svg>
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  {imagePreview ? (
                    <img
                      src={imagePreview.startsWith('blob:') ? imagePreview : (getFullImageUrl(imagePreview) || imagePreview)}
                      alt={instructor.name}
                      className="w-48 h-48 object-cover rounded-full shadow-md"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-full bg-indigo-100 flex items-center justify-center shadow-md">
                      <span className="text-5xl text-indigo-800 font-medium">
                        {instructor.name?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold mt-4 text-center">{instructor.name || 'N/A'}</h3>
                  <p className="text-gray-600 text-center">{instructor.designation || 'Instructor'}</p>
                </>
              )}
            </div>

            <div className="md:w-2/3">
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                      Name *
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                      Phone *
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="text"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="department">
                      Department *
                    </label>
                    <select
                      id="department"
                      name="department"
                      required
                      value={formData.department}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employment_type">
                      Employment Type *
                    </label>
                    <select
                      id="employment_type"
                      name="employment_type"
                      required
                      value={formData.employment_type}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="PERMANENT">Permanent</option>
                      <option value="VISITING">Visiting</option>
                      <option value="INTERNEE">Internee</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="designation">
                      Designation
                    </label>
                    <input
                      id="designation"
                      name="designation"
                      type="text"
                      value={formData.designation}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="specialization">
                      Specialization *
                    </label>
                    <input
                      id="specialization"
                      name="specialization"
                      type="text"
                      required
                      value={formData.specialization}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="experience_years">
                      Experience (years)
                    </label>
                    <input
                      id="experience_years"
                      name="experience_years"
                      type="number"
                      value={formData.experience_years}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="hire_date">
                      Hire Date
                    </label>
                    <input
                      id="hire_date"
                      name="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={3}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    ></textarea>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{(() => {
                      // Try multiple possible email sources
                      let email = null;
                      
                      // Check user object first
                      if (instructor.user && typeof instructor.user === 'object' && instructor.user !== null) {
                        email = instructor.user.email;
                      }
                      
                      // Fallback to direct email fields
                      if (!email) {
                        email = instructor.email || instructor.user_email;
                      }
                      
                      // Handle array case and string arrays
                      if (Array.isArray(email)) {
                        email = email[0];
                      } else if (email && typeof email === 'string' && email.startsWith('[')) {
                        // Handle string that looks like an array: "['email@domain.com']"
                        try {
                          const parsed = JSON.parse(email.replace(/'/g, '"'));
                          email = Array.isArray(parsed) ? parsed[0] : email;
                        } catch {
                          // If JSON parsing fails, extract manually
                          email = email.replace(/[\[\]'"]/g, '');
                        }
                      }
                      
                      // Clean and decode HTML entities if email exists
                      if (email && typeof email === 'string') {
                        email = email.replace(/[\[\]'"]/g, '');
                        email = decodeHtmlEntities(email);
                      }
                      
                      return email || 'N/A';
                    })()}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{instructor.phone || 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium">{departmentName}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Employment Type</p>
                    <p className="font-medium">{instructor.employment_type || 'Permanent'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Employee ID</p>
                    <p className="font-medium">{instructor.employee_id || 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Specialization</p>
                    <p className="font-medium">{instructor.specialization || 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Experience</p>
                    <p className="font-medium">{instructor.experience_years ? `${instructor.experience_years} years` : 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Hire Date</p>
                    <p className="font-medium">{instructor.hire_date ? new Date(instructor.hire_date).toLocaleDateString() : 'N/A'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{instructor.address || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InstructorProfileModal;
