import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import { FaBook, FaTasks, FaUsers } from "react-icons/fa";

// TYPES
type Student = {
  student_id: string;
  name: string;
};

type CLO = {
  id: number;
  title: string;
  description: string;
  bloom_level: string;
};

type Question = {
  clo: number | "";
  description: string;
  level: string;
};

// PROPS
interface Props {
  courseId: string | number;
  versionId?: number;
  batchId?: string;
}

const ManageClass: React.FC<Props> = ({ courseId, versionId, batchId }) => {

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [date, setDate] = useState("");

  const [questions, setQuestions] = useState<Question[]>([
    { clo: "", description: "", level: "" }
  ]);

  const [students, setStudents] = useState<Student[]>([]);
  const [clos, setClos] = useState<CLO[]>([]);
  const [marks, setMarks] = useState<{ [key: string]: number }>({});

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

  // FETCH CLOs
  useEffect(() => {
    if (!courseId) return;

    const url = versionId 
      ? `/obe/courses/${courseId}/versions/${versionId}/clos/`
      : `/obe/clos-by-course/?course=${courseId}`; // Fallback

    api.get(url)
      .then((res) => setClos(res.data))
      .catch(err => console.error(err));

  }, [courseId, versionId]);

  // FETCH STUDENTS
  useEffect(() => {
    if (!batchId) return;

    api.get(`/students/?batch=${batchId}`)
      .then((res) => setStudents(res.data))
      .catch(err => console.error(err));

  }, [batchId]);

  // CLO SELECT
  const handleCLOChange = (value: number, index: number) => {
    const selected = clos.find((c) => c.id === value);
    if (!selected) return;

    const updated = [...questions];
    updated[index].clo = value;
    updated[index].description = selected.description;
    updated[index].level = selected.bloom_level;

    setQuestions(updated);
  };

  // ADD CLO
  const addCLO = () => {
    setQuestions([...questions, { clo: "", description: "", level: "" }]);
  };

  // MARKS
  const handleMarksChange = (studentId: string, value: string) => {
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

      if (!title || !type || !totalMarks || !date) {
        alert("Please fill all fields");
        return;
      }

      const validCLOs = questions.filter(q => q.clo !== "");

      if (type !== "final" && validCLOs.length === 0) {
        alert("Please select at least one CLO");
        return;
      }

      const cloWeight = validCLOs.length > 0
        ? +(100 / validCLOs.length).toFixed(2)
        : 0;

      // CREATE ASSESSMENT
      const res = await api.post("/obe/assessments/", {
        course: courseId,
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

      alert("Assessment Saved Successfully!");

      // RESET
      setTitle("");
      setType("");
      setTotalMarks("");
      setDate("");
      setQuestions([{ clo: "", description: "", level: "" }]);
      setMarks({});

    } catch (err) {
      console.error(err);
      alert("Error saving assessment");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      
    >

      <div className="p-4">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          
        </div>

        {/* FORM */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

          <input
            placeholder="Title"
            className="border p-3 rounded-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <select
            className="border p-3 rounded-lg"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="presentation">Presentation</option>
            <option value="lab">Lab</option>
            <option value="midterm">Mid</option>
            <option value="final">Final</option>
          </select>

          <input
            placeholder="Total Marks"
            type="number"
            className="border p-3 rounded-lg"
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
          />

          <input
            type="date"
            className="border p-3 rounded-lg"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

        </div>

        {/* WEIGHT */}
        <div className="bg-gray-100 p-3 rounded-lg text-center mb-6">
          <p className="text-sm text-gray-500">Assessment Weight</p>
          <p className="text-xl font-bold text-blue-600">
            {getWeightage()}%
          </p>
        </div>

        {/* CLO */}
        {type !== "final" && (
          <div className="mb-6">

            <h3 className="font-semibold mb-3 flex items-center gap-2">
              {FaTasks({ className: "text-blue-600" })}
              CLO Mapping
            </h3>

            {questions.map((q, index) => {

              const cloWeight = (100 / questions.length).toFixed(2);

              return (
                <div key={index} className="mb-3 bg-gray-50 p-4 rounded-xl shadow-sm">

                  <select
                    className="border p-3 w-full rounded-lg"
                    value={q.clo}
                    onChange={(e) => handleCLOChange(Number(e.target.value), index)}
                  >
                    <option value="">Select CLO</option>
                    {clos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>

                  <p className="text-sm text-gray-500 mt-1">
                    {q.description}
                  </p>

                  <p className="text-sm text-purple-600 font-semibold">
                    Level: {q.level || "-"}
                  </p>

                  <p className="text-sm text-blue-600 font-semibold">
                    Weight: {cloWeight}%
                  </p>

                </div>
              );
            })}

            <button
              onClick={addCLO}
              className="text-blue-600 text-sm mt-2"
            >
              + Add CLO
            </button>

          </div>
        )}

        {/* STUDENTS */}
        <div className="mb-6">

          <h3 className="font-semibold mb-3 flex items-center gap-2">
            {FaUsers({ className: "text-blue-600" })}
            Enter Marks
          </h3>

          <table className="w-full border rounded-lg overflow-hidden">

            <thead className="bg-gray-200">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">Student</th>
                <th className="p-2">Marks</th>
              </tr>
            </thead>

            <tbody>

              {students.map((s, i) => (

                <tr key={s.student_id} className="text-center">

                  <td className="p-2 border">{i + 1}</td>

                  <td className="p-2 border">{s.name}</td>

                  <td className="p-2 border">
                    <input
                      type="number"
                      className="border p-2 w-20 rounded text-center"
                      onChange={(e) =>
                        handleMarksChange(s.student_id, e.target.value)
                      }
                    />
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg w-full"
        >
          Save Assessment
        </button>

      </div>

    </motion.div>
  );
};

export default ManageClass;