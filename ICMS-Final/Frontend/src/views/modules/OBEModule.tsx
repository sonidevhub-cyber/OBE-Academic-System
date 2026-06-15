import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { instructorCourseService } from "../../api/instructorCourseService";
import ManageClass from "views/pages/ManageClass";
import OBEReport from "views/pages/OBEReport";
import AttainmentAnalysis from "views/pages/AttainmentAnalysis";
// import CQI from "views/pages/CQI";

// ✅ TYPE
type Course = {
  allocation_id: number;
  course_id: number;
  batch_id: string; // UUID REQUIRED
  course_name: string;
  course_code: string;
  // program_id: string;
  program?: string;
  program_id?: string;
  semester_id: string; 
};

const OBEModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState("assessment");

  // ✅ STORE FULL OBJECT (IMPORTANT)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);

  // ✅ FETCH COURSES
  useEffect(() => {
    instructorCourseService.getMyCourses()
      .then(res => {
        console.log("🔥 COURSES API:", res.data);
        setCourses(res.data?.data || []);
      })
      .catch(err => console.error(err));
  }, []);

  const tabs = [
    { id: "assessment", label: "Assessment" },
    { id: "reports", label: "OBE Reports" },
    { id: "attainment", label: "Attainment Analysis" },
    // { id: "cqi", label: "CQI (Continuous Improvement)" }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">OBE Management</h2>

        <select
          className="px-3 py-2 border rounded-md"
          value={selectedCourse?.allocation_id || ""}
          onChange={(e) => {
            const selected = courses.find(
              (c) => c.allocation_id === Number(e.target.value)
            );
            setSelectedCourse(selected || null);
          }}
        >
          <option value="">Select Course</option>

          {courses.map((c) => (
            <option key={c.allocation_id} value={c.allocation_id}>
              {c.course_code} - {c.course_name}
            </option>
          ))}
        </select>
      </div>

      {/* TABS */}
      <div className="border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mr-6 pb-2 ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ✅ ASSESSMENT */}
      {activeTab === "assessment" && selectedCourse && (
       <ManageClass
  courseId={String(selectedCourse.course_id)}
  batchId={String(selectedCourse.batch_id)}
  semesterId={String(selectedCourse.semester_id)}
  // programId={String(
  //   selectedCourse.program_id ||
  //   (selectedCourse as any).program?.id ||
  //   (selectedCourse as any).program
  // )}
/>
      )}

      {/* ✅ OBE REPORT */}
      {activeTab === "reports" && selectedCourse && (
        <OBEReport
  courseId={String(selectedCourse.course_id)}
  batchId={selectedCourse.batch_id}
  semesterId={selectedCourse.semester_id}
/>
      )}

      {/* ✅ ATTAINMENT */}
      {activeTab === "attainment" && selectedCourse && (
        <AttainmentAnalysis
  courseId={String(selectedCourse.course_id)}
  batchId={String(selectedCourse.batch_id)}
  semesterId={String(selectedCourse.semester_id)}
/>
      )}

      {/* ✅ CQI */}
      {/* {activeTab === "cqi" && selectedCourse && (
  <CQI
    courseId={String(selectedCourse.course_id)}
    batchId={String(selectedCourse.batch_id)}
    semesterId={String(selectedCourse.semester_id)}
  />
)} */}

    </div>
  );
};

export default OBEModule;