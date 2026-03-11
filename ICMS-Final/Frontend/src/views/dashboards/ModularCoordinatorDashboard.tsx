import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { coordinatorService } from '../../api/coordinatorService';
import { multiRoleService } from '../../api/multiRoleService';
import CoordinatorOBEModule from '../modules/CoordinatorOBEModule';
import UniversalRoleSwitcher from '../../components/UniversalRoleSwitcher';
import TopbarProfileMenu from '../../components/TopbarProfileMenu';
import CoordinatorAttendanceDashboard from '../../components/attendance/CoordinatorAttendanceDashboard';

type TabId = 'dashboard' | 'attendance' | 'allocations' | 'timetable' | 'obe';
type AllocationTab = 'new' | 'approved' | 'pending' | 'rejected';
type TimetableTab = 'create' | 'pending' | 'approved' | 'rejected';

const CreateAllocationModal: React.FC<{
  semesters: any[];
  courses: any[];
  instructors: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  onSemesterChange: (semesterId: number) => void;
}> = ({ semesters, courses, instructors, onClose, onSubmit, onSemesterChange }) => {
  const [formData, setFormData] = useState({
    semester: '',
    course: '',
    instructor: '',
    comments: ''
  });

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const semesterId = e.target.value;
    setFormData({ ...formData, semester: semesterId, course: '' });
    if (semesterId) {
      onSemesterChange(parseInt(semesterId));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">New Course Allocation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={formData.semester}
              onChange={handleSemesterChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select Semester</option>
              {semesters.map(semester => (
                <option key={semester.semester_id || semester.id} value={semester.semester_id || semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
            <select
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select Course</option>
              {courses.length > 0 ? courses.map(course => (
                <option key={course.course_id} value={course.course_id}>
                  {course.name} ({course.code})
                </option>
              )) : (
                <option value="" disabled>Select semester first</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Instructor</label>
            <select
              value={formData.instructor}
              onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select Instructor</option>
              {instructors.map(instructor => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name} - {instructor.specialization}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments for HOD</label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Optional comments..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
            >
              Create Allocation
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const SemesterTimetableModal: React.FC<{
  semester: any;
  allocations: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}> = ({ semester, allocations, onClose, onSubmit }) => {
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  const addTimeSlot = (allocationId: number) => {
    setTimetableSlots([...timetableSlots, {
      allocation_id: allocationId,
      day: '',
      start_time: '',
      end_time: '',
      room_name: ''
    }]);
  };

  const updateTimeSlot = (index: number, field: string, value: string) => {
    const updated = [...timetableSlots];
    updated[index] = { ...updated[index], [field]: value };
    setTimetableSlots(updated);
    checkConflicts(updated);
  };

  const checkConflicts = (slots: any[]) => {
    const conflictList: string[] = [];
    
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];
        
        if (slot1.day === slot2.day && slot1.room_name === slot2.room_name) {
          const start1 = slot1.start_time;
          const end1 = slot1.end_time;
          const start2 = slot2.start_time;
          const end2 = slot2.end_time;
          
          if ((start1 < end2 && end1 > start2)) {
            conflictList.push(`Room conflict: ${slot1.room_name} on ${slot1.day}`);
          }
        }
        
        // Check instructor conflicts
        const alloc1 = allocations.find(a => a.allocation_id === slot1.allocation_id);
        const alloc2 = allocations.find(a => a.allocation_id === slot2.allocation_id);
        
        if (alloc1?.instructor === alloc2?.instructor && slot1.day === slot2.day) {
          const start1 = slot1.start_time;
          const end1 = slot1.end_time;
          const start2 = slot2.start_time;
          const end2 = slot2.end_time;
          
          if ((start1 < end2 && end1 > start2)) {
            conflictList.push(`Instructor conflict: ${alloc1.instructor_name} on ${slot1.day}`);
          }
        }
      }
    }
    
    setConflicts(Array.from(new Set(conflictList)));
  };

  const handleSubmit = () => {
    if (conflicts.length > 0) {
      alert('Please resolve all conflicts before submitting');
      return;
    }
    
    const semesterTimetable = {
      semester_id: semester?.semester_id || semester?.id,
      timetable_slots: timetableSlots
    };
    
    onSubmit(semesterTimetable);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create Semester Timetable</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 p-4 bg-purple-50 rounded-lg">
          <h3 className="font-semibold text-purple-900">{semester?.name || 'Unknown Semester'}</h3>
          <p className="text-sm text-purple-700">{allocations.length} courses to schedule</p>
        </div>

        {conflicts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-900 mb-2">Conflicts Detected:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {conflicts.map((conflict, index) => (
                <li key={index}>• {conflict}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {allocations.map((allocation) => {
            const slots = timetableSlots.filter(s => s.allocation_id === allocation.allocation_id);
            
            return (
              <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold">{allocation.course_name}</h4>
                    <p className="text-sm text-gray-600">{allocation.course_code} - {allocation.instructor_name}</p>
                  </div>
                  <button
                    onClick={() => addTimeSlot(allocation.allocation_id)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                  >
                    Add Time Slot
                  </button>
                </div>
                
                {slots.map((slot, index) => {
                  const slotIndex = timetableSlots.findIndex(s => s === slot);
                  return (
                    <div key={index} className="grid grid-cols-5 gap-3 mb-3 p-3 bg-gray-50 rounded">
                      <select
                        value={slot.day}
                        onChange={(e) => updateTimeSlot(slotIndex, 'day', e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">Day</option>
                        {days.map(day => <option key={day} value={day}>{day}</option>)}
                      </select>
                      
                      <select
                        value={slot.start_time}
                        onChange={(e) => updateTimeSlot(slotIndex, 'start_time', e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">Start</option>
                        {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                      
                      <select
                        value={slot.end_time}
                        onChange={(e) => updateTimeSlot(slotIndex, 'end_time', e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">End</option>
                        {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                      
                      <input
                        type="text"
                        value={slot.room_name}
                        onChange={(e) => updateTimeSlot(slotIndex, 'room_name', e.target.value)}
                        placeholder="Room"
                        className="px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-purple-500"
                        required
                      />
                      
                      <button
                        onClick={() => setTimetableSlots(timetableSlots.filter((_, i) => i !== slotIndex))}
                        className="bg-red-50 text-red-700 px-2 py-1 rounded text-sm hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={conflicts.length > 0 || timetableSlots.length === 0}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Semester Timetable to HOD
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ModularCoordinatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('allocations');
  const [allocationTab, setAllocationTab] = useState<AllocationTab>('new');
  const [timetableTab, setTimetableTab] = useState<TimetableTab>('create');
  const [isAllocationMenuOpen, setIsAllocationMenuOpen] = useState(true);
  const [isTimetableMenuOpen, setIsTimetableMenuOpen] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSemesterForCourses, setSelectedSemesterForCourses] = useState<number | null>(null);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [selectedAllocationForTimetable, setSelectedAllocationForTimetable] = useState<any>(null);

  const fetchAllocations = async () => {
    try {
      // Use effective role for API calls
      const effectiveRole = currentUser?.active_role || currentUser?.role;
      console.log('Using effective role for API:', effectiveRole);
      
      const response = await coordinatorService.getCourseAllocations();
      setAllocations(response.data || []);
    } catch (error: any) {
      console.error('Error fetching allocations:', error);
      setAllocations([]);
    }
  };

  const fetchData = async () => {
    try {
      setLocalLoading(true);
      const [semestersRes, instructorsRes] = await Promise.all([
        coordinatorService.getSemesters(),
        coordinatorService.getInstructors()
      ]);
      
      console.log('Semesters data:', semestersRes.data);
      console.log('Semesters count:', semestersRes.data?.length || 0);
      setSemesters(semestersRes.data || []);
      setInstructors(instructorsRes.data || []);
      
      // Refresh allocations
      await fetchAllocations();
      await fetchTimetables();
    } catch (error) {
      console.error('Error fetching data:', error);
      setSemesters([]);
      setInstructors([]);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    const switchToCoordinatorRole = async () => {
      try {
        const effectiveRole = currentUser?.active_role || currentUser?.role;
        if (effectiveRole !== 'coordinator') {
          // Check if user has coordinator role or try to enable it
          if (currentUser?.roles?.includes('coordinator')) {
            console.log('Switching to coordinator role...');
            await multiRoleService.switchRole('coordinator');
            window.location.reload();
            return;
          } else {
            console.log('User does not have coordinator role, proceeding with current role');
          }
        }
        
        fetchData();
        
        const interval = setInterval(() => {
          fetchAllocations();
          fetchTimetables();
        }, 5000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error switching role:', error);
        fetchData();
      }
    };
    
    switchToCoordinatorRole();
  }, []);

  const fetchCourses = async (semesterId: number) => {
    try {
      const coursesRes = await coordinatorService.getCourses(semesterId);
      setCourses(coursesRes.data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    }
  };

  const fetchTimetables = async () => {
    try {
      const response = await coordinatorService.getTimetableProposals();
      setTimetables(response.data || []);
    } catch (error) {
      console.error('Error fetching timetables:', error);
      setTimetables([]);
    }
  };

  const handleCreateTimetable = (allocation: any) => {
    setSelectedAllocationForTimetable(allocation);
    setShowTimetableModal(true);
  };

  const createTimetable = async (semesterTimetableData: any) => {
    try {
      const effectiveRole = currentUser?.active_role || currentUser?.role;
      
      if (effectiveRole !== 'coordinator') {
        alert('Only coordinators can create timetable proposals');
        return;
      }
      
      const response = await coordinatorService.createSemesterTimetable(semesterTimetableData);
      if (response.data) {
        await fetchTimetables();
        setShowTimetableModal(false);
        alert('Semester timetable created and sent to HOD for approval!');
      }
    } catch (error: any) {
      console.error('Error creating semester timetable:', error);
      alert('Error creating semester timetable: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteAllocation = async (allocationId: number) => {
    if (!window.confirm('Are you sure you want to delete this allocation?')) return;
    
    try {
      await coordinatorService.deleteCourseAllocation(allocationId);
      await fetchAllocations();
      alert('Allocation deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting allocation:', error);
      alert('Error deleting allocation: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleViewDetails = (allocation: any) => {
    setSelectedAllocation(allocation);
    setShowDetailsModal(true);
  };

  const createAllocation = async (formData: any) => {
    try {
      console.log('Form data before processing:', formData);
      
      // Ensure all values are properly converted to integers
      const semesterValue = Array.isArray(formData.semester) ? formData.semester[0] : formData.semester;
      const courseValue = Array.isArray(formData.course) ? formData.course[0] : formData.course;
      const instructorValue = Array.isArray(formData.instructor) ? formData.instructor[0] : formData.instructor;
      
      const payload = {
        semester: parseInt(semesterValue),
        course: parseInt(courseValue),
        instructor: parseInt(instructorValue),
        hod_comments: formData.comments || ''
      };
      
      console.log('Payload being sent:', payload);
      
      const response = await coordinatorService.createCourseAllocation(payload);
      
      if (response.data) {
        await fetchAllocations();
        setShowCreateModal(false);
        alert('Course allocation created successfully!');
      }
    } catch (error: any) {
      console.error('Error creating allocation:', error);
      alert('Error creating allocation: ' + (error.response?.data?.message || error.message));
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'attendance', label: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'obe', label: 'OBE Coordination', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
  ];

  const timetableSubTabs = [
    { 
      id: 'create', 
      label: 'Create Semester Timetable', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ), 
      count: 0 
    },
    { 
      id: 'pending', 
      label: 'Pending Approval', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), 
      count: timetables.filter((t: any) => t.status === 'submitted').length 
    },
    { 
      id: 'approved', 
      label: 'Approved', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ), 
      count: timetables.filter((t: any) => t.status === 'approved' || t.status === 'implemented').length 
    },
    { 
      id: 'rejected', 
      label: 'Rejected', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ), 
      count: timetables.filter((t: any) => t.status === 'rejected').length 
    }
  ];

  const allocationSubTabs = [
    { 
      id: 'new', 
      label: 'New Allocation', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ), 
      count: 0 
    },
    { 
      id: 'pending', 
      label: 'Pending Approval', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ), 
      count: allocations.filter((a: any) => a.status === 'proposed').length 
    },
    { 
      id: 'approved', 
      label: 'Approved', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ), 
      count: allocations.filter((a: any) => a.status === 'approved' || a.status === 'active').length 
    },
    { 
      id: 'rejected', 
      label: 'Rejected', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ), 
      count: allocations.filter((a: any) => a.status === 'rejected').length 
    }
  ];

  return (
    <div className="flex min-h-screen w-full bg-[#E8F5E8]">
      <div className='w-64 bg-gradient-to-b from-green-600 via-teal-700 to-blue-800 text-white p-4 space-y-2 min-h-screen shadow-xl flex flex-col'>
        <div className='mb-8 text-center'>
          <div className='h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30'>
            <svg xmlns="http://www.w3.org/2000/svg" className='h-10 w-10 text-white' viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-white'>Coordinator Portal</h3>
          <p className='text-xs text-green-200'>{currentUser?.first_name || currentUser?.name || currentUser?.username || 'Course Management'}</p>
        </div>

        <nav>
          <ul className='space-y-1'>
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`w-full flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id 
                      ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                      : 'text-green-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span>{tab.label}</span>
                </button>
              </li>
            ))}
            
            {/* Propose Allocation with expandable submenu */}
            <li>
              <button
                onClick={() => {
                  setActiveTab('allocations');
                  setIsAllocationMenuOpen(!isAllocationMenuOpen);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'allocations' 
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                    : 'text-green-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Propose Allocation</span>
                </div>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform duration-200 ${isAllocationMenuOpen ? 'rotate-90' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Submenu */}
              <AnimatePresence>
                {isAllocationMenuOpen && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-4 mt-1 space-y-1 overflow-hidden"
                  >
                    {allocationSubTabs.map((subTab) => (
                      <li key={subTab.id}>
                        <button
                          onClick={() => {
                            setActiveTab('allocations');
                            setAllocationTab(subTab.id as AllocationTab);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                            allocationTab === subTab.id
                              ? 'bg-white/15 text-white border-l-2 border-white'
                              : 'text-green-200 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-2">{subTab.icon}</span>
                            <span>{subTab.label}</span>
                          </div>
                          {subTab.count > 0 && (
                            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                              {subTab.count}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>

            {/* Timetable Management with expandable submenu */}
            <li>
              <button
                onClick={() => {
                  setActiveTab('timetable');
                  setIsTimetableMenuOpen(!isTimetableMenuOpen);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'timetable' 
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30' 
                    : 'text-green-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Timetable</span>
                </div>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform duration-200 ${isTimetableMenuOpen ? 'rotate-90' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              {/* Timetable Submenu */}
              <AnimatePresence>
                {isTimetableMenuOpen && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-4 mt-1 space-y-1 overflow-hidden"
                  >
                    {timetableSubTabs.map((subTab) => (
                      <li key={subTab.id}>
                        <button
                          onClick={() => {
                            setActiveTab('timetable');
                            setTimetableTab(subTab.id as TimetableTab);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                            timetableTab === subTab.id
                              ? 'bg-white/15 text-white border-l-2 border-white'
                              : 'text-green-200 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-2">{subTab.icon}</span>
                            <span>{subTab.label}</span>
                          </div>
                          {subTab.count > 0 && (
                            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">
                              {subTab.count}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          </ul>
        </nav>

        {/* Bottom section with role switch and logout */}
        <div className="mt-auto pt-4 border-t border-white/20">
          {/* Logout Button */}
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              navigate('/login');
            }}
            className="w-full flex items-center px-4 py-2 rounded-lg text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200"
          >
            <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex-1">
        <header className="bg-gradient-to-r from-green-600 via-teal-600 to-blue-700 p-6 shadow-xl border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white shadow-lg">
                <span className="text-lg font-semibold text-white">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Coordinator Dashboard'}
                </h1>
                <p className="text-green-100 text-sm">Department Coordination</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UniversalRoleSwitcher />
              <TopbarProfileMenu userData={currentUser} label="Coordinator" />
            </div>
          </div>
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'allocations' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 border border-green-100">
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-4">
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Course Allocation Management
                  </h1>
                  <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2">
                    {allocationSubTabs.map((subTab) => (
                      <button
                        key={subTab.id}
                        onClick={() => setAllocationTab(subTab.id as AllocationTab)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                          allocationTab === subTab.id
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span>{subTab.icon}</span>
                        <span>{subTab.label}</span>
                        {subTab.count > 0 && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            allocationTab === subTab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {subTab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {allocationTab === 'new' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">New Course Allocation</h2>
                      <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Create New
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="font-medium text-blue-900">Total Allocations</h3>
                        <p className="text-2xl font-bold text-blue-600">{allocations.length}</p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h3 className="font-medium text-yellow-900">Pending</h3>
                        <p className="text-2xl font-bold text-yellow-600">{allocations.filter(a => a.status === 'proposed').length}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h3 className="font-medium text-green-900">Approved</h3>
                        <p className="text-2xl font-bold text-green-600">{allocations.filter(a => a.status === 'approved').length}</p>
                      </div>
                    </div>
                  </div>
                )}

                {showCreateModal && (
                  <CreateAllocationModal
                    semesters={semesters}
                    courses={courses}
                    instructors={instructors}
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={createAllocation}
                    onSemesterChange={fetchCourses}
                  />
                )}

                {allocationTab === 'pending' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Pending Allocations</h2>
                    {allocations.filter(a => a.status === 'proposed').length > 0 ? (
                      <div className="space-y-4">
                        {allocations.filter(a => a.status === 'proposed').map((allocation) => (
                          <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{allocation.course_name}</h3>
                                <p className="text-sm text-gray-600">{allocation.course_code}</p>
                                <p className="text-sm text-gray-600">Instructor: {allocation.instructor_name}</p>
                                <p className="text-sm text-gray-500">Proposed: {new Date(allocation.proposed_at).toLocaleString()}</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleViewDetails(allocation)}
                                  className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-sm"
                                >
                                  View
                                </button>
                                <button 
                                  onClick={() => handleDeleteAllocation(allocation.allocation_id)}
                                  className="bg-red-50 text-red-700 px-3 py-1 rounded text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No pending allocations</p>
                    )}
                  </div>
                )}

                {allocationTab === 'approved' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Approved Allocations</h2>
                    {allocations.filter(a => a.status === 'approved' || a.status === 'active').length > 0 ? (
                      <div className="space-y-4">
                        {allocations.filter(a => a.status === 'approved' || a.status === 'active').map((allocation) => (
                          <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{allocation.course_name}</h3>
                                <p className="text-sm text-gray-600">{allocation.course_code}</p>
                                <p className="text-sm text-gray-600">Instructor: {allocation.instructor_name}</p>
                                {allocation.approved_at && (
                                  <p className="text-sm text-gray-500">Reviewed: {new Date(allocation.approved_at).toLocaleString()}</p>
                                )}
                                {allocation.hod_comments && (
                                  <p className="text-sm text-blue-700 mt-1">HOD Comments: {allocation.hod_comments}</p>
                                )}
                              </div>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                {allocation.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No approved allocations</p>
                    )}
                  </div>
                )}

                {allocationTab === 'rejected' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Rejected Allocations</h2>
                    {allocations.filter(a => a.status === 'rejected').length > 0 ? (
                      <div className="space-y-4">
                        {allocations.filter(a => a.status === 'rejected').map((allocation) => (
                          <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{allocation.course_name}</h3>
                                <p className="text-sm text-gray-600">{allocation.course_code}</p>
                                <p className="text-sm text-gray-600">Instructor: {allocation.instructor_name}</p>
                                {allocation.approved_at && (
                                  <p className="text-sm text-gray-500">Reviewed: {new Date(allocation.approved_at).toLocaleString()}</p>
                                )}
                                {allocation.rejection_reason && (
                                  <p className="text-sm text-red-600 mt-2">Reason: {allocation.rejection_reason}</p>
                                )}
                              </div>
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                                Rejected
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No rejected allocations</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timetable' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-4">
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Timetable Management
                  </h1>
                  <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2">
                    {timetableSubTabs.map((subTab) => (
                      <button
                        key={subTab.id}
                        onClick={() => setTimetableTab(subTab.id as TimetableTab)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                          timetableTab === subTab.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <span>{subTab.icon}</span>
                        <span>{subTab.label}</span>
                        {subTab.count > 0 && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            timetableTab === subTab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {subTab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {timetableTab === 'create' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">Create Semester Timetable</h2>
                      <select
                        value={selectedSemester || ''}
                        onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="">Select Semester</option>
                        {semesters.length === 0 ? (
                          <option value="" disabled>Loading semesters...</option>
                        ) : (
                          semesters.map(semester => (
                            <option key={semester.semester_id || semester.id} value={semester.semester_id || semester.id}>
                              {semester.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    
                    {selectedSemester && (
                      <div>
                        <div className="mb-4 p-4 bg-purple-50 rounded-lg">
                          <h3 className="font-semibold text-purple-900">Semester: {semesters.find(s => (s.semester_id || s.id) === selectedSemester)?.name}</h3>
                          <p className="text-sm text-purple-700">Approved Courses: {allocations.filter(a => (a.status === 'approved' || a.status === 'active') && a.semester === selectedSemester).length}</p>
                        </div>
                        
                        {allocations.filter(a => (a.status === 'approved' || a.status === 'active') && a.semester === selectedSemester).length > 0 ? (
                          <div>
                            <button 
                              onClick={() => setShowTimetableModal(true)}
                              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors mb-4"
                            >
                              Create Complete Semester Timetable
                            </button>
                            
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">Courses to Schedule:</h4>
                              {allocations.filter(a => (a.status === 'approved' || a.status === 'active') && a.semester === selectedSemester).map((allocation) => (
                                <div key={allocation.allocation_id} className="border border-gray-200 rounded-lg p-3">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <h5 className="font-medium">{allocation.course_name}</h5>
                                      <p className="text-sm text-gray-600">{allocation.course_code} - {allocation.instructor_name}</p>
                                    </div>
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                      Ready
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-8">No approved courses available for this semester</p>
                        )}
                      </div>
                    )}
                    
                    {!selectedSemester && (
                      <p className="text-gray-500 text-center py-8">Please select a semester to create timetable</p>
                    )}
                  </div>
                )}

                {showTimetableModal && selectedSemester && (
                  <SemesterTimetableModal
                    semester={semesters.find(s => (s.semester_id || s.id) === selectedSemester)}
                    allocations={allocations.filter(a => (a.status === 'approved' || a.status === 'active') && a.semester === selectedSemester)}
                    onClose={() => setShowTimetableModal(false)}
                    onSubmit={createTimetable}
                  />
                )}

                {timetableTab === 'pending' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Pending Timetables</h2>
                    {timetables.filter(t => t.status === 'submitted').length > 0 ? (
                      <div className="space-y-4">
                        {timetables.filter(t => t.status === 'submitted').map((timetable) => (
                          <div key={timetable.proposal_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{timetable.title}</h3>
                                <p className="text-sm text-gray-600">{timetable.description}</p>
                                <p className="text-sm text-gray-600">Semester: {timetable.semester_name}</p>
                              </div>
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                                Pending HOD Approval
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No pending timetables</p>
                    )}
                  </div>
                )}

                {timetableTab === 'approved' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Approved Timetables</h2>
                    {timetables.filter(t => t.status === 'approved' || t.status === 'implemented').length > 0 ? (
                      <div className="space-y-4">
                        {timetables.filter(t => t.status === 'approved' || t.status === 'implemented').map((timetable) => (
                          <div key={timetable.proposal_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{timetable.title}</h3>
                                <p className="text-sm text-gray-600">{timetable.description}</p>
                                <p className="text-sm text-gray-600">Semester: {timetable.semester_name}</p>
                                <p className="text-sm text-green-600">Approved by: {timetable.reviewed_by_name}</p>
                                {timetable.hod_comments && (
                                  <p className="text-sm text-gray-600 mt-1">Comments: {timetable.hod_comments}</p>
                                )}
                              </div>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                Approved
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No approved timetables</p>
                    )}
                  </div>
                )}

                {timetableTab === 'rejected' && (
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Rejected Timetables</h2>
                    {timetables.filter(t => t.status === 'rejected').length > 0 ? (
                      <div className="space-y-4">
                        {timetables.filter(t => t.status === 'rejected').map((timetable) => (
                          <div key={timetable.proposal_id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-semibold">{timetable.title}</h3>
                                <p className="text-sm text-gray-600">{timetable.description}</p>
                                <p className="text-sm text-gray-600">Semester: {timetable.semester_name}</p>
                                {timetable.hod_comments && (
                                  <p className="text-sm text-red-600 mt-1">Reason: {timetable.hod_comments}</p>
                                )}
                              </div>
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                                Rejected
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No rejected timetables</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'attendance' && (
              <CoordinatorAttendanceDashboard />
            )}

            {activeTab === 'dashboard' && (
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <h2 className="text-xl font-semibold mb-4">Coordinator Dashboard</h2>
                <p className="text-gray-600">Welcome to the coordinator portal. Use the tabs to manage course allocations and timetables.</p>
              </div>
            )}

            {activeTab === 'obe' && (
              <CoordinatorOBEModule coordinatorId={1} departmentId={1} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ModularCoordinatorDashboard;
