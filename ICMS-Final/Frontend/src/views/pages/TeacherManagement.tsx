import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { instructorService, departmentService, Instructor, Department } from '../../api/studentInstructorService';

// Extension of Instructor interface to include user information if needed locally
// Note: Ideally this should be updated in the service file
interface InstructorWithUser extends Instructor {
  user?: any;
}
import InstructorModal from '../../components/ui/modals/InstructorModal';
import InstructorProfileModal from '../../components/ui/modals/InstructorProfileModal';

// Extension of Instructor interface to include user information if needed locally
// Note: Ideally this should be updated in the service file
interface InstructorWithUser extends Instructor {
  user?: any;
}

// Utility function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

interface TeacherManagementProps {
  activeTab: string;
}

const TeacherManagement: React.FC<TeacherManagementProps> = ({ activeTab }) => {
  const [instructors, setInstructors] = useState<InstructorWithUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingInstructor, setEditingInstructor] = useState<InstructorWithUser | null>(null);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [viewingInstructor, setViewingInstructor] = useState<InstructorWithUser | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await instructorService.getAllInstructors();
      if (Array.isArray(response.data)) {
        setInstructors(response.data);
      } else {
        setInstructors([]);
        setError('Invalid data format received from server');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch instructors');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await departmentService.getAllDepartments();
      setDepartments(response.data);
    } catch (err: any) {
      console.error('Failed to fetch departments:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'instructors') {
      fetchInstructors();
      fetchDepartments();
    }
  }, [activeTab, fetchInstructors, fetchDepartments]);

  const handleInstructorDelete = useCallback(async (instructorId: string | number) => {
    if (window.confirm('Are you sure you want to delete this instructor?')) {
      try {
        await instructorService.deleteInstructor(instructorId);
        setInstructors(prev => prev.filter(instructor => String(instructor.id) !== String(instructorId)));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete instructor');
      }
    }
  }, []);

  const filteredInstructors = useMemo(() => {
    let filtered = instructors;
    
    if (selectedDepartment) {
      filtered = filtered.filter(instructor => 
        instructor.department_name === selectedDepartment
      );
    }
    
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(inst =>
        (inst.name && inst.name.toLowerCase().includes(lowerSearch)) ||
        (inst.department_name && inst.department_name.toLowerCase().includes(lowerSearch)) ||
        (inst.designation && inst.designation.toLowerCase().includes(lowerSearch)) ||
        (inst.employment_type && inst.employment_type.toLowerCase().includes(lowerSearch))
      );
    }
    
    return filtered;
  }, [searchTerm, selectedDepartment, instructors]);

  const instructorStats = useMemo(() => {
    const total = instructors.length;
    const byDepartment = instructors.reduce((acc, instructor) => {
      const deptName = instructor.department_name || 'Unassigned';
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgExperience = instructors.length > 0 
      ? instructors.reduce((sum, inst) => sum + (inst.experience_years || 0), 0) / instructors.length
      : 0;

    return { total, byDepartment, avgExperience };
  }, [instructors]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Instructors</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Search instructors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={selectedDepartment || ''}
            onChange={(e) => setSelectedDepartment(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {Object.keys(instructorStats.byDepartment).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditingInstructor(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Add Instructor
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Instructors</p>
              <p className="text-3xl font-bold text-blue-900">{instructors.length}</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 mb-1">Departments</p>
              <p className="text-3xl font-bold text-green-900">{Object.keys(instructorStats.byDepartment).length}</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-lg border border-purple-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 mb-1">
                {selectedDepartment ? selectedDepartment : 'Filtered Results'}
              </p>
              <p className="text-3xl font-bold text-purple-900">{filteredInstructors.length}</p>
            </div>
            <div className="p-3 bg-purple-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-lg border border-amber-200 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-1">Avg Experience</p>
              <p className="text-3xl font-bold text-amber-900">
                {instructorStats.avgExperience.toFixed(1)}y
              </p>
            </div>
            <div className="p-3 bg-amber-500 rounded-full shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {filteredInstructors.length} Instructors
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Instructor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Employment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Designation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">Experience</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInstructors.map((instructor) => (
                  <tr key={instructor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {instructor.image ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={typeof instructor.image === 'string' ? instructor.image : ''} alt={instructor.name || 'Instructor'} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {instructor.name ? instructor.name.charAt(0) : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{instructor.name || 'N/A'}</div>
                          <div className="text-sm text-gray-500 truncate">ID: {instructor.custom_id || instructor.id}</div>
                          <div className="text-sm text-gray-500">{(() => {
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
                            
                            // Clean and decode HTML entities
                            if (email && typeof email === 'string') {
                              email = email.replace(/[\[\]'"]/g, '');
                              email = decodeHtmlEntities(email);
                            }
                            
                            return email || 'N/A';
                          })()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instructor.department_name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instructor.employment_type ? instructor.employment_type.toLowerCase().replace(/^\w/, c => c.toUpperCase()) : 'Permanent'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instructor.designation || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instructor.experience_years ? `${instructor.experience_years} years` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setViewingInstructor(instructor);
                            setShowProfileModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors duration-200 border border-emerald-200"
                          title="View instructor profile"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Profile
                        </button>
                        <button
                          onClick={() => {
                            setEditingInstructor(instructor);
                            setShowModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors duration-200 border border-blue-200"
                          title="Edit instructor details"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleInstructorDelete(instructor.id!)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200 border border-red-200"
                          title="Remove instructor"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredInstructors.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No instructors found</p>
          </div>
        )}
      </div>

      {showProfileModal && viewingInstructor && (
        <InstructorProfileModal
          instructor={viewingInstructor}
          onClose={() => {
            setShowProfileModal(false);
            setViewingInstructor(null);
          }}
          departmentName={viewingInstructor.department_name || ''}
          isOpen={showProfileModal}
          onSuccess={() => {
            setShowProfileModal(false);
            setViewingInstructor(null);
          }}
        />
      )}

      {showModal && (
        <InstructorModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingInstructor(null);
          }}
          instructorId={editingInstructor?.id}
          onSuccess={() => {
            setShowModal(false);
            setEditingInstructor(null);
            fetchInstructors();
          }}
        />
      )}
    </div>
  );
};

export default React.memo(TeacherManagement);
