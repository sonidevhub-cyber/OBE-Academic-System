import React, { useState, useEffect, JSX } from 'react';
import { studentService } from '../../../api/apiService';
import batchService, { BatchFlat } from '../../../api/batchService';
import academicStructureService, { Program } from '../../../api/academicStructureService';
import { getFullImageUrl } from '../../../utils/imageHelpers';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: string | number;
  onSuccess: () => void;
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, studentId, onSuccess }): JSX.Element | null => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchFlat[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    registration_number: '',
    role: 'student', // Default role
    batch: '', // Batch field
    program: '', // Program field
    guardian_name: '',
    guardian_contact: '',
    address: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: '',
    phone: '',
  });

  const splitName = (value: string = '') => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' '),
    };
  };

  // Fetch batches and programs
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [batchRes, progRes] = await Promise.all([
            batchService.getAllBatches(),
            academicStructureService.getPrograms()
          ]);
          setBatches(batchRes.data);
          setPrograms(progRes.data);
        } catch (err) {
          console.error('Failed to fetch batches or programs:', err);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // Reset form when modal opens/closes or studentId changes
  useEffect(() => {
    if (isOpen) {
      if (studentId) {
        const fetchStudentData = async () => {
          setIsLoading(true);
          try {
            const response = await studentService.getStudentById(studentId);
            const student = response.data;
            const fallbackName = splitName(student.full_name || student.name || '');

            setFormData({
              first_name: student.first_name || fallbackName.first_name,
              middle_name: student.middle_name || '',
              last_name: student.last_name || fallbackName.last_name,
              email: student.email || student.user_email || '',
              password: '',
              registration_number: student.registration_number || '',
              role: student.role || 'student',
              batch: student.batch || '',
              program: student.program_id || student.program || '',
              guardian_name: student.guardian_name || '',
              guardian_contact: student.guardian_contact || '',
              address: student.address || '',
              date_of_birth: student.date_of_birth ? new Date(student.date_of_birth).toISOString().split('T')[0] : '',
              gender: student.gender || 'male',
              blood_group: student.blood_group || '',
              phone: student.phone || '',
            });

            if (student.image) {
              setImagePreview(student.image);
            }
          } catch (error) {
            setError('Failed to fetch user data');
          } finally {
            setIsLoading(false);
          }
        };

        fetchStudentData();
      } else {
        // Reset form for new user
        setFormData({
          first_name: '',
          middle_name: '',
          last_name: '',
          email: '',
          password: '',
          registration_number: '',
          role: 'student',
          batch: '',
          program: '',
          guardian_name: '',
          guardian_contact: '',
          address: '',
          date_of_birth: '',
          gender: 'male',
          blood_group: '',
          phone: '',
        });
        setImageFile(null);
        setImagePreview(undefined);
        setError(null);
      }
    }
  }, [studentId, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size must be less than 5MB.');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null); // Clear any previous errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.first_name.trim()) {
        setError('First name is required.');
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
      if (!formData.date_of_birth) {
        setError('Date of birth is required.');
        setIsLoading(false);
        return;
      }
      if (!formData.registration_number.trim()) {
        setError('Registration number is required.');
        setIsLoading(false);
        return;
      }
      if (!studentId && !formData.password.trim()) {
        setError('Password is required for new users.');
        setIsLoading(false);
        return;
      }
      if ((formData.role === 'student' || formData.role === 'alumni') && !formData.batch) {
        setError(`Batch is required for ${formData.role}.`);
        setIsLoading(false);
        return;
      }
      if ((formData.role === 'student') && !formData.program) {
        setError(`Program is required for students.`);
        setIsLoading(false);
        return;
      }

      // Prepare data for submission
      let dataToSend: FormData | any;
      
      // Use FormData only if we have a new image file
      if (imageFile && imageFile instanceof File) {
        dataToSend = new FormData();
        
        // Add all form fields
        dataToSend.append('first_name', formData.first_name);
        dataToSend.append('middle_name', formData.middle_name);
        dataToSend.append('last_name', formData.last_name);
        dataToSend.append('email', formData.email);
        dataToSend.append('phone', formData.phone);
        dataToSend.append('date_of_birth', formData.date_of_birth);
        dataToSend.append('registration_number', formData.registration_number);
        dataToSend.append('role', formData.role);
        
        if (formData.guardian_name) dataToSend.append('guardian_name', formData.guardian_name);
        if (formData.guardian_contact) dataToSend.append('guardian_contact', formData.guardian_contact);
        if (formData.address) dataToSend.append('address', formData.address);
        dataToSend.append('gender', formData.gender);
        if (formData.blood_group) dataToSend.append('blood_group', formData.blood_group);
        if ((formData.role === 'student' || formData.role === 'alumni') && formData.batch) {
          dataToSend.append('batch', formData.batch);
        }
        if (formData.role === 'student' && formData.program) {
          dataToSend.append('program', formData.program);
        }

        // Add password only for new users
        if (!studentId && formData.password.trim()) {
          dataToSend.append('password', formData.password);
        }
        
        // Add the new image file
        dataToSend.append('image', imageFile);
      } else {
        // Use regular JSON data when no image is being uploaded
        dataToSend = {
          first_name: formData.first_name,
          middle_name: formData.middle_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          date_of_birth: formData.date_of_birth,
          registration_number: formData.registration_number,
          gender: formData.gender,
          role: formData.role,
          ...(formData.guardian_name && { guardian_name: formData.guardian_name }),
          ...(formData.guardian_contact && { guardian_contact: formData.guardian_contact }),
          ...(formData.address && { address: formData.address }),
          ...(formData.blood_group && { blood_group: formData.blood_group }),
          ...((formData.role === 'student' || formData.role === 'alumni') && formData.batch && { batch: formData.batch }),
          ...(formData.role === 'student' && formData.program && { program: formData.program }),
          ...(formData.password.trim() && { password: formData.password }),
        };
      }

      console.log('Form data before submission:', formData);
      console.log('Data to send:', dataToSend);

      let response;
      if (studentId) {
        // For updates, handle image separately if present
        if (imageFile && imageFile instanceof File) {
          // First update user data without image
          const userDataWithoutImage = {
            first_name: formData.first_name,
            middle_name: formData.middle_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            date_of_birth: formData.date_of_birth,
            registration_number: formData.registration_number,
            gender: formData.gender,
            role: formData.role,
            ...(formData.guardian_name && { guardian_name: formData.guardian_name }),
            ...(formData.guardian_contact && { guardian_contact: formData.guardian_contact }),
            ...(formData.address && { address: formData.address }),
            ...(formData.blood_group && { blood_group: formData.blood_group }),
            ...((formData.role === 'student' || formData.role === 'alumni') && formData.batch && { batch: formData.batch }),
            ...(formData.role === 'student' && formData.program && { program: formData.program }),
            ...(formData.password.trim() && { password: formData.password }),
          };
          
          response = await studentService.updateStudent(studentId, userDataWithoutImage);
          
          // Then upload image separately
          try {
            const imageFormData = new FormData();
            imageFormData.append('image', imageFile);
            await studentService.uploadStudentImage(studentId, imageFormData);
          } catch (imageError) {
            console.warn('Image upload failed, but user data was updated:', imageError);
          }
        } else {
          // Update without image
          response = await studentService.updateStudent(studentId, dataToSend);
        }
      } else {
        response = await studentService.createStudent(dataToSend);
      }

      console.log('API Response:', response);

      // Update image preview if response contains image URL
      if (response.data && (response.data.image || response.data.student?.image)) {
        const imageUrl = response.data.image || response.data.student?.image;
        setImagePreview(imageUrl);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      console.error('Error response:', error.response?.data);
      const responseData = error.response?.data;
      const fieldErrors = responseData && typeof responseData === 'object'
        ? Object.entries(responseData)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`)
            .join(' ')
        : '';
      setError(responseData?.message || responseData?.error || fieldErrors || 'Failed to save student');
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
              {studentId ? 'Edit Student' : 'Add New Student'}
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
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="first_name">
                      First Name *
                    </label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="middle_name">
                      Middle Name
                    </label>
                    <input
                      id="middle_name"
                      name="middle_name"
                      type="text"
                      value={formData.middle_name}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="last_name">
                      Last Name
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={formData.last_name}
                      onChange={handleChange}
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
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                      {studentId ? 'Password (leave blank to keep current)' : 'Password *'}
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required={!studentId}
                      value={formData.password}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="registration_number">
                      Registration Number *
                    </label>
                    <input
                      id="registration_number"
                      name="registration_number"
                      type="text"
                      required
                      value={formData.registration_number}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="program">
                      Program *
                    </label>
                    <select
                      id="program"
                      name="program"
                      required
                      value={formData.program}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="">Select Program</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                    {programs.length === 0 && (
                      <p className="text-blue-500 text-xs italic mt-1">Loading programs...</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="batch">
                      Batch *
                    </label>
                    <select
                      id="batch"
                      name="batch"
                      required
                      value={formData.batch}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="">Select Batch</option>
                      {batches
                        .filter(b => (!formData.program || b.program_id === formData.program))
                        .map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.program_name})
                        </option>
                      ))}
                    </select>
                    {batches.length === 0 && (
                      <p className="text-blue-500 text-xs italic mt-1">Loading batches...</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date_of_birth">
                      Date of Birth
                    </label>
                    <input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">
                      Gender
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="blood_group">
                      Blood Group
                    </label>
                    <input
                      id="blood_group"
                      name="blood_group"
                      type="text"
                      value={formData.blood_group}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="guardian_name">
                      Guardian Name
                    </label>
                    <input
                      id="guardian_name"
                      name="guardian_name"
                      type="text"
                      value={formData.guardian_name}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="guardian_contact">
                      Guardian Contact
                    </label>
                    <input
                      id="guardian_contact"
                      name="guardian_contact"
                      type="text"
                      value={formData.guardian_contact}
                      onChange={handleChange}
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
                      onChange={handleChange}
                      placeholder="Enter user's full address"
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
                {studentId ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentModal;
