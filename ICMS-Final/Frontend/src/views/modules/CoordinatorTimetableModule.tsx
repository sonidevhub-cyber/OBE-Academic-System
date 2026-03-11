import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { coordinatorService, TimetableProposal, TimetableSlot } from '../../api/coordinatorService';

const CoordinatorTimetableModule: React.FC = () => {
  const [proposals, setProposals] = useState<TimetableProposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<TimetableProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<TimetableProposal | null>(null);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds to check for status updates
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [proposalsRes, semestersRes, coursesRes, instructorsRes] = await Promise.all([
        coordinatorService.getTimetableProposals(),
        coordinatorService.getSemesters(),
        coordinatorService.getCourses(),
        coordinatorService.getInstructors()
      ]);
      
      setProposals(proposalsRes.data);
      setSemesters(semestersRes.data);
      setCourses(coursesRes.data);
      setInstructors(instructorsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchData();
    if (selectedProposal) {
      fetchSlots(selectedProposal.proposal_id);
    }
  };

  const fetchSlots = async (proposalId: number) => {
    try {
      const response = await coordinatorService.getTimetableSlots(proposalId);
      setSlots(response.data);
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

  const handleCreateProposal = async (data: { semester: number; title: string; description: string }) => {
    try {
      await coordinatorService.createTimetableProposal(data);
      await refreshData(); // Refresh immediately after creation
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating proposal:', error);
    }
  };

  const handleSubmitToHOD = async (proposalId: number) => {
    try {
      await coordinatorService.submitProposalToHOD(proposalId);
      await refreshData(); // Refresh immediately after submission
    } catch (error) {
      console.error('Error submitting proposal:', error);
    }
  };

  const handleCreateSlot = async (data: any) => {
    if (!selectedProposal) return;
    
    try {
      await coordinatorService.createTimetableSlot({
        ...data,
        proposal_id: selectedProposal.proposal_id
      });
      fetchSlots(selectedProposal.proposal_id);
      setShowSlotModal(false);
    } catch (error) {
      console.error('Error creating slot:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'implemented': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFilteredProposals = () => {
    console.log('All proposals:', proposals);
    console.log('Status filter:', statusFilter);
    if (statusFilter === 'all') return proposals;
    const filtered = proposals.filter(p => p.status === statusFilter);
    console.log('Filtered proposals:', filtered);
    return filtered;
  };

  const getStatusCounts = () => {
    return {
      all: proposals.length,
      draft: proposals.filter(p => p.status === 'draft').length,
      submitted: proposals.filter(p => p.status === 'submitted').length,
      approved: proposals.filter(p => p.status === 'approved').length,
      implemented: proposals.filter(p => p.status === 'implemented').length,
      rejected: proposals.filter(p => p.status === 'rejected').length
    };
  };

  if (loading) return <div className="p-4">Loading timetable data...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Timetable Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={refreshData}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Proposal
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All', count: getStatusCounts().all },
            { key: 'draft', label: 'Draft', count: getStatusCounts().draft },
            { key: 'submitted', label: 'Submitted', count: getStatusCounts().submitted },
            { key: 'approved', label: 'Approved', count: getStatusCounts().approved },
            { key: 'implemented', label: 'Implemented', count: getStatusCounts().implemented },
            { key: 'rejected', label: 'Rejected', count: getStatusCounts().rejected }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Proposals List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">
          Timetable Proposals - {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
        </h3>
        {getFilteredProposals().length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No {statusFilter === 'all' ? '' : statusFilter} proposals found
          </p>
        ) : (
          <div className="space-y-4">
            {getFilteredProposals().map((proposal) => (
              <motion.div
                key={proposal.proposal_id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedProposal(proposal);
                  fetchSlots(proposal.proposal_id);
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{proposal.title}</h4>
                    <p className="text-sm text-gray-600">{proposal.semester_name}</p>
                    <p className="text-sm text-gray-500">{proposal.description}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                    {proposal.status === 'approved' && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ Approved by HOD
                      </span>
                    )}
                    {proposal.status === 'implemented' && (
                      <span className="text-xs text-purple-600 font-medium">
                        ✓ Successfully Implemented
                      </span>
                    )}
                    {proposal.status === 'rejected' && (
                      <span className="text-xs text-red-600 font-medium">
                        ✗ Rejected by HOD
                      </span>
                    )}
                    {proposal.status === 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubmitToHOD(proposal.proposal_id);
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        Submit to HOD
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Created: {new Date(proposal.created_at).toLocaleDateString()}
                  {proposal.submitted_at && (
                    <span className="ml-4">
                      Submitted: {new Date(proposal.submitted_at).toLocaleDateString()}
                    </span>
                  )}
                  {proposal.reviewed_at && (
                    <span className="ml-4">
                      Reviewed: {new Date(proposal.reviewed_at).toLocaleDateString()}
                    </span>
                  )}
                  {proposal.hod_comments && (
                    <div className="mt-1 text-xs text-gray-600">
                      <strong>HOD Comments:</strong> {proposal.hod_comments}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Proposal Details */}
      {selectedProposal && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{selectedProposal.title} - Time Slots</h3>
            {selectedProposal.status === 'draft' && (
              <button
                onClick={() => setShowSlotModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Time Slot
              </button>
            )}
          </div>

          {slots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No time slots added</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Day</th>
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Course</th>
                    <th className="px-4 py-2 text-left">Instructor</th>
                    <th className="px-4 py-2 text-left">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id} className="border-t">
                      <td className="px-4 py-2 capitalize">{slot.day}</td>
                      <td className="px-4 py-2">{slot.start_time} - {slot.end_time}</td>
                      <td className="px-4 py-2">{slot.course_name} ({slot.course_code})</td>
                      <td className="px-4 py-2">{slot.instructor_name || 'TBA'}</td>
                      <td className="px-4 py-2">{slot.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Proposal Modal */}
      {showCreateModal && (
        <CreateProposalModal
          semesters={semesters}
          onSubmit={handleCreateProposal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Create Slot Modal */}
      {showSlotModal && (
        <CreateSlotModal
          courses={courses}
          instructors={instructors}
          onSubmit={handleCreateSlot}
          onClose={() => setShowSlotModal(false)}
        />
      )}
    </div>
  );
};

// Create Proposal Modal Component
const CreateProposalModal: React.FC<{
  semesters: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
}> = ({ semesters, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    semester: '',
    title: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      semester: parseInt(formData.semester),
      title: formData.title,
      description: formData.description
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create Timetable Proposal</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Semester</label>
            <select
              value={formData.semester}
              onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select Semester</option>
              {semesters.map((semester) => (
                <option key={semester.semester_id} value={semester.semester_id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded-md"
              rows={3}
            />
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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Slot Modal Component
const CreateSlotModal: React.FC<{
  courses: any[];
  instructors: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
}> = ({ courses, instructors, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    course: '',
    instructor: '',
    day: '',
    start_time: '',
    end_time: '',
    room: ''
  });

  const days = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      course: parseInt(formData.course),
      instructor: formData.instructor ? parseInt(formData.instructor) : undefined,
      day: formData.day,
      start_time: formData.start_time,
      end_time: formData.end_time,
      room: formData.room
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Time Slot</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Course</label>
            <select
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructor</label>
            <select
              value={formData.instructor}
              onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Select Instructor (Optional)</option>
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Day</label>
            <select
              value={formData.day}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            >
              <option value="">Select Day</option>
              {days.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Room</label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="e.g., Room 101"
            />
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
              Add Slot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CoordinatorTimetableModule;