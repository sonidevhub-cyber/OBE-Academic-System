import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../api/api';
import { UserCheck, UserPlus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

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

const HODCoordinatorOnlyModule: React.FC = () => {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoordinators();
  }, []);

  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      const response = await api.get('coordinators/hod-management/department_coordinators/');
      setCoordinators(response.data || []);
    } catch (error) {
      console.error('Error fetching coordinators:', error);
      setCoordinators([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInstructorRole = async (coordinatorId: number) => {
    try {
      await api.post(`coordinators/hod-management/${coordinatorId}/toggle_instructor_permission/`);
      fetchCoordinators();
    } catch (error) {
      console.error('Error toggling instructor role:', error);
    }
  };

  const handleRemoveCoordinator = async (coordinatorId: number) => {
    if (!window.confirm('Are you sure you want to remove this coordinator?')) return;
    
    try {
      await api.delete(`coordinators/hod-management/${coordinatorId}/remove_coordinator/`);
      fetchCoordinators();
    } catch (error) {
      console.error('Error removing coordinator:', error);
    }
  };

  if (loading) return <div className="p-4">Loading coordinators...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Coordinator Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Create New Coordinator
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-600">{coordinators.length}</div>
          <div className="text-gray-600">Total Coordinators</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-purple-600">
            {coordinators.filter(c => c.can_act_as_instructor).length}
          </div>
          <div className="text-gray-600">Dual Role (Coord + Instr)</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-600">
            {coordinators.filter(c => c.is_active).length}
          </div>
          <div className="text-gray-600">Active Coordinators</div>
        </div>
      </div>

      {/* Coordinators Table */}
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
                          onClick={() => handleToggleInstructorRole(coordinator.id)}
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
                          onClick={() => handleRemoveCoordinator(coordinator.id)}
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCoordinatorModal
          onSubmit={async (data) => {
            try {
              await api.post('coordinators/hod-management/create_new_coordinator/', data);
              fetchCoordinators();
              setShowCreateModal(false);
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

// Create Coordinator Modal
const CreateCoordinatorModal: React.FC<{
  onSubmit: (data: any) => void;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    employee_id: '',
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
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          
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
            <label className="block text-sm font-medium mb-1">Employee ID</label>
            <input
              type="text"
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
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

export default HODCoordinatorOnlyModule;