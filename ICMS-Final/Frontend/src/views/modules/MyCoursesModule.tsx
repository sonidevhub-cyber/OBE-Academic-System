import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Book, Users, Calendar, Award, Eye } from 'lucide-react';
import {
  instructorCourseService,
  InstructorCourse,
  CoursesSummary,
  CourseDetails
} from '../../api/instructorCourseService';
import CourseData from 'views/pages/CourseData';
import obeService, { TeacherGAContext as TeacherGAContextType, InterimAlert } from '../../api/obeService';

const MyCoursesModule: React.FC = () => {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [summary, setSummary] = useState<CoursesSummary | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetails | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [gaWarningsByCourse, setGaWarningsByCourse] = useState<Record<string, TeacherGAContextType | null>>({});
  const [dismissedWarnings, setDismissedWarnings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('my-courses-ga-warning-dismissed');
      if (stored) {
        setDismissedWarnings(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load dismissed GA warnings', error);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, summaryRes] = await Promise.all([
        instructorCourseService.getMyCourses(),
        instructorCourseService.getCoursesSummary()
      ]);

      const coursesData =
  coursesRes.data?.data ||
  coursesRes.data?.courses ||
  coursesRes.data;

console.log("FINAL COURSES:", coursesData);

setCourses(Array.isArray(coursesData) ? coursesData : []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCourse = async (allocationId: number) => {
    if (expandedCourseId === allocationId) {
      setExpandedCourseId(null);
      return;
    }

    try {
      const response = await instructorCourseService.getCourseDetails(allocationId);
      setSelectedCourse(response.data);
      setExpandedCourseId(allocationId);
    } catch (error) {
      console.error('Error fetching course details:', error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadWarnings = async () => {
      if (!courses.length) {
        setGaWarningsByCourse({});
        return;
      }

      const entries = await Promise.all(
        courses.map(async (course) => {
          const courseId = String(course.course_id || '');
          const batchId = String(course.batch_id || '');
          if (!courseId || !batchId) return null;

          try {
            const context = await obeService.getTeacherGAContext(courseId, batchId);
            return [courseId, context] as const;
          } catch (error) {
            console.error(`Failed to load GA warnings for course ${courseId}:`, error);
            return [courseId, null] as const;
          }
        })
      );

      if (!cancelled) {
        setGaWarningsByCourse(
          Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, TeacherGAContextType | null]>)
        );
      }
    };

    loadWarnings();

    return () => {
      cancelled = true;
    };
  }, [courses]);

  const dismissGaWarning = (courseId: string, gaCode: string) => {
    const storageKey = `${courseId}:${gaCode}`;
    setDismissedWarnings((prev) => {
      const next = { ...prev, [storageKey]: true };
      sessionStorage.setItem('my-courses-ga-warning-dismissed', JSON.stringify(next));
      return next;
    });
  };

  const renderGaWarnings = (course: InstructorCourse) => {
    const courseId = String(course.course_id || '');
    const warnings = gaWarningsByCourse[courseId]?.interim_alerts || [];
    const visibleWarnings = warnings.filter((warning) => !dismissedWarnings[`${courseId}:${warning.ga_code}`]);

    if (!visibleWarnings.length) {
      return null;
    }

    return (
      <div className="mt-4 space-y-2">
        {visibleWarnings.map((warning: InterimAlert) => {
          const mappedClos = warning.mapped_clos || [];
          const semesterLabel = warning.source_semester?.name || '';
          const baseText = warning.issue_statement || `Previous semester showed weakness in ${warning.ga_code} (${warning.ga_title}).`;
          const cloText = mappedClos.length > 0
            ? `Mapped CLOs: ${mappedClos.map((clo: any) => `${clo.clo_code}${clo.clo_title ? ` (${clo.clo_title})` : ''}`).join(', ')}.`
            : '';
          const warningText = [
            baseText,
            semesterLabel ? `${semesterLabel}.` : '',
            cloText,
            'Since this course targets the same GA, please focus more on problem-solving tasks in assignments.'
          ].filter(Boolean).join(' ');
          return (
            <div
              key={`${courseId}:${warning.ga_code}`}
              className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-700">
                    GA Warning
                  </div>
                  <p className="mt-1 font-medium leading-5">{warningText}</p>
                </div>
                <button
                  onClick={() => dismissGaWarning(courseId, warning.ga_code)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-yellow-700 hover:bg-yellow-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
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

      {/* 🔹 Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border">
        <h2 className="text-2xl font-bold text-gray-900">My Courses</h2>
        <p className="text-gray-600">Manage your allocated courses and students</p>
      </div>

      {/* 🔹 NEW CLEAN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <motion.div className="bg-white rounded-xl p-6 shadow border">
          <p className="text-sm text-gray-500">Total Courses</p>
          <p className="text-3xl font-bold text-blue-600">{courses.length}</p>
        </motion.div>

        <motion.div className="bg-white rounded-xl p-6 shadow border">
          <p className="text-sm text-gray-500">Allocations</p>
          <p className="text-3xl font-bold text-green-600">{courses.length}</p>
        </motion.div>

        <motion.div className="bg-white rounded-xl p-6 shadow border">
          <p className="text-sm text-gray-500">Semesters</p>
          <p className="text-3xl font-bold text-purple-600">
            {new Set(courses.map(c => c.semester_name)).size}
          </p>
        </motion.div>

      </div>

      {/* 🔹 Courses */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Active Courses</h3>

        {courses.length === 0 ? (
          <div className="text-center py-8">
            <Book className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No active courses assigned yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {courses.map((course) => (
              <div key={course.allocation_id}>

                {/* 🔹 CARD */}
                <motion.div
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 hover:shadow-lg transition"
                  whileHover={{ scale: 1.03 }}
                >
                  <div className="flex justify-between items-start">

                    <div>
                      <h4 className="text-lg font-bold">{course.course_name}</h4>
                      <p className="text-sm text-blue-600">{course.course_code}</p>
                      <p className="text-xs text-gray-500 mt-1">{course.semester_name}</p>

                      <div className="flex items-center mt-2">
                        <Award className="h-4 w-4 text-yellow-500 mr-1" />
                        <span className="text-sm text-gray-600">
                          {course.credits} Credits
                        </span>
                      </div>
                    </div>

                    {/* 👁️ ONLY CLICK */}
                    {/* <Eye
                      className="h-5 w-5 text-blue-600 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewCourse(course.allocation_id);
                      }}
                    /> */}

                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-200 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Batch</span>
                      <span>{course.batch_name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500">Program</span>
                      <span>{course.program_code || course.program_name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500">Coordinator</span>
                      <span>{course.coordinator_name}</span>
                    </div>
                  </div>

                  {renderGaWarnings(course)}
                </motion.div>

                {/* 🔥 EXPAND
                {expandedCourseId === course.allocation_id && selectedCourse && (
                  <CourseData
  course={{
    id: course.allocation_id,

    course: selectedCourse?.course?.name || "N/A",
    course_code: selectedCourse?.course?.code || "N/A",
    semester: selectedCourse?.semester?.name || "N/A",

    instructor: "You",

    coordinator: selectedCourse?.coordinator?.name || "N/A",

    hod_comments: selectedCourse?.hod_comments || "No comments",
  }}

                  />
                )} */}

              </div>
            ))}

          </div>
        )}
      </div>

    </div>
  );
};

export default MyCoursesModule;
