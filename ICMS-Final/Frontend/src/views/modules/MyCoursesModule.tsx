import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Book, Users, Calendar, Award, Eye, ChevronRight } from 'lucide-react';
import { instructorCourseService, InstructorCourse, CoursesSummary, CourseDetails } from '../../api/instructorCourseService';

const MyCoursesModule: React.FC = () => {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [summary, setSummary] = useState<CoursesSummary | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetails | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, summaryRes] = await Promise.all([
        instructorCourseService.getMyCourses(),
        instructorCourseService.getCoursesSummary()
      ]);
      
      setCourses(coursesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCourse = async (allocationId: number) => {
    try {
      const response = await instructorCourseService.getCourseDetails(allocationId);
      setSelectedCourse(response.data);
      setShowCourseModal(true);
    } catch (error) {
      console.error('Error fetching course details:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Courses</h2>
          <p className="text-gray-600">Manage your allocated courses and students</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center">
              <Book className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-blue-600">{summary.active_courses}</p>
                <p className="text-gray-600">Active Courses</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center">
              <Award className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-green-600">{summary.approved_courses}</p>
                <p className="text-gray-600">Approved</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-yellow-600">{summary.pending_approval}</p>
                <p className="text-gray-600">Pending</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-purple-600">{summary.total_allocated}</p>
                <p className="text-gray-600">Total Allocated</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Active Courses */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Active Courses</h3>
        {courses.length === 0 ? (
          <div className="text-center py-8">
            <Book className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No active courses assigned yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Course allocations will appear here once approved by HOD
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <motion.div
                key={course.allocation_id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                whileHover={{ scale: 1.02 }}
                onClick={() => handleViewCourse(course.allocation_id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{course.course_name}</h4>
                    <p className="text-sm text-gray-600">{course.course_code}</p>
                    <p className="text-xs text-gray-500 mt-1">{course.semester_name}</p>
                    <div className="flex items-center mt-2">
                      <Award className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-sm text-gray-600">{course.credits} Credits</span>
                    </div>
                  </div>
                  <Eye 
  className="h-5 w-5 text-blue-500 cursor-pointer" 
  onClick={(e) => {
    e.stopPropagation();
    handleViewCourse(course.allocation_id);
  }}
/>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Department</span>
                    <span className="text-gray-700">{course.department}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500">Coordinator</span>
                    <span className="text-gray-700">{course.coordinator_name}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {summary && summary.recent_allocations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Course Allocations</h3>
          <div className="space-y-3">
            {summary.recent_allocations.map((allocation, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{allocation.course_name}</p>
                  <p className="text-sm text-gray-600">{allocation.course_code}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    allocation.status === 'active' ? 'bg-green-100 text-green-800' :
                    allocation.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                    allocation.status === 'proposed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {allocation.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(allocation.proposed_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Details Modal */}
      {showCourseModal && selectedCourse && (
        <CourseDetailsModal
          course={selectedCourse}
          onClose={() => {
            setShowCourseModal(false);
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
};

// Course Details Modal Component
const CourseDetailsModal: React.FC<{
  course: CourseDetails;
  onClose: () => void;
}> = ({ course, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{course.course.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          Course Information
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Course Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Code:</span>
                  <span className="font-medium">{course.course.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits:</span>
                  <span className="font-medium">{course.course.credits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Department:</span>
                  <span className="font-medium">{course.semester.department}</span>
                </div>
              </div>
              {course.course.description && (
                <div className="mt-3">
                  <p className="text-sm text-gray-700">{course.course.description}</p>
                </div>
              )}
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">Semester Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Semester:</span>
                  <span className="font-medium">{course.semester.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Program:</span>
                  <span className="font-medium">{course.semester.program}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Capacity:</span>
                  <span className="font-medium">{course.semester.capacity}</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">Coordinator</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{course.coordinator.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{course.coordinator.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium">{course.coordinator.phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Students List */}
          <div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">
                Enrolled Students ({course.total_students})
              </h4>
              {course.students.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No students enrolled yet</p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {course.students.map((student) => (
                      <div key={student.student_id} className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-gray-600">{student.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">ID: {student.student_id}</p>
                            <p className="text-sm text-gray-500">{student.phone}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HOD Comments */}
        {course.hod_comments && (
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">HOD Comments</h4>
            <p className="text-sm text-gray-700">{course.hod_comments}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyCoursesModule;