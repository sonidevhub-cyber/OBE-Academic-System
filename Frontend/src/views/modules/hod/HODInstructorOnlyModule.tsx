import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../api/api';
import { Users, UserPlus } from 'lucide-react';

interface Instructor {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  specialization: string;
  experience_years: number;
  is_coordinator: boolean;
  coordinator_info?: {
    id: number;
    can_act_as_instructor: boolean;
  };
}

const HODInstructorOnlyModule: React.FC = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
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

  const handlePromoteInstructor = async (instructorId: number, canActAsInstructor: boolean) => {
    try {
      await api.post('coordinators/hod-management/promote_instructor_to_coordinator/', {
        instructor_id: instructorId,
        can_act_as_instructor: canActAsInstructor
      });
      fetchInstructors();
      setShowPromoteModal(false);
    } catch (error) {
      console.error('Error promoting instructor:', error);
      alert('Failed to promote instructor');
    }
  };

  if (loading) return <div className="p-4">Loading instructors...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Instructor Management</h2>
        <button
          onClick={() => setShowPromoteModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Promote to Coordinator
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{instructors.length}</div>
          <div className="text-gray-600">Total Instructors</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            {instructors.filter(i => i.is_coordinator && i.coordinator_info?.can_act_as_instructor).length}
          </div>
          <div className="text-gray-600">Dual Role (Coord + Instr)</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-orange-500">
          <div className="text-2xl font-bold text-orange-600">
            {instructors.filter(i => !i.is_coordinator).length}
          </div>
          <div className="text-gray-600">Available for Promotion</div>
        </div>
      </div>

      {/* Instructors Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">All Department Instructors</h3>
          <p className="text-sm text-gray-500">
            All instructors in your department. Those who are also coordinators are marked.
          </p>
        </div>
        
        {instructors.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No instructors found in your department</p>
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
                  <th className="px-4 py-2 text-left">Actions</th>
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
                            Coordinator
                            {instructor.coordinator_info?.can_act_as_instructor && (
                              <span className="ml-1 text-purple-600">(Dual Role)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!instructor.is_coordinator ? (
                        <button
                          onClick={() => setShowPromoteModal(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Promote to Coordinator
                        </button>
                      ) : (
                        <span className="text-gray-500 text-sm">Already Coordinator</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Promote Modal */}
      {showPromoteModal && (
        <PromoteInstructorModal
          instructors={instructors}
          onSubmit={handlePromoteInstructor}
          onClose={() => setShowPromoteModal(false)}
        />
      )}
    </div>
  );
};

// Promote Instructor Modal
const PromoteInstructorModal: React.FC<{
  instructors: Instructor[];
  onSubmit: (instructorId: number, canActAsInstructor: boolean) => void;
  onClose: () => void;
}> = ({ instructors, onSubmit, onClose }) => {
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [canActAsInstructor, setCanActAsInstructor] = useState(false);

  const availableInstructors = instructors.filter(i => !i.is_coordinator);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInstructor) {
      onSubmit(parseInt(selectedInstructor), canActAsInstructor);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Promote Instructor to Coordinator</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Instructor</label>
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Choose an instructor</option>
              {availableInstructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name} - {instructor.specialization}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="canActAsInstructor"
              checked={canActAsInstructor}
              onChange={(e) => setCanActAsInstructor(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="canActAsInstructor" className="text-sm">
              Can also act as instructor (Dual Role)
            </label>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Promote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HODInstructorOnlyModule;