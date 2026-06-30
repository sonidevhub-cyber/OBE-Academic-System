import React, { useEffect, useState } from "react";
import { api } from "../../api/api";

interface Props {
  courseId: string;
  batchId: string;
  semesterId: string;
}

const AssessmentHistory: React.FC<Props> = ({
  courseId,
  batchId,
  semesterId,
}) => {

  const [loading, setLoading] = useState(true);

  const [assessments, setAssessments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

const [studentMarks, setStudentMarks] = useState<any[]>([]);

const [allowEditing, setAllowEditing] = useState(false);
const [editedMarks, setEditedMarks] = useState<any[]>([]);
const handleView = async (assessment: any) => {

  try {

    const res = await api.get(
      `/assessments/history/${assessment.id}/`
    );

    setSelectedAssessment(assessment);

    setStudentMarks(res.data.students);
    setEditedMarks(res.data.students);
    setAllowEditing(res.data.allow_editing);

    setOpen(true);

  } catch (err) {

    console.log(err);

  }

};

  useEffect(() => {

    fetchHistory();

  }, [courseId, batchId, semesterId]);

  const fetchHistory = async () => {

    try {

      const res = await api.get(
        `/assessments/history/`,
        {
          params: {
            course: courseId,
            batch: batchId,
            semester: semesterId,
          },
        }
      );

      setAssessments(res.data);

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  };
  const saveChanges = async () => {

  const payload: any[] = [];

  editedMarks.forEach((student: any) => {

    student.questions.forEach((q: any) => {

      payload.push({
        mark_id: q.mark_id,
        marks_obtained: q.marks_obtained,
      });

    });

  });

  try {

    await api.put("/assessments/update-student-marks/", {
      marks: payload,
    });

    alert("Marks Updated Successfully");

    setOpen(false);

    fetchHistory();

  } catch (err) {

    console.log(err);

  }

};

  if (loading) {

    return (
      <div className="text-center p-5">
        Loading...
      </div>
    );

  }

  return (

    <div className="bg-white rounded shadow p-5">

      <h2 className="text-xl font-bold mb-5">
        Assessment History
      </h2>

      <table className="w-full border">

        <thead>

          <tr className="bg-gray-100">

            <th className="border p-2">
              #
            </th>

            <th className="border p-2">
              Title
            </th>

            <th className="border p-2">
              Type
            </th>

            <th className="border p-2">
              Total Marks
            </th>

            <th className="border p-2">
              Date
            </th>

            <th className="border p-2">
              Action
            </th>

          </tr>

        </thead>

        <tbody>

          {assessments.map((assessment, index) => (

            <tr key={assessment.id}>

              <td className="border p-2 text-center">
                {index + 1}
              </td>

              <td className="border p-2">
                {assessment.title}
              </td>

              <td className="border p-2 text-center">
                {assessment.assessment_type}
              </td>

              <td className="border p-2 text-center">
                {assessment.total_marks}
              </td>

              <td className="border p-2 text-center">
                {assessment.date}
              </td>

              <td className="border p-2 text-center">

                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => handleView(assessment)}
                >
                  View
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>
      {
allowEditing && (

<div className="flex justify-end mt-5">

<button
onClick={saveChanges}
className="bg-green-600 text-white px-5 py-2 rounded"
>

Save Changes

</button>

</div>

)
}
      {
open && (

<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">

<div className="bg-white w-11/12 max-h-[90vh] overflow-auto rounded p-5">

<div className="flex justify-between mb-5">

<h2 className="text-xl font-bold">

{selectedAssessment?.title}

</h2>

<button
onClick={() => setOpen(false)}
className="text-red-600 font-bold"
>

✕

</button>

</div>

<table className="w-full border">

  <thead>

    <tr>

      <th className="border p-2">Student</th>

      {editedMarks.length > 0 &&
        editedMarks[0].questions.map((q: any, index: number) => (
          <th key={index} className="border p-2">
            {q.question}
            <br />
            <span className="text-xs">({q.total_marks})</span>
          </th>
        ))}

      <th className="border p-2">Total</th>

    </tr>

  </thead>

  <tbody>

    {editedMarks.map((student: any, studentIndex: number) => (

      <tr key={student.student_id}>

        <td className="border p-2">
          {student.name}
        </td>

        {student.questions.map((q: any, qIndex: number) => (

          <td key={qIndex} className="border p-2">

            <input
              type="number"
              className="border w-16 text-center"
              value={q.marks_obtained ?? ""}
              min={0}
              max={q.total_marks}
              onChange={(e) => {

                const value = Number(e.target.value);

                const copy = [...editedMarks];

                copy[studentIndex].questions[qIndex].marks_obtained = value;

                setEditedMarks(copy);

              }}
            />

          </td>

        ))}

        <td className="border p-2 font-bold">

          {student.questions.reduce(
            (sum: number, q: any) => sum + Number(q.marks_obtained),
            0
          )}

        </td>

      </tr>

    ))}

  </tbody>

</table>
</div>

</div>

)
}

    </div>

  );

};

export default AssessmentHistory;