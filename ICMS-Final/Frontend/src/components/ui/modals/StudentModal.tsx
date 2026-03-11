import React, { useState, useEffect, JSX } from 'react';
import { studentService, departmentService, semesterService, courseService } from '../../../api/apiService';

interface Semester {
  id: number;
  name: string;
  semester_code: string;
  department: number;
  program?: string;
  capacity?: number;
}

interface Course {
  course_id: number;
  name: string;
  code: string;
  semester?: number;
  semester_details?: {
    id: number;
    name: string;
    semester_code: string;
  };
}

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: number;
  onSuccess: () => void;
  preSelectedDepartment?: number; // Optional prop to pre-select department
  preSelectedSemester?: number; // Optional prop to pre-select semester
}

interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
}

const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, studentId, onSuccess, preSelectedDepartment }): JSX.Element | null => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    registration_number: '',
    department: 0, // Department field
    semester: 0, // Semester field
    batch: '', // Batch field
    guardian_name: '',
    guardian_contact: '',
    address: '',
    date_of_birth: '',
    gender: 'male',
    blood_group: '',
    phone: '',
  });

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async (): Promise<void> => {
      try {
        setError(null); // Clear any previous errors
        console.log('Fetching departments...'); // Debug log
        const response = await departmentService.getAllDepartments();
        console.log('Departments response:', response); // Debug log
        console.log('Departments data:', response.data); // Debug log

        if (response && response.data) {
          let departmentsData: Department[] = [];

          if (Array.isArray(response.data)) {
            departmentsData = response.data;
          } else if (response.data.results && Array.isArray(response.data.results)) {
            // Handle paginated response
            departmentsData = response.data.results;
          } else {
            // Try to extract departments from any structure
            departmentsData = response.data.departments || [];
          }

          // Validate department data structure
          const validDepartments = departmentsData.filter(dept =>
            dept &&
            typeof dept === 'object' &&
            dept.id &&
            dept.name
          );

          if (validDepartments.length > 0) {
            setDepartments(validDepartments);
            console.log('Departments loaded successfully:', validDepartments.length, 'departments');

            // Set pre-selected department if provided
            if (preSelectedDepartment) {
              setFormData(prev => ({ ...prev, department: preSelectedDepartment }));
            }
          } else {
            setError('No valid departments found');
            console.error('No valid departments in response:', response.data);
          }
        } else {
          setError('Failed to load departments: No response data');
          console.error('No response data received');
        }
      } catch (error: any) {
        console.error('Error fetching departments:', error);
        console.error('Error response:', error.response);
        console.error('Error status:', error.response?.status);
        console.error('Error data:', error.response?.data);

        if (error.response?.status === 401) {
          setError('Authentication required. Please login first.');
        } else if (error.response?.status === 403) {
          setError('Access denied. You do not have permission to view departments.');
        } else {
          setError('Failed to load departments. Please check your connection and try again.');
        }
      }
    };

    if (isOpen) {
      fetchDepartments();
    }
  }, [preSelectedDepartment, isOpen]);

  // Fetch semesters when department changes
  useEffect(() => {
    const fetchSemesters = async () => {
      if (!formData.department) {
        setSemesters([]);
        return;
      }

      try {
        setError(null); // Clear any previous errors
        console.log('Fetching semesters for department:', formData.department);
        const response = await departmentService.getSemestersByDepartment(formData.department);
        console.log('Semesters response:', response);

        if (response && response.data) {
          let semestersData: Semester[] = [];

          // Handle different response formats
          if (Array.isArray(response.data)) {
            semestersData = response.data;
          } else if (response.data.results && Array.isArray(response.data.results)) {
            semestersData = response.data.results;
          } else if (response.data.semesters && Array.isArray(response.data.semesters)) {
            semestersData = response.data.semesters;
          } else {
            console.error('Unexpected response format:', response.data);
            setError('Failed to load semesters: Unexpected response format');
            setSemesters([]);
            return;
          }

          // Filter semesters to only show valid ones (1-8)
          const filteredSemesters = semestersData.filter((sem: any) => {
            // Try to extract semester number from name or semester_code
            const nameMatch = sem.name?.match(/(\d+)/);
            const codeMatch = sem.semester_code?.match(/(\d+)/);

            let semNumber = null;
            if (nameMatch) {
              semNumber = parseInt(nameMatch[1], 10);
            } else if (codeMatch) {
              semNumber = parseInt(codeMatch[1], 10);
            }

            // If we can't extract a number, include it anyway (better to show all than none)
            if (semNumber === null) {
              console.log('Could not extract semester number from:', sem);
              return true; // Include semester if we can't determine the number
            }

            return semNumber >= 1 && semNumber <= 8;
          });

          console.log('Filtered semesters:', filteredSemesters);
          setSemesters(filteredSemesters);
        } else {
          setError('Failed to load semesters: No response data');
          setSemesters([]);
        }
      } catch (error: any) {
        console.error('Error fetching semesters:', error);
        setError('Failed to load semesters. Please check your connection and try again.');
        setSemesters([]);
      }
    };

    fetchSemesters();
  }, [formData.department]);

  // Fetch courses when semester changes
  useEffect(() => {
    const fetchCourses = async () => {
      if (formData.semester) {
        try {
          setError(null); // Clear any previous errors
          console.log('Fetching courses for semester:', formData.semester);
          const response = await courseService.getAllCourses();
          console.log('Courses response:', response);

          if (response && response.data) {
            let coursesData: Course[] = [];

            if (Array.isArray(response.data)) {
              coursesData = response.data;
            } else if (response.data.results && Array.isArray(response.data.results)) {
              coursesData = response.data.results;
            } else {
              coursesData = response.data.courses || [];
            }

            // Filter courses by semester
            const filteredCourses = coursesData.filter((course: Course) => {
              // Check semester_details first, then semester field
              const courseSemesterId = course.semester_details?.id || course.semester;
              return courseSemesterId === formData.semester;
            });

            console.log('Filtered courses:', filteredCourses);
            setCourses(filteredCourses);
          } else {
            setError('Failed to load courses: No response data');
          }
        } catch (error: any) {
          console.error('Error fetching courses:', error);
          setError('Failed to load courses. Please check your connection and try again.');
        }
      } else {
        setCourses([]);
      }
    };

    fetchCourses();
  }, [formData.semester]);

  // Reset form when modal opens/closes or studentId changes
  useEffect(() => {
    if (isOpen) {
      if (studentId) {
        const fetchStudentData = async () => {
          setIsLoading(true);
          try {
            const response = await studentService.getStudentById(studentId);
            const student = response.data;

            setFormData({
              first_name: student.first_name || '',
              last_name: student.last_name || '',
              email: student.email || '',
              password: '',
              registration_number: student.registration_number || '',
              department: student.department ? student.department.id : 0,
              semester: student.semester ? student.semester.id : 0,
              batch: student.batch || '',
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
            setError('Failed to fetch student data');
          } finally {
            setIsLoading(false);
          }
        };

        fetchStudentData();
      } else {
        // Reset form for new student
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          password: '',
          registration_number: '',
          department: preSelectedDepartment || 0,
          semester: 0,
          batch: '',
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
  }, [studentId, isOpen, preSelectedDepartment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    if (name === 'department' || name === 'semester') {
      setFormData(prev => ({ ...prev, [name]: value ? parseInt(value, 10) : 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
      if (!formData.last_name.trim()) {
        setError('Last name is required.');
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
      if (!formData.department || formData.department === 0) {
        setError('Please select a department.');
        setIsLoading(false);
        return;
      }
      if (!formData.semester || formData.semester === 0) {
        setError('Please select a semester.');
        setIsLoading(false);
        return;
      }
      if (!studentId && !formData.password.trim()) {
        setError('Password is required for new students.');
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
        dataToSend.append('last_name', formData.last_name);
        dataToSend.append('email', formData.email);
        dataToSend.append('phone', formData.phone);
        dataToSend.append('date_of_birth', formData.date_of_birth);
        dataToSend.append('registration_number', formData.registration_number);
        dataToSend.append('department_id', formData.department.toString());
        
        if (formData.guardian_name) dataToSend.append('guardian_name', formData.guardian_name);
        if (formData.guardian_contact) dataToSend.append('guardian_contact', formData.guardian_contact);
        if (formData.address) dataToSend.append('address', formData.address);
        dataToSend.append('gender', formData.gender);
        if (formData.blood_group) dataToSend.append('blood_group', formData.blood_group);
        if (formData.batch) dataToSend.append('batch', formData.batch);

        // Add password only for new students
        if (!studentId && formData.password.trim()) {
          dataToSend.append('password', formData.password);
        }

        // Add semester if selected
        if (formData.semester && formData.semester !== 0) {
          dataToSend.append('semester_id', formData.semester.toString());
        }
        
        // Add the new image file
        dataToSend.append('image', imageFile);
      } else {
        // Use regular JSON data when no image is being uploaded
        dataToSend = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          date_of_birth: formData.date_of_birth,
          registration_number: formData.registration_number,
          department_id: formData.department,
          gender: formData.gender,
          ...(formData.guardian_name && { guardian_name: formData.guardian_name }),
          ...(formData.guardian_contact && { guardian_contact: formData.guardian_contact }),
          ...(formData.address && { address: formData.address }),
          ...(formData.blood_group && { blood_group: formData.blood_group }),
          ...(formData.batch && { batch: formData.batch }),
          ...(!studentId && formData.password.trim() && { password: formData.password }),
          ...(formData.semester && formData.semester !== 0 && { semester_id: formData.semester })
        };
      }

      console.log('Form data before submission:', formData);
      console.log('Data to send:', dataToSend);

      let response;
      if (studentId) {
        // For updates, handle image separately if present
        if (imageFile && imageFile instanceof File) {
          // First update student data without image
          const studentDataWithoutImage = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            date_of_birth: formData.date_of_birth,
            registration_number: formData.registration_number,
            department_id: formData.department,
            gender: formData.gender,
            ...(formData.guardian_name && { guardian_name: formData.guardian_name }),
            ...(formData.guardian_contact && { guardian_contact: formData.guardian_contact }),
            ...(formData.address && { address: formData.address }),
            ...(formData.blood_group && { blood_group: formData.blood_group }),
            ...(formData.batch && { batch: formData.batch }),
            ...(formData.semester && formData.semester !== 0 && { semester_id: formData.semester })
          };
          
          response = await studentService.updateStudent(studentId, studentDataWithoutImage);
          
          // Then upload image separately
          try {
            const imageFormData = new FormData();
            imageFormData.append('image', imageFile);
            await studentService.uploadStudentImage(studentId, imageFormData);
          } catch (imageError) {
            console.warn('Image upload failed, but student data was updated:', imageError);
            // Don't fail the entire operation if image upload fails
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
      setError(error.response?.data?.message || error.response?.data?.error || 'Failed to save student');
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
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="last_name">
                      Last Name *
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      required
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
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="batch">
                      Batch
                    </label>
                    <input
                      id="batch"
                      name="batch"
                      type="text"
                      value={formData.batch}
                      onChange={handleChange}
                      placeholder="e.g., 2025-2029"
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
                      value={formData.department || ""}
                      onChange={handleChange}
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${departments.length === 0 ? 'bg-gray-100' : ''}`}
                      disabled={departments.length === 0}
                    >
                      <option value="">Select Department</option>
                      {departments.length > 0 ? (
                        departments.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          {error ? 'Failed to load departments' : 'Loading departments...'}
                        </option>
                      )}
                    </select>
                    {departments.length === 0 && !error && (
                      <p className="text-blue-500 text-xs italic mt-1">Loading departments...</p>
                    )}
                    {error && (
                      <p className="text-red-500 text-xs italic mt-1">{error}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="semester">
                      Semester *
                    </label>
                    <select
                      id="semester"
                      name="semester"
                      required
                      value={formData.semester || ""}
                      onChange={handleChange}
                      className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${semesters.length === 0 ? 'bg-gray-100' : ''}`}
                      disabled={semesters.length === 0 || !formData.department}
                    >
                      <option value="">Select Semester</option>
                      {semesters.length > 0 ? (
                        semesters.map(semester => (
                          <option key={semester.id} value={semester.id}>
                            {semester.name} ({semester.semester_code})
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          {formData.department ? 'Loading semesters...' : 'Select department first'}
                        </option>
                      )}
                    </select>
                    {semesters.length === 0 && formData.department && (
                      <p className="text-blue-500 text-xs italic mt-1">
                        Debug: Department {formData.department} selected, but no semesters loaded
                      </p>
                    )}
                    {semesters.length === 0 && !error && (
                      <p className="text-blue-500 text-xs italic mt-1">
                        {formData.department ? 'Loading semesters...' : 'Please select a department first'}
                      </p>
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
                      placeholder="Enter student's full address"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Assigned Courses</h3>
                  <ul className="list-disc list-inside max-h-48 overflow-y-auto border border-gray-300 rounded p-3 bg-gray-50">
                    {courses.map(course => (
                      <li key={course.course_id} className="text-gray-700">
                        {course.name} ({course.code})
                      </li>
                    ))}
                  </ul>
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
