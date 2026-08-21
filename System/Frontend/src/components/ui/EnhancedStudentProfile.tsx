import React, { useState, useEffect } from 'react';
import { studentService } from '../../api/apiService';
import { getDisplayName, getProfileImageUrl } from '../../utils/profileHelpers';

interface EnhancedStudentProfileProps {
  studentId?: string | number;
  onClose?: () => void;
}

interface Course {
  course_id?: string | number;
  id?: string | number;
  name: string;
  code: string;
  description?: string;
  credit_hours?: number;
  semester_no?: number;
}

interface Student {
  student_id: string | number;
  name: string;
  full_name?: string;
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
    start_year?: number;
    end_year?: number;
    current_semester?: number;
    session_type?: string;
    program_name?: string;
    program_code?: string;
    program?: { name?: string; code?: string };
  };
  semester?: {
    id?: string | number;
    semester_id?: string | number;
    name?: string;
    semester_code?: string;
    number?: number;
  } | null;
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
  cgpa?: number;
  academic_status?: string;
  status?: string;
  performance_notes?: string;
  enrollment_date?: string;
  created_at?: string;
  date_joined?: string;
  current_semester?: number | null;
  batch_current_semester?: number | null;
  batch_start_year?: number | null;
  batch_end_year?: number | null;
  promotion_status?: string;
}

const PROMOTION_LABELS: Record<string, string> = {
  provisional: 'Provisional',
  confirmed: 'Confirmed',
  repeat: 'Repeat',
  freeze: 'Freeze',
};

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== '';

const formatGpa = (value?: number | null): string | null => {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
};

const formatAttendance = (value?: number | null): string | null => {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : null;
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  bordered?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, valueClassName = '', bordered = true }) => (
  <div className={`flex justify-between items-center gap-4 ${bordered ? 'border-b pb-2' : ''}`}>
    <span className="font-medium text-gray-700">{label}</span>
    <span className={valueClassName}>{value}</span>
  </div>
);



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

  const displayName = student.full_name || getDisplayName(student, 'Student');
  const imageUrl = getProfileImageUrl(student);
  const displayEmail = student.user_email || student.email || 'No email provided';
  const displayId = student.registration_number || student.custom_id || student.student_id;

  const batchObj = student.batch_details || (typeof student.batch === 'object' ? student.batch : null);
  const rawBatch = student.batch_name || batchObj?.name || (typeof student.batch === 'string' ? student.batch : null);

  const semesterNumber = student.current_semester ?? batchObj?.current_semester ?? student.batch_current_semester;
  const currentSemesterLabel = student.semester?.name
    ?? (hasValue(semesterNumber) ? `Semester ${semesterNumber}` : null);
  const semesterCode = student.semester?.semester_code || null;

  const rawPromotion = student.academic_status || student.promotion_status || student.status;
  const promotionStatus = rawPromotion && rawPromotion !== 'none'
    ? (PROMOTION_LABELS[rawPromotion] || rawPromotion.replace(/_/g, ' '))
    : null;

  const batchDuration = (student.batch_start_year ?? batchObj?.start_year) && (student.batch_end_year ?? batchObj?.end_year)
    ? `${student.batch_start_year ?? batchObj?.start_year} - ${student.batch_end_year ?? batchObj?.end_year}`
    : null;

  let pName = student.program_name ||
    student.program_details?.name ||
    (typeof student.program === 'object' ? student.program?.name : null) ||
    student.program_info?.name ||
    batchObj?.program_name ||
    batchObj?.program?.name;

  if (!pName && rawBatch && rawBatch.includes('-')) {
    pName = rawBatch.split('-')[0];
  }

  const programName = pName || null;
  const programCode =
    student.program_code ||
    student.program_details?.code ||
    (typeof student.program === 'object' ? student.program?.code : null) ||
    student.program_info?.code ||
    batchObj?.program_code ||
    batchObj?.program?.code ||
    null;

  const studentCourses =
    student.enrolled_courses ||
    student.courses ||
    (student as any).assigned_courses ||
    (student as any).academic_records?.courses ||
    (student as any).enrollment?.courses ||
    batchObj?.courses ||
    [];

  const gpaDisplay = formatGpa(student.cgpa ?? student.gpa);
  const attendanceDisplay = formatAttendance(student.attendance_percentage);

  const rawDate = student.enrollment_date || student.created_at || student.date_joined || (student as any).admission_date;
  const formattedEnrollmentDate = rawDate
    ? new Date(rawDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const programDetails: Array<{ label: string; value: React.ReactNode }> = [
    programName && { label: 'Program Name', value: programName },
    programCode && { label: 'Program Code', value: programCode },
    rawBatch && { label: 'Batch', value: rawBatch },
    batchDuration && { label: 'Batch Duration', value: batchDuration },
    currentSemesterLabel && { label: 'Current Semester', value: currentSemesterLabel },
    semesterCode && { label: 'Semester Code', value: semesterCode },
    student.registration_number && { label: 'Registration No', value: student.registration_number },
  ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>;

  const academicStatusItems: Array<{ label: string; value: React.ReactNode; valueClassName?: string }> = [
    gpaDisplay && { label: 'GPA / CGPA', value: gpaDisplay, valueClassName: 'text-xl font-bold text-indigo-600' },
    attendanceDisplay && { label: 'Attendance', value: attendanceDisplay, valueClassName: 'text-xl font-bold text-emerald-600' },
    promotionStatus && { label: 'Promotion Status', value: promotionStatus, valueClassName: 'text-xl font-bold text-green-600 capitalize' },
    formattedEnrollmentDate && { label: 'Record Created', value: formattedEnrollmentDate },
  ].filter(Boolean) as Array<{ label: string; value: React.ReactNode; valueClassName?: string }>;

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
              
              <div className={`grid grid-cols-1 gap-6 ${
                [currentSemesterLabel, rawBatch, studentCourses.length > 0, gpaDisplay || attendanceDisplay].filter(Boolean).length >= 3
                  ? 'md:grid-cols-2 xl:grid-cols-4'
                  : 'md:grid-cols-2'
              }`}>
                {currentSemesterLabel && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-600 text-sm font-medium">Current Semester</p>
                        <p className="text-3xl font-bold text-blue-900">{currentSemesterLabel}</p>
                        {promotionStatus && (
                          <p className="text-xs text-blue-700 mt-1">Promotion: {promotionStatus}</p>
                        )}
                      </div>
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {rawBatch && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-600 text-sm font-medium">Batch</p>
                        <p className="text-2xl font-bold text-green-900">{rawBatch}</p>
                        {(programCode || programName) && (
                          <p className="text-xs text-green-700 mt-1">
                            {[programCode, programName].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {studentCourses.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                    <div className="flex flex-col h-full">
                      <p className="text-purple-600 text-sm font-medium mb-3">Curriculum Courses</p>
                      <div className="space-y-2 overflow-y-auto pr-2 max-h-40 custom-scrollbar">
                        {studentCourses.map((course: Course) => (
                          <div key={course.course_id || course.id || course.code} className="flex items-center gap-2 bg-white/50 p-2 rounded border border-purple-200">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-semibold text-purple-900 truncate">{course.code} · {course.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(gpaDisplay || attendanceDisplay) && (
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl">
                    <div className="flex flex-col h-full justify-between">
                      {gpaDisplay && (
                        <div>
                          <p className="text-amber-600 text-sm font-medium">GPA / CGPA</p>
                          <p className="text-3xl font-bold text-amber-900">{gpaDisplay}</p>
                        </div>
                      )}
                      {attendanceDisplay && (
                        <p className={`text-xs text-amber-700 ${gpaDisplay ? 'mt-3' : ''}`}>
                          Attendance: {attendanceDisplay}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Academic Information</h2>
              
              <div className={`grid grid-cols-1 gap-6 ${academicStatusItems.length > 0 ? 'md:grid-cols-2' : ''}`}>
                <div className="space-y-4">
                  {programDetails.length > 0 && (
                    <>
                      <h3 className="text-lg font-semibold text-gray-700">Program Details</h3>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        {programDetails.map(({ label, value }) => (
                          <p key={label}>
                            <span className="font-medium">{label}:</span> {value}
                          </p>
                        ))}
                      </div>
                    </>
                  )}

                  <h3 className="text-lg font-semibold text-gray-700 mt-6">Assigned Courses</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {studentCourses.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {studentCourses.map((course: Course) => (
                          <div key={course.course_id || course.id || course.code} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="font-bold text-indigo-700">{course.name}</p>
                              <p className="text-sm text-gray-500">
                                {course.code}
                                {course.semester_no ? ` · Semester ${course.semester_no}` : ''}
                                {course.credit_hours ? ` · ${course.credit_hours} CH` : ''}
                              </p>
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

                {academicStatusItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">Academic Status</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                      {academicStatusItems.map(({ label, value, valueClassName }, index) => (
                        <DetailRow
                          key={label}
                          label={label}
                          value={value}
                          valueClassName={valueClassName}
                          bordered={index < academicStatusItems.length - 1}
                        />
                      ))}
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
                )}
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
                    {student.phone && <p><span className="font-medium">Phone:</span> {student.phone}</p>}
                    {student.gender && <p><span className="font-medium">Gender:</span> {student.gender}</p>}
                    {student.blood_group && <p><span className="font-medium">Blood Group:</span> {student.blood_group}</p>}
                    {student.date_of_birth && (
                      <p><span className="font-medium">Date of Birth:</span> {new Date(student.date_of_birth).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>

                {(student.father_guardian || student.guardian_name || student.guardian_contact || student.address) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">Guardian Information</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      {(student.father_guardian || student.guardian_name) && (
                        <p><span className="font-medium">Guardian Name:</span> {student.father_guardian || student.guardian_name}</p>
                      )}
                      {student.guardian_contact && (
                        <p><span className="font-medium">Guardian Contact:</span> {student.guardian_contact}</p>
                      )}
                      {student.address && (
                        <p><span className="font-medium">Address:</span> {student.address}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
};

export default EnhancedStudentProfile;
