import React, { useState, useEffect } from 'react';
import { studentService } from '../../api/apiService';
import { getDisplayName, getProfileImageUrl } from '../../utils/profileHelpers';

interface SimpleStudentProfileProps {
  studentId?: number;
  onClose?: () => void;
}

interface Student {
  student_id: number;
  name: string;
  email: string;
  phone: string;
  course?: {
    course_id: number;
    name: string;
    code: string;
  } | null;
  department?: {
    id: number;
    name: string;
  } | null;
  father_guardian?: string;
  guardian_name?: string;
  guardian_contact?: string;
  address?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  registration_number?: string;
  image?: string;
  attendance_percentage: number;
  gpa: number;
  performance_notes?: string;
  enrollment_date?: string;
}

const SimpleStudentProfile: React.FC<SimpleStudentProfileProps> = ({ studentId, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  
  useEffect(() => {
    const fetchStudent = async () => {
      if (!studentId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await studentService.getStudentById(studentId);
        setStudent(response.data);
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to fetch student profile');
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [studentId]);
  
  const handleBack = () => {
    if (onClose) {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
        {error}
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4">
        No student data available
      </div>
    );
  }

  const displayName = getDisplayName(student, 'Student');
  const imageUrl = getProfileImageUrl(student);

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Student Profile</h1>
          <button
            onClick={handleBack}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors"
          >
            Back
          </button>
        </div>

        {/* Student Basic Info */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="md:flex">
            <div className="md:flex-shrink-0 p-6 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200">
                {imageUrl ? (
                  <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
              <div className="p-6 md:p-8 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{displayName}</h2>
                    <p className="text-gray-600 mb-2">Email: {student.email}</p>
                    <p className="text-gray-600 mb-2">Phone: {student.phone}</p>
                  <p className="text-gray-600 mb-2">Course: {student.course?.name || 'Not assigned'}</p>
                  <p className="text-gray-600 mb-2">Department: {student.department?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-2">GPA: {student.gpa?.toFixed(2) || 'N/A'}</p>
                  <p className="text-gray-600 mb-2">Attendance: {student.attendance_percentage?.toFixed(1) || 'N/A'}%</p>
                  <p className="text-gray-600 mb-2">Guardian: {student.father_guardian || student.guardian_name || 'N/A'}</p>
                  <p className="text-gray-600 mb-2">Registration: {student.registration_number || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Personal Information</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Date of Birth</h4>
                  <p className="text-gray-600">{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'Not specified'}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Gender</h4>
                  <p className="text-gray-600">{student.gender || 'Not specified'}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Blood Group</h4>
                  <p className="text-gray-600">{student.blood_group || 'Not specified'}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Address</h4>
                  <p className="text-gray-600">{student.address || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Academic Information */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Academic Information</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Course</h4>
                  <p className="text-gray-600">{student.course?.name || 'Not assigned'}</p>
                  {student.course?.code && (
                    <p className="text-sm text-gray-500">Code: {student.course.code}</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Department</h4>
                  <p className="text-gray-600">{student.department?.name || 'Not assigned'}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Enrollment Date</h4>
                  <p className="text-gray-600">
                    {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : 'Not specified'}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Performance Notes</h4>
                  <p className="text-gray-600">{student.performance_notes || 'No notes available'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Guardian Information */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Guardian Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Guardian Name</h4>
                <p className="text-gray-600">{student.father_guardian || student.guardian_name || 'Not specified'}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Guardian Contact</h4>
                <p className="text-gray-600">{student.guardian_contact || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleStudentProfile;
