import React, { useEffect, useState } from "react";
import { feedbackService } from "../../api/FeedbackServices";

interface Props {
  onSubmitSuccess?: () => void;
}

const StudentFeedbackPopup: React.FC<Props> = ({ onSubmitSuccess }) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [responses, setResponses] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await feedbackService.getQuestions();
      console.log("Questions API:", res);
      setCourses(res);
    } catch (err) {
      console.error("Question fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (cloId: string, value: string) => {
    setResponses((prev: any) => ({
      ...prev,
      [cloId]: parseInt(value, 10),
    }));
  };

  const isComplete =
    courses.length > 0 &&
    courses.every((course) =>
      course.questions.every((clo: any) => responses[clo.clo_id])
    );

  const handleSubmit = async () => {
    try {
      const payload: any[] = [];

      courses.forEach((course) => {
        course.questions.forEach((clo: any) => {
          payload.push({
            course: course.course_id,
            clo: clo.clo_id,
            rating: responses[clo.clo_id],
          });
        });
      });

      console.log("Submitting Feedback:", payload);
      await feedbackService.submitFeedback(payload);

      alert("✅ Feedback Submitted");

      // ✅ Popup band karo — reload nahi
      onSubmitSuccess?.();
    } catch (err) {
      console.error(err);
      alert("❌ Error submitting feedback");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center">
        Course Feedback
      </h2>

      {courses.map((course) => (
        <div key={course.course_id} className="border rounded-lg p-4 mb-4">
          <h3 className="font-bold text-lg mb-3">{course.course_name}</h3>

          {course.questions.map((clo: any) => (
            <div key={clo.clo_id} className="mb-4">
              <p className="mb-2">{clo.question}</p>
              <select
                className="border p-2 rounded w-full"
                value={responses[clo.clo_id] || ""}
                onChange={(e) => handleChange(clo.clo_id, e.target.value)}
              >
                <option value="">Select Rating</option>
                <option value="1">1 ⭐</option>
                <option value="2">2 ⭐⭐</option>
                <option value="3">3 ⭐⭐⭐</option>
                <option value="4">4 ⭐⭐⭐⭐</option>
                <option value="5">5 ⭐⭐⭐⭐⭐</option>
              </select>
            </div>
          ))}
        </div>
      ))}

      <div className="flex justify-end mt-6">
        <button
          disabled={!isComplete}
          onClick={handleSubmit}
          className={`px-6 py-2 rounded-lg text-white ${
            isComplete
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

export default StudentFeedbackPopup;