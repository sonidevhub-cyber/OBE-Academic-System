
import React, { useState, useEffect } from 'react';
import { instructorService, departmentService } from '../../../api/studentInstructorService';

interface InstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  instructorId?: number;
  onSuccess: () => void;
}

interface Department {
  id: number;
  name: string;
  code: string;
}

type EmploymentType = 'PERMANENT' | 'VISITING' | 'INTERNEE';

const InstructorModal: React.FC<InstructorModalProps> = ({ isOpen, onClose, instructorId, onSuccess }): React.ReactElement | null => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    department_id: string;
    employment_type: EmploymentType;
    designation: string;
    specialization: string;
    experience_years: string;
    hire_date: string;
    address: string;
    password: string;
  }>({
    name: '',
    email: '',
    phone: '',
    department_id: '',  // Changed from department to department_id
    employment_type: 'PERMANENT',
    designation: '',
    specialization: '',
    experience_years: '',
    hire_date: '',
    address: '',
    password: '',
  });

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await departmentService.getAllDepartments();
        setDepartments(response.data);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        setError('Failed to load departments. Please try again.');
      }
    };

    fetchDepartments();
  }, []);

  // Fetch instructor data if editing
  useEffect(() => {
    if (instructorId) {
      const fetchInstructorData = async () => {
        setIsLoading(true);
        try {
          const response = await instructorService.getInstructorById(instructorId);
          const instructor = response.data;
          
          // For instructors, department is stored as object with id
          const departmentId = (instructor.department && typeof instructor.department === 'object' && instructor.department.id)
            ? instructor.department.id
            : instructor.department_id || '';

          setFormData(prev => ({
            ...prev,
            name: instructor.name || '',
            email: instructor.user?.email || '',
            phone: instructor.phone || '',
            department_id: departmentId ? departmentId.toString() : '',
            employment_type: instructor.employment_type || 'PERMANENT',
            designation: instructor.designation || '',
            specialization: instructor.specialization || '',
            experience_years: instructor.experience_years?.toString() || '',
            hire_date: instructor.hire_date ? new Date(instructor.hire_date).toISOString().split('T')[0] : '',
            address: instructor.address || '',
            password: '',
          }));
          
          if (instructor.image) {
            setImagePreview(instructor.image);
          }
        } catch (error) {
          console.error('Failed to fetch instructor data:', error);
          setError('Failed to load instructor data. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchInstructorData();
    }
  }, [instructorId, departments]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'employment_type') {
      setFormData(prev => ({ ...prev, employment_type: value as EmploymentType }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.name.trim()) {
        setError('Name is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.email.trim()) {
        setError('Email is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.phone.trim()) {
        setError('Phone number is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.department_id) {
        setError('Please select a department.');
        setIsLoading(false);
        return;
      }
      if (!formData.specialization.trim()) {
        setError('Specialization is required.');
        setIsLoading(false);
        return;
      }
      if (!instructorId && !formData.password.trim()) {
        setError('Password is required for new instructors.');
        setIsLoading(false);
        return;
      }

      // Prepare data for submission
      let dataToSend: FormData | any;
      
      // Use FormData only if we have a new image file
      if (imageFile && imageFile instanceof File) {
        dataToSend = new FormData();
        
        // Add all form fields
        dataToSend.append('name', formData.name);
        dataToSend.append('user_email', formData.email);
        dataToSend.append('phone', formData.phone);
        dataToSend.append('department_id', formData.department_id);
        dataToSend.append('employment_type', formData.employment_type);
        
        if (formData.designation) dataToSend.append('designation', formData.designation);
        if (formData.specialization) dataToSend.append('specialization', formData.specialization);
        if (formData.experience_years) dataToSend.append('experience_years', formData.experience_years);
        if (formData.hire_date) dataToSend.append('hire_date', formData.hire_date);
        if (formData.address) dataToSend.append('address', formData.address);
        if (formData.password) dataToSend.append('password', formData.password);
        
        // Add the new image file
        dataToSend.append('image', imageFile);
      } else {
        // Use regular JSON data when no image is being uploaded
        dataToSend = {
          name: formData.name,
          user_email: formData.email,
          phone: formData.phone,
          department_id: parseInt(formData.department_id),
          employment_type: formData.employment_type,
          ...(formData.designation && { designation: formData.designation }),
          ...(formData.specialization && { specialization: formData.specialization }),
          ...(formData.experience_years && { experience_years: parseInt(formData.experience_years) }),
          ...(formData.hire_date && { hire_date: formData.hire_date }),
          ...(formData.address && { address: formData.address }),
          ...(formData.password && { password: formData.password })
        };
      }

      console.log('Data to send:', dataToSend);

      let response;
      if (instructorId) {
        // For updates, handle image separately if present
        if (imageFile && imageFile instanceof File) {
          // First update instructor data without image
          const instructorDataWithoutImage = {
            name: formData.name,
            user_email: formData.email,
            phone: formData.phone,
            department_id: parseInt(formData.department_id),
            employment_type: formData.employment_type,
            ...(formData.designation && { designation: formData.designation }),
            ...(formData.specialization && { specialization: formData.specialization }),
            ...(formData.experience_years && { experience_years: parseInt(formData.experience_years) }),
            ...(formData.hire_date && { hire_date: formData.hire_date }),
            ...(formData.address && { address: formData.address }),
            ...(formData.password && { password: formData.password })
          };
          
          response = await instructorService.updateInstructor(instructorId, instructorDataWithoutImage);
          
          // Then upload image separately
          try {
            const imageFormData = new FormData();
            imageFormData.append('image', imageFile);
            await instructorService.uploadInstructorImage(instructorId, imageFormData);
          } catch (imageError) {
            console.warn('Image upload failed, but instructor data was updated:', imageError);
          }
        } else {
          // Update without image
          response = await instructorService.updateInstructor(instructorId, dataToSend);
        }
      } else {
        response = await instructorService.createInstructor(dataToSend);
      }

      if (!instructorId) {
        const createdEmployeeId = response?.data?.employee_id;
        if (createdEmployeeId) {
          alert(`Instructor created successfully!\nEmployee ID: ${createdEmployeeId}`);
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save instructor:', error);
      setError(error.response?.data?.message || 'Failed to save instructor. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {instructorId ? 'Edit Instructor' : 'Add New Instructor'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Profile Picture
                  </label>
                  <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mb-2">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm transition-colors">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                      Full Name *
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
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
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
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="department_id">
                      Department *
                    </label>
                    <select
                      id="department_id"
                      name="department_id"
                      required
                      value={formData.department_id}
                      onChange={handleInputChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id.toString()}>
                          {dept.name} ({dept.code})
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
                      Experience (Years)
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

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                      {instructorId ? 'Password (leave blank to keep current)' : 'Password *'}
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required={!instructorId}
                      value={formData.password}
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
                      rows={3}
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Enter instructor's full address"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors flex items-center"
              >
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {instructorId ? 'Update Instructor' : 'Add Instructor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InstructorModal;
