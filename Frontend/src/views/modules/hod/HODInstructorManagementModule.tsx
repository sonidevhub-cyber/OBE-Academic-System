import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../api/api';

interface Instructor {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  specialization: string;
  experience_years: number;
  is_coordinator: boolean;
}

const HODInstructorManagementModule: React.FC = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await api.get('coordinators/hod-management/department_instructors/');
      setInstructors(response.data || []);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading instructors...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Instructor Management</h2>
        <div className="text-sm text-gray-500">
          Total Instructors: {instructors.length}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{instructors.length}</div>
          <div className="text-gray-600">Total Instructors</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">
            {instructors.filter(i => i.is_coordinator).length}
          </div>
          <div className="text-gray-600">Also Coordinators</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            {instructors.filter(i => !i.is_coordinator).length}
          </div>
          <div className="text-gray-600">Instructors Only</div>
        </div>
      </div>

      {/* Instructors List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">All Department Instructors</h3>
        
        {instructors.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No instructors found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Employee ID</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Specialization</th>
                  <th className="px-4 py-2 text-left">Experience</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {instructors.map((instructor) => (
                  <motion.tr
                    key={instructor.id}
                    className="border-t hover:bg-gray-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <td className="px-4 py-3 font-medium">{instructor.name || 'N/A'}</td>
                    <td className="px-4 py-3">{instructor.employee_id || 'N/A'}</td>
                    <td className="px-4 py-3">{instructor.email || 'N/A'}</td>
                    <td className="px-4 py-3">{instructor.specialization || 'N/A'}</td>
                    <td className="px-4 py-3">{instructor.experience_years || 0} years</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col space-y-1">
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 w-fit">
                          Instructor
                        </span>
                        {instructor.is_coordinator && (
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 w-fit">
                            Also Coordinator
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HODInstructorManagementModule;