import React, { useState, useEffect } from "react";
import { instructorCourseService, InstructorCourse } from "../../api/instructorCourseService";

import ManageClass from "../pages/ManageClass";
import OBEReport from "../pages/OBEReport";
import AttainmentAnalysis from "../pages/AttainmentAnalysis";
import AssessmentHistory from "../pages/AssessmentHistory";

const OBEModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState("assessment");
  const [selectedCourse, setSelectedCourse] = useState<InstructorCourse | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // EDIT STATE
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

  const handleEditAssessmentFromHistory = (assessment: any) => {
    setSelectedAssessment(assessment); 
    setActiveTab("assessment"); // Switch to Assessment tab in Edit Mode
  };

  useEffect(() => {
    console.log("Fetching courses...");
    setLoading(true);
    instructorCourseService.getMyCourses()
      .then(res => {
        let data: any;
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        } else if (res.data && Array.isArray(res.data.results)) {
          data = res.data.results;
        } else {
          data = [];
        }
        setCourses(data);
      })
      .catch(err => {
        console.error("Error fetching courses:", err);
        setError("Failed to load courses");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "") {
      setSelectedCourse(null);
    } else {
      const selected = courses.find(
        (c) => String(c.allocation_id) === e.target.value
      );
      setSelectedCourse(selected || null);
    }
  };

  const tabs = [
    { id: "assessment", label: "Assessment" },
    { id: "history", label: "Assessment History" },
    { id: "reports", label: "Course Report" },
    { id: "attainment", label: "Attainment Analysis" }
  ];

  return (
    <div className="bg-gray-100 min-h-screen p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          OBE Management
        </h2>

        <div>
          {loading && <div className="text-gray-500">Loading courses...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && (
            <select
              className="px-4 py-2 border rounded-lg"
              value={selectedCourse?.allocation_id || ""}
              onChange={handleCourseChange}
            >
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c.allocation_id} value={c.allocation_id}>
                  {c.course_code} - {c.course_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === "assessment") {
                // Manual click par edit mode clear kar dein taake Fresh Assessment Form khule
                setSelectedAssessment(null); 
              }
              setActiveTab(tab.id);
            }}
            className={`pb-2 ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="bg-white rounded-xl shadow p-5">

        {!selectedCourse && (
          <div className="text-center text-gray-500 py-8">
            Please select a course from the dropdown above
          </div>
        )}

        {activeTab === "assessment" && selectedCourse && (
          <ManageClass
            courseId={String(selectedCourse.course_id)}
            batchId={String(selectedCourse.batch_id)}
            semesterId={String(selectedCourse.semester_id || '')}
            semesterNumber={String(selectedCourse.semester_no || '')}
            selectedCourse={selectedCourse}
            // UPDATE: Is prop ka lagna zaroori tha
            initialEditAssessment={selectedAssessment} 
          />
        )}

        {activeTab === "reports" && selectedCourse && (
          <OBEReport
            courseId={String(selectedCourse.course_id)}
            batchId={String(selectedCourse.batch_id)}
            semesterId={String(selectedCourse.semester_id)}
          />
        )}

        {activeTab === "history" && selectedCourse && (
          <AssessmentHistory
            courseId={String(selectedCourse.course_id)}
            batchId={String(selectedCourse.batch_id)}
            semesterNumber={String(selectedCourse.semester_no ?? "")}
            onEditAssessment={handleEditAssessmentFromHistory}
          />
        )}

        {activeTab === "attainment" && selectedCourse && (
          <AttainmentAnalysis
            courseId={String(selectedCourse.course_id)}
            batchId={String(selectedCourse.batch_id)}
            semesterId={String(selectedCourse.semester_id)}
          />
        )}

      </div>
    </div>
  );
};

export default OBEModule;