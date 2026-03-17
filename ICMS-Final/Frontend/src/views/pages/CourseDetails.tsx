import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CourseDetails() {

  const { id } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [showStudents, setShowStudents] = useState(false);

  useEffect(() => {
    api.get(`/instructors/course-details/${id}/`)
      .then((res: any) => setCourse(res.data))
      .catch((err: any) => console.error(err));
  }, [id]);

  const downloadPDF = () => {

    const doc = new jsPDF();

    doc.text(`${course.course} - Student List`, 14, 15);

    const tableData = course.students.map((s: any, index: number) => [
      index + 1,
      s.reg_no,
      s.name,
      "Enrolled"
    ]);

    autoTable(doc, {
      head: [["#", "Registration No", "Student Name", "Status"]],
      body: tableData,
      startY: 20,
    });

    doc.save(`${course.course}_students.pdf`);
  };

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center text-gray-500 text-lg">
        Loading Course Details...
      </div>
    );
  }

  return (

    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gray-50 flex justify-center items-start py-12 px-4"
    >

      <div className="w-full max-w-4xl bg-white shadow-lg rounded-2xl p-10">

        {/* Course Title */}
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 leading-tight">
          {course.course}
        </h1>

        <p className="text-gray-500 mt-2 text-sm mb-10">
          Course Information Overview
        </p>


        {/* Course Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

          <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Course Code</p>
            <p className="text-lg font-semibold text-gray-800">
              {course.course_code}
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Semester</p>
            <p className="text-lg font-semibold text-gray-800">
              {course.semester}
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Instructor</p>
            <p className="text-lg font-semibold text-gray-800">
              {course.instructor}
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-sm text-gray-500">Coordinator</p>
            <p className="text-lg font-semibold text-gray-800">
              {course.coordinator}
            </p>
          </motion.div>

        </div>


        {/* HOD Comments */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10 border-l-4 border-blue-500 bg-blue-50 p-5 rounded-lg"
        >
          <p className="text-sm text-gray-600 mb-1 font-medium">
            HOD Comments
          </p>

          <p className="text-gray-800">
            {course.hod_comments || "No comments available"}
          </p>
        </motion.div>


        {/* Students Section */}
        <div>

          <div className="flex justify-between items-center mb-6">

            <h2
              onClick={() => setShowStudents(!showStudents)}
              className="text-xl font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition"
            >
              Enrolled Students
            </h2>

            <div className="flex items-center gap-2">

              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                {course.students.length} Students
              </span>

              <button
                onClick={downloadPDF}
                className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-blue-700 transition shadow-sm"
              >
                Download PDF
              </button>

            </div>

          </div>


          {/* Toggle Student Table */}
          {showStudents && (

            <div className="overflow-hidden border border-gray-200 rounded-xl">

              <table className="w-full text-sm">

                <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Registration No</th>
                    <th className="px-6 py-3 text-left">Student Name</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>

                <tbody>

                  {course.students.map((s: any, index: number) => (

                    <motion.tr
                      key={index}
                      whileHover={{ scale: 1.01 }}
                      className="border-t even:bg-gray-50 transition"
                    >

                      <td className="px-6 py-4 text-gray-500 font-medium">
                        {index + 1}
                      </td>

                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-xs font-medium">
                          {s.reg_no}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-800">
                        {s.name}
                      </td>

                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                          Enrolled
                        </span>
                      </td>

                    </motion.tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </motion.div>
  );
}