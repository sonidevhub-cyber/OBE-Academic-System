import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api/api';
import { Users, UserPlus, UserCheck, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

interface Coordinator {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  department_name: string;
  can_act_as_instructor: boolean;
  is_active: boolean;
  created_at: string;
}

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

const HODCoordinatorManagementModule: React.FC = () => {
  const [showInstructors, setShowInstructors] = useState(true);
  const [showCoordinators, setShowCoordinators] = useState(false);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  console.log('HODCoordinatorManagementModule loaded');
  console.log('Coordinators state:', coordinators);
  console.log('Instructors state:', instructors);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching coordinator management data...');
      
      // Fetch coordinators and instructors
      const coordinatorsRes = await api.get('coordinators/api/hod-management/department_coordinators/');
      const instructorsRes = await api.get('coordinators/api/hod-management/department_instructors/');
      
      console.log('Coordinators response:', coordinatorsRes.data);
      console.log('Instructors response:', instructorsRes.data);
      
      setCoordinators(coordinatorsRes.data || []);
      setInstructors(instructorsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      // Set empty arrays on error to prevent undefined issues
      setCoordinators([]);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteInstructor = async (instructorId: number, canActAsInstructor: boolean) => {
    try {
      await api.post('coordinators/api/hod-management/promote_instructor_to_coordinator/', {
        instructor_id: instructorId,
        can_act_as_instructor: canActAsInstructor
      });
      fetchData();
      setShowPromoteModal(false);
      setShowCoordinators(true); // Switch to coordinators tab to show the new coordinator
    } catch (error) {
      console.error('Error promoting instructor:', error);
      alert('Failed to promote instructor');
    }
  };

  const handleToggleInstructorRole = async (coordinatorId: number) => {
    try {
      await api.post(`coordinators/api/hod-management/${coordinatorId}/toggle_instructor_permission/`);
      fetchData();
    } catch (error) {
      console.error('Error toggling instructor role:', error);
    }
  };

  const handleRemoveCoordinator = async (coordinatorId: number) => {
    if (!window.confirm('Are you sure you want to remove this coordinator?')) return;
    
    try {
      await api.delete(`coordinators/api/hod-management/${coordinatorId}/remove_coordinator/`);
      fetchData();
    } catch (error) {
      console.error('Error removing coordinator:', error);
    }
  };

  if (loading) return <div className="p-4">Loading coordinator management...</div>;

  return (
    <div className="space-y-6">
      {/* Header with Collapsible Tabs */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setShowInstructors(!showInstructors)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showInstructors
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="inline-block w-4 h-4 mr-2" />
            Instructors ({instructors.length})
          </button>
          <button
            onClick={() => setShowCoordinators(!showCoordinators)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showCoordinators
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserCheck className="inline-block w-4 h-4 mr-2" />
            Coordinators ({coordinators.length})
          </button>
        </div>
        
        <div className="space-x-2">
          <button
            onClick={async () => {
              try {
                const response = await api.get('coordinators/api/hod-management/department_coordinators/');
                console.log('Department coordinators response:', response.data);
                alert(`Found ${response.data.length} coordinators. Check console for details.`);
              } catch (error) {
                console.error('Department coordinators error:', error);
                alert('Department coordinators failed. Check console.');
              }
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Test Department Coordinators
          </button>
          <button
            onClick={async () => {
              try {
                const response = await api.get('coordinators/api/hod-management/check_user_role/');
                console.log('User role check:', response.data);
                alert(`User role: ${response.data.user_role}, Has HOD profile: ${response.data.has_hod_profile}`);
              } catch (error) {
                console.error('User role check error:', error);
                alert('User role check failed. Check console.');
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Check User Role
          </button>
          {showInstructors && (
            <button
              onClick={() => setShowPromoteModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Promote to Coordinator
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Create New Coordinator
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">{instructors.length}</div>
          <div className="text-gray-600">Total Instructors</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{coordinators.length}</div>
          <div className="text-gray-600">Total Coordinators</div>
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

      {/* Collapsible Content Sections */}
      {showInstructors && (
        <InstructorsTab 
          instructors={instructors}
          onPromote={() => setShowPromoteModal(true)}
        />
      )}
      
      {showCoordinators && (
        <CoordinatorsTab 
          coordinators={coordinators}
          onToggleInstructorRole={handleToggleInstructorRole}
          onRemove={handleRemoveCoordinator}
        />
      )}

      {/* Modals */}
      {showPromoteModal && (
        <PromoteInstructorModal
          instructors={instructors}
          onSubmit={handlePromoteInstructor}
          onClose={() => setShowPromoteModal(false)}
        />
      )}

      {showCreateModal && (
        <CreateCoordinatorModal
          onSubmit={async (data) => {
            try {
              const res = await api.post('coordinators/api/hod-management/create_new_coordinator/', data);
              const createdEmployeeId = res?.data?.employee_id;
              if (createdEmployeeId) {
                alert(`Coordinator created successfully!\nEmployee ID: ${createdEmployeeId}`);
              } else {
                alert('Coordinator created successfully!');
              }
              fetchData();
              setShowCreateModal(false);
              setShowCoordinators(true);
            } catch (error) {
              console.error('Error creating coordinator:', error);
              alert('Failed to create coordinator');
            }
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

// Instructors Tab Component
const InstructorsTab: React.FC<{
  instructors: Instructor[];
  onPromote: () => void;
}> = ({ instructors, onPromote }) => {
  return (
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
                        onClick={onPromote}
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
  );
};

// Coordinators Tab Component
const CoordinatorsTab: React.FC<{
  coordinators: Coordinator[];
  onToggleInstructorRole: (id: number) => void;
  onRemove: (id: number) => void;
}> = ({ coordinators, onToggleInstructorRole, onRemove }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Current Coordinators</h3>
        <p className="text-sm text-gray-500">
          Manage coordinator permissions and roles.
        </p>
      </div>
      
      {coordinators.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No coordinators found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Employee ID</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Can Act as Instructor</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coordinators.map((coordinator) => (
                <motion.tr
                  key={coordinator.id}
                  className="border-t hover:bg-gray-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <td className="px-4 py-3 font-medium">{coordinator.name}</td>
                  <td className="px-4 py-3">{coordinator.employee_id}</td>
                  <td className="px-4 py-3">{coordinator.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded-full text-xs mr-2 ${
                        coordinator.can_act_as_instructor 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {coordinator.can_act_as_instructor ? 'Yes' : 'No'}
                      </span>
                      {coordinator.can_act_as_instructor && (
                        <span className="text-xs text-blue-600 font-medium">Dual Role</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(coordinator.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onToggleInstructorRole(coordinator.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        title="Toggle instructor permission"
                      >
                        {coordinator.can_act_as_instructor ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(coordinator.id)}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center"
                        title="Remove coordinator"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
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

  // Filter out instructors who are already coordinators
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
            {availableInstructors.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">All instructors are already coordinators</p>
            )}
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
              disabled={availableInstructors.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Promote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Coordinator Modal
const CreateCoordinatorModal: React.FC<{
  onSubmit: (data: any) => void;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    specialization: '',
    experience_years: 0,
    can_act_as_instructor: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Create New Coordinator</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Specialization</label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Experience Years</label>
            <input
              type="number"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border rounded-md"
              min="0"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="createCanActAsInstructor"
              checked={formData.can_act_as_instructor}
              onChange={(e) => setFormData({ ...formData, can_act_as_instructor: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="createCanActAsInstructor" className="text-sm">
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
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HODCoordinatorManagementModule;
