import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import { instructorCourseService } from "../../api/instructorCourseService";
import ManageClass from "views/pages/ManageClass";
import OBEReport from "views/pages/OBEReport";
import AttainmentAnalysis from "views/pages/AttainmentAnalysis";
// TYPES
type Student = {
  student_id: number;
  name: string;
};

type CLO = {
  id: number;
  clo_number: string;
  name: string;
  level: string;
};

type Question = {
  clo: number | "";
  description: string;
  level: string;
};

interface Props {
  departmentId: number;
}

const OBEModule: React.FC<Props> = ({ departmentId }) => {

  const [activeTab, setActiveTab] = useState("assessment"); // ✅ FIX
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
  const [courses, setCourses] = useState<any[]>([]);

  // 🔥 STATES
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [date, setDate] = useState("");

  const [questions, setQuestions] = useState<Question[]>([
    { clo: "", description: "", level: "" }
  ]);

  const [students, setStudents] = useState<Student[]>([]);
  const [clos, setClos] = useState<CLO[]>([]);
  const [marks, setMarks] = useState<{ [key: number]: number }>({});

  // FETCH COURSES
  useEffect(() => {
    instructorCourseService.getMyCourses()
      .then(res => {
        // console.log("API DATA:",res.data);
        setCourses(res.data.courses);
      })
      .catch(err => console.error(err));
  }, []);

  // FETCH DATA WHEN COURSE SELECTED
  useEffect(() => {
    if (!selectedCourse) return;

    api.get(`/obe/clos-by-course/?course=${selectedCourse}`)
      .then(res => setClos(res.data));

    api.get(`/students/?course=${selectedCourse}`)
      .then(res => setStudents(res.data));

  }, [selectedCourse]);

  // WEIGHTAGE
  const getWeightage = () => {
    switch (type) {
      case "quiz": return 5;
      case "assignment": return 5;
      case "presentation": return 5;
      case "midterm": return 25;
      case "final": return 50;
      case "lab": return 10;
      default: return 0;
    }
  };

  // CLO SELECT
  const handleCLOChange = (value: number, index: number) => {
    const selected = clos.find((c) => c.id === value);
    if (!selected) return;

    const updated = [...questions];
    updated[index].clo = value;
    updated[index].description = selected.name;
    updated[index].level = selected.level;

    setQuestions(updated);
  };

  const addCLO = () => {
    setQuestions([...questions, { clo: "", description: "", level: "" }]);
  };

  // MARKS
  const handleMarksChange = (studentId: number, value: string) => {
    const num = Number(value);

    if (num > Number(totalMarks)) {
      alert("Marks cannot exceed total marks");
      return;
    }

    setMarks({
      ...marks,
      [studentId]: num
    });
  };

  // SUBMIT
  const handleSubmit = async () => {
    try {

      if (!selectedCourse) {
        alert("Select course first");
        return;
      }

      if (!title || !type || !totalMarks || !date) {
        alert("Fill all fields");
        return;
      }

      const validCLOs = questions.filter(q => q.clo !== "");

      if (type !== "final" && validCLOs.length === 0) {
        alert("Select at least one CLO");
        return;
      }

      const cloWeight = validCLOs.length > 0
        ? +(100 / validCLOs.length).toFixed(2)
        : 0;

      // CREATE ASSESSMENT
      const res = await api.post("/obe/assessments/", {
        course: selectedCourse,
        title,
        assessment_type: type,
        total_marks: totalMarks,
        assessment_date: date,
        weightage: getWeightage()
      });

      const assessmentId = res.data.assessment_id;

      // CLO MAPPING
      if (type === "final") {
        await api.post("/obe/assessment-clo-mappings/auto-map-final/", {
          assessment: assessmentId
        });
      } else {
        await api.post("/obe/assessment-clo-mappings/bulk-create/", {
          mappings: validCLOs.map(q => ({
            assessment: assessmentId,
            clo: q.clo,
            weightage: cloWeight
          }))
        });
      }

      // STUDENT MARKS
      await api.post("/obe/student-assessments/bulk-create/", {
        records: students.map(s => ({
          student: s.student_id,
          assessment: assessmentId,
          marks: ((marks[s.student_id] || 0) / Number(totalMarks)) * 100
        }))
      });

      alert("Saved Successfully!");

      // RESET
      setTitle("");
      setType("");
      setTotalMarks("");
      setDate("");
      setQuestions([{ clo: "", description: "", level: "" }]);
      setMarks({});

    } catch (err) {
      console.error(err);
      alert("Error saving");
    }
  };

  const tabs = [
    { id: "assessment", label: "Assessment" },
    { id: "reports", label: "OBE Reports" },
    { id: "attainment", label: "Attainment Analysis" }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">OBE Management</h2>

       <select
    className="px-3 py-2 border rounded-md"
    value={selectedCourse || ""}
    onChange={(e) =>
      setSelectedCourse(e.target.value ? Number(e.target.value) : undefined)
    }
  >
    <option value="">Select Course</option>

    {courses.map((c) => (
      <option key={c.course_id} value={c.course_id}>
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
              activeTab === tab.id ? "border-b-2 border-blue-500 text-blue-600" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ✅ ASSESSMENT TAB */}
      {activeTab === "assessment" && selectedCourse && (
        <ManageClass courseId={selectedCourse} />
      )}

      {/* OBEReport */}
      {activeTab === "reports" && selectedCourse && (
      <OBEReport courseId={selectedCourse} />
      )}
      {activeTab === "attainment" && selectedCourse && (
      <AttainmentAnalysis courseId={selectedCourse} />
      )}
    </div>
  );
};

export default OBEModule;