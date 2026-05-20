import React, { useState, useEffect } from 'react';
import { obeService } from '../../../api/obeService';

interface Course {
  id: number;
  code: string;
  name: string;
  instructor: string;
  cloStatus: string;
  assessmentCount: number;
  avgAttainment: number;
  status: string;
}

interface Instructor {
  id: number;
  name: string;
  courses: string[];
  obeCompliance: number;
  needsSupport: boolean;
}

interface Props {
  coordinatorId: number;
  departmentId: number;
}

const CoordinatorOBEModule: React.FC<Props> = ({ coordinatorId, departmentId }) => {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  const tabs = [
    { id: 'courses', label: 'Course Monitoring' },
    { id: 'support', label: 'Instructor Support' },
    { id: 'quality', label: 'Quality Assurance' }
  ];

  useEffect(() => {
    loadCoordinatorData();
  }, [coordinatorId]);

  const loadCoordinatorData = async () => {
    // Mock data - replace with actual API calls
    setCourses([
      {
        id: 1,
        code: 'CS101',
        name: 'Programming Fundamentals',
        instructor: 'Dr. Smith',
        cloStatus: '5/5',
        assessmentCount: 8,
        avgAttainment: 82,
        status: 'complete'
      },
      {
        id: 2,
        code: 'CS201',
        name: 'Data Structures',
        instructor: 'Dr. Johnson',
        cloStatus: '4/6',
        assessmentCount: 5,
        avgAttainment: 75,
        status: 'in-progress'
      }
    ]);

    setInstructors([
      {
        id: 1,
        name: 'Dr. Smith',
        courses: ['CS101'],
        obeCompliance: 95,
        needsSupport: false
      },
      {
        id: 2,
        name: 'Dr. Johnson',
        courses: ['CS201', 'CS301'],
        obeCompliance: 78,
        needsSupport: true
      }
    ]);
  };

  const CourseMonitoring = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Course OBE Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 p-3 text-left">Course</th>
                <th className="border border-gray-300 p-3 text-left">Instructor</th>
                <th className="border border-gray-300 p-3 text-left">CLO Status</th>
                <th className="border border-gray-300 p-3 text-left">Assessments</th>
                <th className="border border-gray-300 p-3 text-left">Attainment</th>
                <th className="border border-gray-300 p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course: any) => (
                <tr key={course.id}>
                  <td className="border border-gray-300 p-3">
                    <div>
                      <div className="font-medium">{course.code}</div>
                      <div className="text-sm text-gray-600">{course.name}</div>
                    </div>
                  </td>
                  <td className="border border-gray-300 p-3">{course.instructor}</td>
                  <td className="border border-gray-300 p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      course.cloStatus === '5/5' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {course.cloStatus}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-3">{course.assessmentCount}</td>
                  <td className="border border-gray-300 p-3">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${course.avgAttainment}%` }}
                        ></div>
                      </div>
                      <span className="text-sm">{course.avgAttainment}%</span>
                    </div>
                  </td>
                  <td className="border border-gray-300 p-3">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-blue-500 text-white rounded text-xs">
                        Review
                      </button>
                      <button className="px-2 py-1 bg-green-500 text-white rounded text-xs">
                        Support
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="font-medium text-gray-700 mb-2">Courses Monitored</h4>
          <p className="text-3xl font-bold text-blue-600">{courses.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="font-medium text-gray-700 mb-2">Avg Compliance</h4>
          <p className="text-3xl font-bold text-green-600">86%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="font-medium text-gray-700 mb-2">Issues Identified</h4>
          <p className="text-3xl font-bold text-red-600">3</p>
        </div>
      </div>
    </div>
  );

  const InstructorSupport = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Instructor OBE Support</h3>
        <div className="space-y-4">
          {instructors.map((instructor: any) => (
            <div key={instructor.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium">{instructor.name}</h4>
                  <p className="text-sm text-gray-600">
                    Courses: {instructor.courses.join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">OBE Compliance</div>
                  <div className={`text-lg font-bold ${
                    instructor.obeCompliance >= 90 ? 'text-green-600' :
                    instructor.obeCompliance >= 75 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {instructor.obeCompliance}%
                  </div>
                </div>
              </div>
              
              {instructor.needsSupport && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                  <div className="flex items-center">
                    <span className="text-yellow-600 mr-2">⚠️</span>
                    <span className="text-sm text-yellow-800">Needs OBE implementation support</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  Schedule Meeting
                </button>
                <button className="px-3 py-1 bg-green-500 text-white rounded text-sm">
                  Send Resources
                </button>
                <button className="px-3 py-1 bg-purple-500 text-white rounded text-sm">
                  View Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Support Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h4 className="font-medium mb-2">OBE Training Materials</h4>
            <p className="text-sm text-gray-600 mb-3">Comprehensive guides and tutorials</p>
            <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
              Access Materials
            </button>
          </div>
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h4 className="font-medium mb-2">CLO Templates</h4>
            <p className="text-sm text-gray-600 mb-3">Ready-to-use CLO templates</p>
            <button className="px-3 py-1 bg-green-500 text-white rounded text-sm">
              Download Templates
            </button>
          </div>
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h4 className="font-medium mb-2">Assessment Rubrics</h4>
            <p className="text-sm text-gray-600 mb-3">Standardized assessment criteria</p>
            <button className="px-3 py-1 bg-purple-500 text-white rounded text-sm">
              View Rubrics
            </button>
          </div>
          <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <h4 className="font-medium mb-2">Best Practices</h4>
            <p className="text-sm text-gray-600 mb-3">Successful OBE implementation examples</p>
            <button className="px-3 py-1 bg-orange-500 text-white rounded text-sm">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const QualityAssurance = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Quality Assurance Checklist</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center">
              <span className="text-green-600 mr-3">✓</span>
              <span>All courses have defined CLOs</span>
            </div>
            <span className="text-sm text-green-600">8/8 courses</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center">
              <span className="text-yellow-600 mr-3">⚠️</span>
              <span>CLO-GA mappings completed</span>
            </div>
            <span className="text-sm text-yellow-600">6/8 courses</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center">
              <span className="text-green-600 mr-3">✓</span>
              <span>Assessment methods aligned with CLOs</span>
            </div>
            <span className="text-sm text-green-600">8/8 courses</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center">
              <span className="text-red-600 mr-3">✗</span>
              <span>Regular attainment monitoring</span>
            </div>
            <span className="text-sm text-red-600">5/8 courses</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Action Items</h3>
        <div className="space-y-3">
          <div className="p-3 border-l-4 border-red-500 bg-red-50">
            <h4 className="font-medium text-red-800">High Priority</h4>
            <p className="text-sm text-red-700">Complete CLO-GA mappings for CS301 and CS401</p>
            <p className="text-xs text-red-600 mt-1">Due: Dec 20, 2024</p>
          </div>
          <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
            <h4 className="font-medium text-yellow-800">Medium Priority</h4>
            <p className="text-sm text-yellow-700">Set up regular attainment monitoring for 3 courses</p>
            <p className="text-xs text-yellow-600 mt-1">Due: Dec 25, 2024</p>
          </div>
          <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
            <h4 className="font-medium text-blue-800">Low Priority</h4>
            <p className="text-sm text-blue-700">Update assessment rubrics for consistency</p>
            <p className="text-xs text-blue-600 mt-1">Due: Jan 5, 2025</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-bold">OBE Coordination</h2>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'courses' && <CourseMonitoring />}
        {activeTab === 'support' && <InstructorSupport />}
        {activeTab === 'quality' && <QualityAssurance />}
      </div>
    </div>
  );
};

export default CoordinatorOBEModule;