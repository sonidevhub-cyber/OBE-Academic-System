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

type AssessmentHistoryItem = {
  id: string;
  title: string;
  type: string;
  date: string;
  total_marks: number;
  obtained: number;
  questions_count: number;
  is_finalized: boolean;
};

const BLOOM_DISPLAY_MAP: Record<string, string> = {
  C1: "C1 - Remembering",
  C2: "C2 - Understanding",
  C3: "C3 - Applying",
  C4: "C4 - Analyzing",
  C5: "C5 - Evaluating",
  C6: "C6 - Creating",
  K1: "C1 - Remembering",
  K2: "C2 - Understanding",
  K3: "C3 - Applying",
  K4: "C4 - Analyzing",
  K5: "C5 - Evaluating",
  K6: "C6 - Creating",
};

const formatBloomLevel = (level: string) => {
  const code = level?.trim().split(" ")[0];
  return BLOOM_DISPLAY_MAP[code] || level;
};

interface Props {
  courseId: string;
  batchId: string;
  semesterNumber: string;
  semesterId: string;
  selectedCourse?: InstructorCourse | null;
  curriculumVersionId?: string | number;
  historyBatchId?: string;
  historySemesterId?: string | number;
  retakeStudentId?: string;
  retakeId?: string;
}

const ManageClass: React.FC<Props> = ({
  courseId,
  batchId,
  semesterNumber,
  semesterId,
  selectedCourse,
  curriculumVersionId,
  historyBatchId,
  historySemesterId,
  retakeStudentId,
  retakeId,
}) => {
  const isRetakeMode = Boolean(retakeStudentId || retakeId);
  const effectiveCurriculumVersionId = String(
    curriculumVersionId ??
    selectedCourse?.curriculum_version_id ??
    ''
  );

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [weakClos, setWeakClos] = useState<any[]>([]);
  const [showCQI, setShowCQI] = useState(false);
  const [previousCQI, setPreviousCQI] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([
    { clo: "", description: "", level: "", kpi: 0, marks: 0 }
  ]);

  const [students, setStudents] = useState<Student[]>([]);
  const [clos, setClos] = useState<CLO[]>([]);
  const [marks, setMarks] = useState<{ [key: string]: number }>({});
  const [checkedCQI, setCheckedCQI] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);
  // ================= TYPE RESET =================
  const handleTypeChange = (value: string) => {
    setType(value);
    setQuestions([{ clo: "", description: "", level: "", kpi: 0, marks: 0 }]);
    setMarks({});
  };

  // ================= FETCH CLO =================
  useEffect(() => {
    if (!courseId || !effectiveCurriculumVersionId) {
      console.log("Course ID or curriculum version ID missing for CLO fetch", {
        courseId,
        effectiveCurriculumVersionId,
      });
      return;
    }

    const fetchClos = async () => {
      try {
        const res = await api.get(`/obe/courses/${courseId}/versions/${effectiveCurriculumVersionId}/clos/`);
        const versionClos = Array.isArray(res.data) ? res.data : [];

        if (versionClos.length > 0) {
          console.log("CLO API response (version-specific):", versionClos);
          setClos(versionClos);
          return;
        }

        const fallbackRes = await api.get(`/obe/courses/${courseId}/clo-ga-matrix/`);
        const fallbackClos = Array.isArray(fallbackRes.data?.clos) ? fallbackRes.data.clos : [];
        console.log("CLO API response (course fallback):", fallbackClos);
        setClos(fallbackClos);
      } catch (err) {
        console.error("Failed to fetch CLOs:", err);
        setClos([]);
      }
    };

    fetchClos();
  }, [courseId, effectiveCurriculumVersionId]);

  // ================= FETCH STUDENTS =================
  useEffect(() => {
    if (!batchId) return;

    api.get(`/students/?batch=${batchId}`)
      .then(res => {
        const data = res.data;
        let studentList = [];
        if (Array.isArray(data)) {
          studentList = data;
        } else if (data?.results) {
          studentList = data.results;
        } else if (data?.items) {
          studentList = data.items;
        } else if (data?.students) {
          studentList = data.students;
        }
        const filteredStudents = retakeStudentId
          ? studentList.filter((student: any) => {
              return (
                String(student.student_id || student.id || '') === String(retakeStudentId) ||
                String(student.id || '') === String(retakeStudentId)
              );
            })
          : studentList;

        setStudents(filteredStudents);
      })
      .catch(() => setStudents([]));
  }, [batchId, retakeStudentId]);
  // 🔥 CHECK REJECTED CQI
  useEffect(() => {
  if (!courseId || !batchId || !semesterNumber) {
    console.log("Missing params:", { courseId, batchId, semesterNumber });
    return;
  }

  api.get(`/assessments/cqi/check-status/`, {
    params: {
      course: courseId,
      batch: batchId,
      semester: semesterNumber
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
}, [courseId, batchId, semesterNumber]);
useEffect(() => {

    if (!courseId || clos.length === 0) return;

    const fetchPreviousCQI = async () => {

        const list: any[] = [];

        for (const clo of clos) {

            try {

                const res = await api.get(
                    "/assessments/previous-cqi/",
                    {
                        params: {
                            course: courseId,
                            clo: clo.id
                        }
                    }
                );

                if (res.data.show_previous_cqi) {
                    list.push(res.data);
                }

            } catch (err) {}

        }

        setPreviousCQI(list);

    };

    fetchPreviousCQI();

}, [courseId, clos]);

  const loadAssessmentHistory = async () => {
      if (!isRetakeMode || !retakeStudentId || !courseId || !batchId || !semesterNumber) {
        setAssessmentHistory([]);
        return;
      }

      try {
        setHistoryLoading(true);

        const params: any = {};

        if (retakeId) {
          params.retake_id = retakeId;
        } else {
          const preferredHistoryBatchId = historyBatchId || batchId;
          const preferredHistorySemesterNumber = String(historySemesterId || semesterNumber || '');
          params.course = courseId;
          params.batch = preferredHistoryBatchId;
          params.semester = preferredHistorySemesterNumber;
        }

        const historyResponse = await api.get('/assessments/history/', { params });

        let assessmentRows = Array.isArray(historyResponse.data) ? historyResponse.data : [];

        if (assessmentRows.length === 0) {
          const fallbackHistoryResponse = await api.get('/assessments/history/', {
            params: {
              course: courseId,
              batch: batchId,
              semester: semesterNumber,
            },
          });
          assessmentRows = Array.isArray(fallbackHistoryResponse.data) ? fallbackHistoryResponse.data : [];
        }

        const detailedHistory = await Promise.all(
          assessmentRows.map(async (assessment: any) => {
            try {
              const marksResponse = await api.get(`/assessments/history/${assessment.id}/`);
              const studentRows = Array.isArray(marksResponse.data?.students) ? marksResponse.data.students : [];
              const matchedStudent = studentRows.find((row: any) => String(row.student_id || '') === String(retakeStudentId));

              if (!matchedStudent) return null;

              return {
                id: String(assessment.id),
                title: assessment.title,
                type: assessment.type,
                date: assessment.date,
                total_marks: Number(assessment.total_marks || 0),
                obtained: Number(matchedStudent.total || 0),
                questions_count: Array.isArray(matchedStudent.questions) ? matchedStudent.questions.length : 0,
                is_finalized: Boolean(assessment.is_finalized),
              } as AssessmentHistoryItem;
            } catch (error) {
              console.error('Failed to load assessment history detail', error);
              return null;
            }
          })
        );

        setAssessmentHistory(detailedHistory.filter(Boolean) as AssessmentHistoryItem[]);
      } catch (error) {
        console.error('Failed to load assessment history', error);
        setAssessmentHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

  useEffect(() => {
    loadAssessmentHistory();
  }, [isRetakeMode, retakeStudentId, courseId, batchId, semesterNumber, historyBatchId, historySemesterId, retakeId]);
  // ================= CLO SELECT =================
  const handleCLOChange = (value: string, index: number) => {

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

  // Agar last row complete nahi hai to nayi row na add ho
  const last = questions[questions.length - 1];

  if (!last.clo) {
    toast.error("Please select CLO first.");
    return;
  }

  setQuestions([
    ...questions,
    {
      clo: "",
      description: "",
      level: "",
      kpi: 0,
      marks: 0
    }
  ]);
};

  // ================= MARKS =================
  const handleMarksChange = (key: string, value: string) => {
    setMarks({ ...marks, [key]: Number(value) });
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    try {
      if (saving) return;

      setSaving(true);

      if (!title || !type || !totalMarks || !date) {
        toast.error("Fill all fields");
        return;
      }


      // ================= NORMAL ASSESSMENT =================
      const totalQ = questions.reduce((sum, q) => sum + q.marks, 0);

      if (totalQ !== Number(totalMarks)) {
        toast.error("Question marks must equal total marks");
        return;
      }
      // ================= FINAL CLO VALIDATION =================
if (type === "final") {

    const res = await api.post("/assessments/clo-coverage/", {
        course: courseId,
        batch: batchId,
        semester: semesterId,
        curriculum_version: effectiveCurriculumVersionId,
        current_clos: questions.map(q => q.clo),
    });

    if (!res.data.all_clos_covered) {

        toast.error(
            "Please assess these CLOs before Final: " +
            res.data.missing_clos
                .map((c: any) => `CLO ${c.order}`)
                .join(", ")
        );

        return;
    }
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
            questions: cleanQuestions,
            retake_id: retakeId
        });

      const assessmentId = res.data.assessment_id;
      const backendQuestions = res.data.questions;

      const cloMap: any = {};
      backendQuestions.forEach((q: any) => {
        cloMap[q.clo] = q.id;
      });

      const payload: any[] = [];

      students.forEach(s => {
        questions.forEach((q, index) => {
          const key = `${s.student_id}-${index}`;

          payload.push({
            student_id: s.student_id,
            question_id: backendQuestions[index].id,
            marks: Number(marks[key] || 0)
          });
        });
      });

      const response = await api.post(
  `/assessments/${assessmentId}/enter-marks/`,
  payload
);

// 🔥 Refresh assessment history if in retake mode
if (isRetakeMode) {
  await loadAssessmentHistory();
}

// 🔥 CQI trigger
if (response.data.trigger_cqi) {

    const cqiCheck = await api.get(
        `/assessments/cqi/check/${assessmentId}/`
    );

    setWeakClos(cqiCheck.data.weak_clos || []);
    setShowCQI(true);

}
else {

    toast.success("Assessment saved successfully.");

}

toast.success("Assessment completed ✅");
setTitle("");
setType("");
setTotalMarks("");
setDate("");

setQuestions([
  {
    clo: "",
    description: "",
    level: "",
    kpi: 0,
    marks: 0,
  },
]);

setMarks({});
                        
    } catch (err: any) {
      console.error(err?.response?.data);
      toast.error(JSON.stringify(err?.response?.data));
    }finally {
    setSaving(false);
}
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="p-5 bg-white rounded shadow">

        {isRetakeMode && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
            Retake mode is active. This assessment is limited to the assigned retake student.
          </div>
        )}

        {isRetakeMode && (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-lg font-bold text-gray-900">Assessment History</h3>
              <p className="text-sm text-gray-500">
                Assessments marked for this student in the current course and batch.
              </p>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <div className="py-4 text-sm font-medium text-gray-500">Loading assessment history...</div>
              ) : assessmentHistory.length === 0 ? (
                <div className="py-4 text-sm font-medium text-gray-500">
                  No assessments found for this student yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                        <th className="pb-3 pr-4">Assessment</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Marks</th>
                        <th className="pb-3 pr-4">Questions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentHistory.map((item) => {
                        const percentage = item.total_marks > 0
                          ? ((item.obtained / item.total_marks) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <tr key={item.id} className="border-b border-gray-50 last:border-b-0">
                            <td className="py-3 pr-4 font-semibold text-gray-900">{item.title}</td>
                            <td className="py-3 pr-4 text-sm text-gray-600 capitalize">{item.type}</td>
                            <td className="py-3 pr-4 text-sm text-gray-600">{item.date}</td>
                            <td className="py-3 pr-4 text-sm">
                              <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                                item.is_finalized
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {item.is_finalized ? 'Finalized' : 'In Progress'}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-sm font-semibold text-gray-700">
                              {item.obtained}/{item.total_marks} ({percentage}%)
                            </td>
                            <td className="py-3 pr-4 text-sm text-gray-600">{item.questions_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

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
        {/* Previous Approved CQI */}

{previousCQI.length > 0 && (

<div className="bg-green-50 border rounded p-4 mb-5">

<h2 className="font-bold text-green-700">
Previous Approved CQI
</h2>

{previousCQI.map((item, index) => (

<div
key={index}
className="border rounded p-3 mt-3"
>

<p><b>CLO:</b> {item.clo}</p>

<p><b>Reason:</b> {item.reason}</p>

<p><b>Action Plan:</b> {item.action_plan}</p>

</div>

))}

</div>

)}
  <h3 className="font-bold flex gap-2 items-center mb-2">
    <TaskIcon />
    CLO Mapping
  </h3>

 <table className="w-full border mt-3">

<thead className="bg-gray-100">

<tr>
<th className="border p-2">Questions</th>
<th className="border p-2">CLO</th>

<th className="border p-2">Description</th>

<th className="border p-2">Bloom</th>

<th className="border p-2">KPI</th>

<th className="border p-2">Marks</th>

</tr>

</thead>

<tbody>

{questions.map((q,index)=>(

<tr key={index}>
  <td className="border p-2 font-semibold text-center">
  Q{index + 1}
</td>

<td className="border p-2">

<select
value={q.clo}
onChange={(e)=>handleCLOChange(e.target.value,index)}
className="w-full border rounded p-1"
>

<option>Select CLO</option>

{clos.map(c=>(

<option key={c.id} value={c.id}>
CLO {c.order_number}
</option>

))}

</select>

</td>

<td className="border p-2">

{q.description}

</td>

<td className="border p-2">

{formatBloomLevel(q.level)}

</td>

<td className="border p-2">

{q.kpi}%

</td>

<td className="border p-2">

<input
type="number"
value={q.marks}
className="border w-20 p-1"
onChange={(e)=>handleQuestionMarks(e.target.value,index)}
/>

</td>

</tr>

))}

</tbody>

</table>
  <button
  onClick={addCLO}
  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
>
  + Add Question
</button>
</div>



        {/* STUDENTS NORMAL */}
       
         <div className="overflow-auto mt-5">

<table className="w-full border">

<thead>

<tr className="bg-gray-100">

<th className="border p-2">

Student

</th>

{questions.map((q,index)=>(

<th
key={index}
className="border p-2"
>

{q.clo
  ? `Q${index + 1} (CLO ${clos.find(c => c.id === q.clo)?.order_number})`
  : `Q${index + 1}`}

</th>

))}

<th className="border p-2">

Total

</th>

</tr>

</thead>

<tbody>

{students.map(student=>{

let total=0;

return(

<tr key={student.student_id}>

<td className="border p-2">

{student.name}

</td>

{questions.map((q,index)=>{

const key=`${student.student_id}-${index}`;

const value=marks[key]||0;

total+=value;

return(

<td
key={index}
className="border p-2"
>

<input
  type="number"
  min={0}
  max={q.marks}
  className="border w-16 text-center"
  value={value}
  onChange={(e) => {
    const val = Number(e.target.value);

    if (val <= q.marks) {
      handleMarksChange(key, e.target.value);
    }
  }}
/>
</td>

);

})}

<td className="border p-2 font-bold text-green-700 bg-green-50">

{total}

</td>

</tr>

);

})}

</tbody>

</table>

</div>
        

        <button
    disabled={saving}
    onClick={handleSubmit}
    className={`w-full mt-6 py-2 rounded text-white ${
        saving
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600"
    }`}
>
    {saving ? "Saving..." : "Save Assessment"}
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
        semesterNumber={semesterNumber}
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
