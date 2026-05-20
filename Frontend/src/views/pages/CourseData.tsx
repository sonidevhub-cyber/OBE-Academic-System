import React from "react";
import { motion } from "framer-motion";

// TYPES
interface Course {
  id: number;
  course: string;
  course_code: string;
  semester: string;
  instructor: string;
  coordinator: string;
  hod_comments?: string;
}

// COMPONENT
export default function CourseDetails({ course }: { course: Course }) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 bg-gray-50 p-6 rounded-xl border"
    >

      {/* 🔹 COURSE TITLE */}
      <h2 className="text-xl font-bold mb-4">{course.course}</h2>

      {/* 🔹 COURSE INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        <div>
          <p className="text-xs text-gray-500">Course Code</p>
          <p className="font-medium">{course.course_code}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Semester</p>
          <p className="font-medium">{course.semester}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Instructor</p>
          <p className="font-medium">{course.instructor}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Coordinator</p>
          <p className="font-medium">{course.coordinator}</p>
        </div>

      </div>

      {/* 🔹 HOD COMMENTS */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm font-medium text-gray-600">HOD Comments</p>
        <p>{course.hod_comments || "No comments available"}</p>
      </div>

    </motion.div>
  );
}