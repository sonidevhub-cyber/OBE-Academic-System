import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, BookOpen, User, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

const CoordinatorAllocationModule: React.FC = () => {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Set mock data immediately
    setAllocations([
      {
        allocation_id: 1,
        course_name: 'Data Structures',
        course_code: 'CS201',
        instructor_name: 'Dr. John Smith',
        semester_name: 'Semester 3',
        status: 'proposed',
        proposed_at: '2024-01-15T10:00:00Z'
      },
      {
        allocation_id: 2,
        course_name: 'Database Systems',
        course_code: 'CS301',
        instructor_name: 'Prof. Sarah Johnson',
        semester_name: 'Semester 5',
        status: 'approved',
        proposed_at: '2024-01-10T14:30:00Z'
      }
    ]);
    setSemesters([
      { semester_id: 1, name: 'Semester 1' },
      { semester_id: 2, name: 'Semester 2' },
      { semester_id: 3, name: 'Semester 3' },
      { semester_id: 4, name: 'Semester 4' },
      { semester_id: 5, name: 'Semester 5' }
    ]);
    setCourses([
      { course_id: 1, name: 'Data Structures', code: 'CS201', semester: 3 },
      { course_id: 2, name: 'Database Systems', code: 'CS301', semester: 5 },
      { course_id: 3, name: 'Web Development', code: 'CS401', semester: 7 },
      { course_id: 4, name: 'Machine Learning', code: 'CS501', semester: 8 }
    ]);
    setInstructors([
      { id: 1, name: 'Dr. John Smith', specialization: 'Computer Science' },
      { id: 2, name: 'Prof. Sarah Johnson', specialization: 'Database Systems' },
      { id: 3, name: 'Dr. Mike Wilson', specialization: 'Web Technologies' },
      { id: 4, name: 'Prof. Lisa Brown', specialization: 'Machine Learning' }
    ]);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      setAllocations([
        {
          allocation_id: 1,
          course_name: 'Data Structures',
          course_code: 'CS201',
          instructor_name: 'Dr. John Smith',
          semester_name: 'Semester 3',
          status: 'proposed',
          proposed_at: '2024-01-15T10:00:00Z'
        },
        {
          allocation_id: 2,
          course_name: 'Database Systems',
          course_code: 'CS301',
          instructor_name: 'Prof. Sarah Johnson',
          semester_name: 'Semester 5',
          status: 'approved',
          proposed_at: '2024-01-10T14:30:00Z'
        }
      ]);
      setSemesters([
        { semester_id: 1, name: 'Semester 1' },
        { semester_id: 2, name: 'Semester 2' },
        { semester_id: 3, name: 'Semester 3' },
        { semester_id: 4, name: 'Semester 4' },
        { semester_id: 5, name: 'Semester 5' }
      ]);
      setCourses([
        { course_id: 1, name: 'Data Structures', code: 'CS201', semester: 3 },
        { course_id: 2, name: 'Database Systems', code: 'CS301', semester: 5 },
        { course_id: 3, name: 'Web Development', code: 'CS401', semester: 7 },
        { course_id: 4, name: 'Machine Learning', code: 'CS501', semester: 8 }
      ]);
      setInstructors([
        { id: 1, name: 'Dr. John Smith', specialization: 'Computer Science' },
        { id: 2, name: 'Prof. Sarah Johnson', specialization: 'Database Systems' },
        { id: 3, name: 'Dr. Mike Wilson', specialization: 'Web Technologies' },
        { id: 4, name: 'Prof. Lisa Brown', specialization: 'Machine Learning' }
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'proposed': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'active': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'active': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filteredAllocations = allocations.filter(allocation => {
    const matchesSearch = allocation.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         allocation.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSemester = !selectedSemester || allocation.semester === selectedSemester;
    return matchesSearch && matchesSemester;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 border border-green-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="h-7 w-7 text-green-600 mr-3" />
              Course Allocation Management
            </h1>
            <p className="text-gray-600 mt-1">Allocate courses to instructors and manage course assignments</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Allocation
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Allocations', value: allocations.length, color: 'blue', icon: BookOpen },
          { label: 'Pending Approval', value: allocations.filter(a => a.status === 'proposed').length, color: 'yellow', icon: Clock },
          { label: 'Approved', value: allocations.filter(a => a.status === 'approved').length, color: 'green', icon: CheckCircle },
          { label: 'Active Courses', value: allocations.filter(a => a.status === 'active').length, color: 'purple', icon: User }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-3xl font-bold text-${stat.color}-600 mt-1`}>{stat.value}</p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search courses or instructors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={selectedSemester || ''}
                onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All Semesters</option>
                {semesters.map(semester => (
                  <option key={semester.semester_id} value={semester.semester_id}>
                    {semester.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Allocations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAllocations.map((allocation, index) => (
          <motion.div
            key={allocation.allocation_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{allocation.course_name}</h3>
                <p className="text-sm text-gray-500 mb-2">{allocation.course_code}</p>
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <User className="h-4 w-4 mr-1" />
                  {allocation.instructor_name}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  {allocation.semester_name}
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(allocation.status)}`}>
                {getStatusIcon(allocation.status)}
                {allocation.status}
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>Proposed</span>
                <span>{new Date(allocation.proposed_at).toLocaleDateString()}</span>
              </div>
              
              <div className="flex gap-2">
                <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                  View Details
                </button>
                {allocation.status === 'proposed' && (
                  <button className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                    Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredAllocations.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No allocations found</h3>
          <p className="text-gray-500 mb-6">Start by creating your first course allocation</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 inline-flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Allocation
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAllocationModal
          semesters={semesters}
          courses={courses}
          instructors={instructors}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => {
            console.log('Creating allocation:', data);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
};

const CreateAllocationModal: React.FC<{
  semesters: any[];
  courses: any[];
  instructors: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}> = ({ semesters, courses, instructors, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    semester: '',
    course: '',
    instructor: '',
    comments: ''
  });

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
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={formData.semester}
              onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Select Semester</option>
              {semesters.map(semester => (
                <option key={semester.semester_id} value={semester.semester_id}>
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
              {courses.map(course => (
                <option key={course.course_id} value={course.course_id}>
                  {course.name} ({course.code})
                </option>
              ))}
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

export default CoordinatorAllocationModule;