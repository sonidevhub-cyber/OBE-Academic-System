import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { toast } from "react-toastify";

interface EditAssessmentViewProps {
  assessmentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAssessmentView({ assessmentId, onClose, onSuccess }: EditAssessmentViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [marks, setMarks] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetchAssessmentDetail();
  }, [assessmentId]);

  const fetchAssessmentDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`assessments/history/${assessmentId}/`);
      const data = res.data;
      const assessmentObj = data.assessment || data;

      setAssessmentData(assessmentObj);

      // 1. Check multiple paths for questions
      let rawQuestions = Array.isArray(assessmentObj.questions) 
        ? assessmentObj.questions 
        : Array.isArray(data.questions) 
        ? data.questions 
        : [];

      const studentRows = Array.isArray(assessmentObj.students)
        ? assessmentObj.students
        : Array.isArray(data.students)
        ? data.students
        : [];

      // 2. Fallback: agar backend se questions ki list empty aaye, 
      // lekin student ke andar marks list ho, tou wahan se questions bana lein
      if (rawQuestions.length === 0 && studentRows.length > 0) {
        const firstStudentMarks = studentRows[0].questions || studentRows[0].marks || [];
        if (firstStudentMarks.length > 0) {
          rawQuestions = firstStudentMarks.map((qm: any, idx: number) => ({
            id: qm.question_id || qm.id || `q-${idx}`,
            marks: qm.max_marks || qm.total_marks || assessmentObj.total_marks || 0
          }));
        }
      }

      // 3. Absolute Fallback: Agar phir bhi questions na milein aur quiz/assignment ho, 
      // tou kam az kam 1 default question bana dein taake input show ho jaye
      if (rawQuestions.length === 0) {
        rawQuestions = [{ id: 'default-q1', marks: assessmentObj.total_marks || 0 }];
      }

      setQuestions(rawQuestions);
      setStudents(studentRows);

      // 4. Load existing marks safely
      const loadedMarks: { [key: string]: any } = {};
      studentRows.forEach((student: any) => {
        const sId = String(student.student_id || student.id || student.user_id);
        const qMarksList = Array.isArray(student.questions)
          ? student.questions
          : Array.isArray(student.marks)
          ? student.marks
          : [];

        if (qMarksList.length > 0) {
          qMarksList.forEach((qMark: any, qIdx: number) => {
            const key = `${sId}-${qIdx}`;
            loadedMarks[key] = qMark.marks_obtained ?? qMark.obtained_marks ?? qMark.marks ?? 0;
          });
        } else {
          // Agar student ki apni marks list empty ho, default 0 set karein
          rawQuestions.forEach((_: any, qIdx: number) => {
            loadedMarks[`${sId}-${qIdx}`] = 0;
          });
        }
      });

      setMarks(loadedMarks);
    } catch (err) {
      console.error("Failed to load assessment for editing", err);
      toast.error("Failed to load assessment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (key: string, value: string) => {
    setMarks((prev) => ({
      ...prev,
      [key]: value === "" ? "" : Number(value)
    }));
  };

  const handleUpdateSubmit = async () => {
    setSaving(true);
    try {
      const payload: any[] = [];

      students.forEach((s: any) => {
        const sId = String(s.student_id || s.id || s.user_id || "");
        if (!sId) return;

        const studentMarksList = Array.isArray(s.questions) 
          ? s.questions 
          : Array.isArray(s.marks) 
          ? s.marks 
          : [];

        if (assessmentData?.type === "sessional") {
          const key = `${sId}-0`;
          const qItem = studentMarksList[0] || questions[0] || {};
          const qId = qItem.id || qItem.question_id || qItem.mark_id;
          const mId = qItem.mark_id || qItem.id;

          if (qId !== undefined && qId !== null && qId !== "") {
            payload.push({
              student_id: sId,
              question_id: String(qId),
              mark_id: mId ? String(mId) : undefined,
              marks_obtained: Number(marks[key] ?? 0)
            });
          }
        } else {
          questions.forEach((bq: any, index: number) => {
            const key = `${sId}-${index}`;
            const matchingQ = studentMarksList[index] || studentMarksList.find((item: any) => 
              String(item.question_id || item.id) === String(bq.id || bq.question_id)
            ) || bq;

            const qId = matchingQ.id || matchingQ.question_id || bq.id;
            const mId = matchingQ.mark_id;

            if (qId !== undefined && qId !== null && qId !== "") {
              payload.push({
                student_id: sId,
                question_id: String(qId),
                mark_id: mId ? String(mId) : undefined,
                marks_obtained: Number(marks[key] ?? 0)
              });
            }
          });
        }
      });

      if (payload.length === 0) {
        toast.error("No valid student or question data found to update. Please ensure questions have valid IDs.");
        setSaving(false);
        return;
      }

      await api.put(`assessments/update-marks/`, { marks: payload });
      toast.success("Assessment marks updated successfully! ✅");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Update error:", err?.response?.data || err);
      toast.error(err?.response?.data?.error || "Failed to update assessment marks.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500 font-medium">Loading assessment details...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Edit Marks: {assessmentData?.title}</h3>
          <span className="inline-flex items-center gap-1.5 mt-1 text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full font-semibold capitalize">
            Type: {assessmentData?.type} | Total Marks: {assessmentData?.total_marks}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
        >
          ✕ Close
        </button>
      </div>

      <div className="overflow-x-auto max-h-[50vh] rounded-2xl border border-gray-100 shadow-sm">
        <table className="min-w-full border-collapse bg-white">
          <thead>
            <tr className="bg-gray-50/80 text-xs font-black uppercase tracking-wider text-gray-500 sticky top-0 border-b border-gray-100">
              <th className="p-4 text-left">Student Name</th>
              {assessmentData?.type === "sessional" ? (
                <th className="p-4 text-center">Obtained Marks</th>
              ) : (
                questions.map((_, qIdx) => (
                  <th key={qIdx} className="p-4 text-center">
                    Q{qIdx + 1} <span className="text-gray-400 font-normal">({questions[qIdx]?.marks || 0})</span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {students.map((student: any) => {
              const sId = String(student.student_id || student.id || student.user_id);
              return (
                <tr key={sId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-semibold text-sm text-gray-900">{student.name}</td>
                  {assessmentData?.type === "sessional" ? (
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        className="w-24 rounded-xl border border-gray-200 bg-amber-50/50 px-3 py-1.5 text-center text-sm font-bold text-gray-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        value={marks[`${sId}-0`] ?? ""}
                        onChange={(e) => handleMarksChange(`${sId}-0`, e.target.value)}
                      />
                    </td>
                  ) : (
                    questions.map((_, qIdx) => {
                      const key = `${sId}-${qIdx}`;
                      return (
                        <td key={qIdx} className="p-4 text-center">
                          <input
                            type="number"
                            className="w-20 rounded-xl border border-gray-200 bg-amber-50/50 px-3 py-1.5 text-center text-sm font-bold text-gray-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            value={marks[key] ?? ""}
                            onChange={(e) => handleMarksChange(key, e.target.value)}
                          />
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpdateSubmit}
          disabled={saving}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-amber-600/20 disabled:bg-gray-300 transition-all"
        >
          {saving ? "Saving Changes..." : "Save Updated Marks"}
        </button>
      </div>
    </div>
  );
}