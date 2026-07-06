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
  semesterNumber: string;
  semesterId: string;
  selectedCourse?: InstructorCourse | null;
}

const ManageClass: React.FC<Props> = ({ courseId, batchId, semesterNumber, semesterId, selectedCourse }) => {

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
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
        setStudents(studentList);
      })
      .catch(() => setStudents([]));
  }, [batchId]);
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

// 🔥 CQI trigger
if (response.data.trigger_cqi) {

    const cqiCheck = await api.get(
        `/assessments/cqi/check/${assessmentId}/`
    );

    setWeakClos(cqiCheck.data.weak_clos || []);
    setShowCQI(true);

}
else {

    toast.success("Report sent to Coordinator.");

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

{q.level}

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
