import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import { FaTasks, FaUsers } from "react-icons/fa";
import { toast } from "react-toastify";
import { InstructorCourse } from "../../api/instructorCourseService";
// import PresentationRubrics from "./PresentationRubrics";
import CQI from "./CQI";

const TaskIcon = FaTasks as unknown as React.FC<any>;
const UserIcon = FaUsers as unknown as React.FC<any>;

type Student = {
  student_id: string;
  name: string;
};

type CLO = {
  id: string;
  order_number: number;
  description: string;
  bloom_level: string;
  kpi_target: number;
};

type Question = {
  clo: string;
  description: string;
  level: string;
  kpi: number;
  marks: number;
};

interface Props {
  courseId: string;
  batchId: string;
  semesterId: string;
  selectedCourse?: InstructorCourse | null;
}

const ManageClass: React.FC<Props> = ({ courseId, batchId, semesterId, selectedCourse }) => {

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [date, setDate] = useState("");
  const [weakClos, setWeakClos] = useState<any[]>([]);
  const [showCQI, setShowCQI] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { clo: "", description: "", level: "", kpi: 0, marks: 0 }
  ]);

  const [students, setStudents] = useState<Student[]>([]);
  const [clos, setClos] = useState<CLO[]>([]);
  const [marks, setMarks] = useState<{ [key: string]: number }>({});
  const [checkedCQI, setCheckedCQI] = useState(false);
  // ================= TYPE RESET =================
  const handleTypeChange = (value: string) => {
    setType(value);
    setQuestions([{ clo: "", description: "", level: "", kpi: 0, marks: 0 }]);
    setMarks({});
  };

  // ================= FETCH CLO =================
  useEffect(() => {
    if (!courseId || !selectedCourse?.curriculum_version_id) {
      console.log("Course ID or curriculum version ID missing for CLO fetch");
      return;
    }

    const fetchClos = async () => {
      try {
        const res = await api.get(`/obe/courses/${courseId}/versions/${selectedCourse.curriculum_version_id}/clos/`);
        console.log("CLO API response:", res.data);
        setClos(res.data || []);
      } catch (err) {
        console.error("Failed to fetch CLOs:", err);
        setClos([]);
      }
    };

    fetchClos();
  }, [courseId, selectedCourse]);

  // ================= FETCH STUDENTS =================
  useEffect(() => {
    if (!batchId) return;

    api.get(`/students/?batch=${batchId}`)
      .then(res => setStudents(res.data))
      .catch(() => setStudents([]));
  }, [batchId]);
  // 🔥 CHECK REJECTED CQI
useEffect(() => {
  if (!courseId || !batchId || !semesterId) {
    console.log("Missing params:", { courseId, batchId, semesterId });
    return;
  }

  api.get(`/assessments/cqi/check-status/`, {
    params: {
      course: courseId,
      batch: batchId,
      semester: semesterId
    }
  })
  .then(res => {

    const items = res.data.items || [];

    // 🔥 Check agar koi bhi rejected hai
    const rejected = items.filter((i: any) => i.status === "rejected");

    if (rejected.length > 0) {
      setShowCQI(true);
      toast.error("Some CQIs rejected. Please update.");
    }

    setCheckedCQI(true);

  })
  .catch(() => {});
}, [courseId, batchId, semesterId]);
  // ================= CLO SELECT =================
  const handleCLOChange = (value: string, index: number) => {

  // ❌ duplicate check
  const alreadySelected = questions.some(
    (q, i) => q.clo === value && i !== index
  );

  if (alreadySelected) {
    toast.error("This CLO is already selected");
    return;
  }

  const selected = clos.find(c => c.id === value);
  if (!selected) return;

  const updated = [...questions];
  updated[index] = {
    clo: value,
    description: selected.description,
    level: selected.bloom_level,
    kpi: selected.kpi_target,
    marks: 0
  };

  setQuestions(updated);
};

  const handleQuestionMarks = (value: string, index: number) => {
    const updated = [...questions];
    updated[index].marks = Number(value);
    setQuestions(updated);
  };

  const addCLO = () => {
    setQuestions([
      ...questions,
      { clo: "", description: "", level: "", kpi: 0, marks: 0 }
    ]);
  };

  // ================= MARKS =================
  const handleMarksChange = (key: string, value: string) => {
    setMarks({ ...marks, [key]: Number(value) });
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    try {

      if (!title || !type || !totalMarks || !date) {
        toast.error("Fill all fields");
        return;
      }

      // // ================= PRESENTATION =================
      // if (type === "presentation") {

      //   const res = await api.post("/assessments/create/", {
      //     course: courseId,
      //     batch: batchId,
      //     title,
      //     type,
      //     total_marks: Number(totalMarks),
      //     date,
      //     questions: [] // no CLO
      //   });

      //   const assessmentId = res.data.assessment_id;

      //   const payload: any[] = [];

      //   students.forEach(s => {
      //     const total =
      //       (marks[`${s.student_id}-content`] || 0) +
      //       (marks[`${s.student_id}-delivery`] || 0) +
      //       (marks[`${s.student_id}-confidence`] || 0);

      //     payload.push({
      //       student_id: s.student_id,
      //       marks: total
      //     });
      //   });

      //   await api.post(`/assessments/${assessmentId}/enter-marks/`, payload);

      //   toast.success("Presentation saved ✅");
      //   return;
      // }

      // ================= NORMAL ASSESSMENT =================
      const totalQ = questions.reduce((sum, q) => sum + q.marks, 0);

      if (totalQ !== Number(totalMarks)) {
        toast.error("Question marks must equal total marks");
        return;
      }

      const cleanQuestions = questions.map(q => ({
        clo: q.clo,
        description: q.description,
        level: q.level,
        marks: Number(q.marks)
      }));

      const res = await api.post("/assessments/create/", {
        course: courseId,
        batch: batchId,
        title,
        type,
        total_marks: Number(totalMarks),
        date,
        questions: cleanQuestions
      });

      const assessmentId = res.data.assessment_id;
      const backendQuestions = res.data.questions;

      const cloMap: any = {};
      backendQuestions.forEach((q: any) => {
        cloMap[q.clo] = q.id;
      });

      const payload: any[] = [];

      students.forEach(s => {
        questions.forEach(q => {
          const key = `${s.student_id}-${q.clo}`;

          payload.push({
            student_id: s.student_id,
            question_id: cloMap[q.clo],
            marks: Number(marks[key] || 0)
          });
        });
      });

      const response = await api.post(
  `/assessments/${assessmentId}/enter-marks/`,
  payload
);

// 🔥 CQI trigger
if (response.data.is_final) {

  const cqiCheck = await api.get(
    `/assessments/cqi/check/${assessmentId}/`
  );

  if (cqiCheck.data.show_cqi) {
    setWeakClos(cqiCheck.data.weak_clos); // 🔥 MUST
    setShowCQI(true);
  } else if (cqiCheck.data.message) {
    toast.info(cqiCheck.data.message);
  }
}

toast.success("Assessment completed ✅");
                        
    } catch (err: any) {
      console.error(err?.response?.data);
      toast.error(JSON.stringify(err?.response?.data));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="p-5 bg-white rounded shadow">

        {/* FORM */}
        <div className="grid grid-cols-4 gap-4 mb-6">

          <input
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="border p-2 rounded"
          />

          <select
            value={type}
            onChange={e => handleTypeChange(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Type</option>
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="presentation">Presentation</option>
            <option value="midterm">Mid</option>
            <option value="final">Final</option>
          </select>

          <input
            type="number"
            placeholder="Total Marks"
            value={totalMarks}
            onChange={e => setTotalMarks(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border p-2 rounded"
          />

        </div>

        {/* CLO SECTION */}
        <div>
  <h3 className="font-bold flex gap-2 items-center mb-2">
    <TaskIcon />
    CLO Mapping
  </h3>

  {questions.map((q, index) => (
    <div key={index} className="border p-3 mt-3 rounded bg-gray-50">

      <select
        value={q.clo}
        onChange={(e) => handleCLOChange(e.target.value, index)}
        className="border p-2 w-full rounded"
      >
        <option value="">Select CLO</option>
        {clos.map(c => (
          <option key={c.id} value={c.id}>
            CLO-{c.order_number}
          </option>
        ))}
      </select>

      {q.clo && (
        <div className="mt-2 flex gap-3 items-center">
          <span>{q.description}</span>
          <span>{q.level}</span>
          <span>{q.kpi}%</span>

          <input
            type="number"
            className="w-20 border text-center"
            placeholder="Marks"
            onChange={(e) =>
              handleQuestionMarks(e.target.value, index)
            }
          />
        </div>
      )}

    </div>
  ))}

  {/* <button
    onClick={addCLO}
    className="mt-2 bg-gray-200 px-3 py-1 rounded"
  >
    {type === "presentation" ? "+ Add Criteria" : "+ Add CLO"}
  </button>
</div>

  {type === "presentation" && (
  <PresentationRubrics
    students={students}
    questions={questions}
    clos={clos}
    marks={marks}
    handleMarksChange={handleMarksChange}
  />
)} */}
</div>

        {/* STUDENTS NORMAL */}
       
          <div className="mt-6">
            <h3 className="font-bold flex gap-2 items-center">
              <UserIcon /> Student Marks
            </h3>

            {students.map(s => (
              <div key={s.student_id} className="mt-2 border p-2 rounded">

                <div className="font-bold">{s.name}</div>

                <div className="flex gap-2 mt-1">
                  {questions.map(q => {
                    const key = `${s.student_id}-${q.clo}`;

                    return (
                      <input
                        key={key}
                        type="number"
                        className="w-16 border text-center"
                        onChange={(e) =>
                          handleMarksChange(key, e.target.value)
                        }
                      />
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        

        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white w-full mt-6 py-2 rounded"
        >
          Save Assessment
        </button>

      </div>
      {showCQI && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">

    {/* MODAL BOX */}
    <div className="bg-white w-[90%] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6 relative">

      {/* CLOSE BUTTON */}
      <button
        onClick={() => setShowCQI(false)}
        className="absolute top-3 right-3 text-red-500 font-bold text-lg"
      >
        ✕
      </button>

      {/* CQI COMPONENT */}
      <CQI
        weakClos={weakClos}
        courseId={courseId}
        batchId={batchId}
        semesterId={semesterId}
        onComplete={() => setShowCQI(false)}
      />

    </div>
  </div>
)}
    </motion.div>
  );
};

export default ManageClass;