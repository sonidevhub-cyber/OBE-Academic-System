import React, { useState, useEffect } from 'react';
import { studentService } from '../../api/apiService';
import { getDisplayName, getProfileImageUrl } from '../../utils/profileHelpers';

interface EnhancedStudentProfileProps {
  studentId?: string | number;
  onClose?: () => void;
}

interface Course {
  course_id: string | number;
  name: string;
  code: string;
  description?: string;
}

interface Student {
  student_id: string | number;
  name: string;
  email?: string;
  user_email?: string;
  phone?: string;
  courses?: Course[];
  enrolled_courses?: Course[];
  department?: {
    id: number;
    name: string;
  } | null;
  program_name?: string;
  program_code?: string;
  program_details?: {
    name: string;
    code: string;
  };
  program?: any;
  program_info?: {
    name: string;
    code: string;
  };
  batch?: any;
  batch_name?: string;
  batch_details?: {
    name: string;
    id: string | number;
  };
  father_guardian?: string;
  guardian_name?: string;
  guardian_contact?: string;
  address?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  registration_number?: string;
  custom_id?: string;
  image?: string;
  attendance_percentage?: number;
  gpa?: number;
  performance_notes?: string;
  enrollment_date?: string;
  created_at?: string;
  date_joined?: string;
}



const EnhancedStudentProfile: React.FC<EnhancedStudentProfileProps> = ({ studentId, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'academic' | 'personal'>('overview');
  
  useEffect(() => {
    const fetchStudent = async () => {
      if (!studentId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await studentService.getStudentById(studentId);
        console.log('Student API response:', response);
        console.log('Student data:', response.data);
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
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="h-8 w-8 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-red-800">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="h-8 w-8 text-yellow-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="text-lg font-medium text-yellow-800">No Data</h3>
            <p className="text-yellow-600">No student data available</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName = getDisplayName(student, 'Student');
  const imageUrl = getProfileImageUrl(student);
  const displayEmail = student.user_email || student.email || 'No email provided';
  const displayId = student.registration_number || student.custom_id || student.student_id;
  
  // Extract batch info
   const batchObj = student.batch_details || (typeof student.batch === 'object' ? student.batch : null);
   const rawBatch = student.batch_name || batchObj?.name || (typeof student.batch === 'string' ? student.batch : null);
   const batchName = rawBatch || 'Not assigned';
   
   // Extract program info - checking student object and batch object
   let pName = student.program_name || 
               student.program_details?.name || 
               (typeof student.program === 'object' ? student.program?.name : null) || 
               student.program_info?.name || 
               batchObj?.program_name || 
               batchObj?.program?.name;

   // Fallback: extract from batch name (e.g., "BSit-2026" -> "BSit")
   if (!pName && rawBatch && rawBatch.includes('-')) {
     pName = rawBatch.split('-')[0];
   }
   
   const programName = pName || 'Not assigned';

   const programCode = 
     student.program_code || 
     student.program_details?.code || 
     (typeof student.program === 'object' ? student.program?.code : null) || 
     student.program_info?.code || 
     batchObj?.program_code || 
     batchObj?.program?.code ||
     'N/A';
   
   // Extract courses - check multiple possible locations
   const studentCourses = 
     student.enrolled_courses || 
     student.courses || 
     (student as any).assigned_courses || 
     (student as any).academic_records?.courses || 
     (student as any).enrollment?.courses ||
     batchObj?.courses ||
     [];
   
   // Extract date
   const rawDate = student.enrollment_date || student.created_at || student.date_joined || (student as any).admission_date;
  const formattedEnrollmentDate = rawDate ? new Date(rawDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'N/A';

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'academic', name: 'Academic' },
    { id: 'personal', name: 'Personal' }
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-white shadow-lg">
                  {imageUrl ? (
                    <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-2xl font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{displayName}</h1>
                  <p className="text-indigo-100 text-lg">{displayEmail}</p>
                  <p className="text-indigo-200">ID: {displayId}</p>
                </div>
              </div>
              <button
                onClick={handleBack}
                className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Student Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">GPA</p>
                      <p className="text-3xl font-bold text-blue-900">{student.gpa?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Batch</p>
                      <p className="text-2xl font-bold text-green-900">{batchName}</p>
                      <p className="text-xs text-green-700 mt-1">Attendance: {student.attendance_percentage?.toFixed(1) || 'N/A'}%</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                  <div className="flex flex-col h-full">
                    <p className="text-purple-600 text-sm font-medium mb-3">Enrolled Courses</p>
                    {studentCourses.length > 0 ? (
                      <div className="space-y-2 overflow-y-auto pr-2 max-h-40 custom-scrollbar">
                        {studentCourses.map((course: Course) => (
                          <div key={course.course_id} className="flex items-center gap-2 bg-white/50 p-2 rounded border border-purple-200">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-semibold text-purple-900 truncate">{course.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-purple-900 font-medium italic">No courses assigned</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Academic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">Program Details</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <p><span className="font-medium">Program Name:</span> {programName}</p>
                    <p><span className="font-medium">Program Code:</span> {programCode}</p>
                    <p><span className="font-medium">Batch:</span> {batchName}</p>
                    <p><span className="font-medium">Registration No:</span> {student.registration_number || 'N/A'}</p>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-700 mt-6">Assigned Courses</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {studentCourses.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {studentCourses.map((course: Course) => (
                          <div key={course.course_id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="font-bold text-indigo-700">{course.name}</p>
                              <p className="text-sm text-gray-500">{course.code}</p>
                            </div>
                            <div className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs rounded-full font-medium">
                              Active
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No courses assigned to this student.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">Performance Metrics</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-medium">Current GPA:</span>
                      <span className="text-xl font-bold text-blue-600">{student.gpa?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-medium">Attendance:</span>
                      <span className="text-xl font-bold text-green-600">{student.attendance_percentage?.toFixed(1) || 'N/A'}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Enrollment Date:</span>
                      <span>{formattedEnrollmentDate}</span>
                    </div>
                  </div>

                  {student.performance_notes && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">Academic Notes</h3>
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                        <p className="text-amber-800 text-sm">{student.performance_notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">Basic Details</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><span className="font-medium">Email:</span> {displayEmail}</p>
                    <p><span className="font-medium">Phone:</span> {student.phone || 'Not specified'}</p>
                    <p><span className="font-medium">Gender:</span> {student.gender || 'Not specified'}</p>
                    <p><span className="font-medium">Blood Group:</span> {student.blood_group || 'Not specified'}</p>
                    <p><span className="font-medium">Date of Birth:</span> {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'Not specified'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">Guardian Information</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><span className="font-medium">Guardian Name:</span> {student.father_guardian || student.guardian_name || 'Not specified'}</p>
                    <p><span className="font-medium">Guardian Contact:</span> {student.guardian_contact || 'Not specified'}</p>
                    <p><span className="font-medium">Address:</span> {student.address || 'Not specified'}</p>
                    <p><span className="font-medium">Registration No:</span> {student.registration_number || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default EnhancedStudentProfile;
