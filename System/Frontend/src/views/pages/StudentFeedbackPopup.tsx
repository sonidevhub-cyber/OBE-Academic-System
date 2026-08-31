import React, { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Send, Star } from "lucide-react";
import { feedbackService } from "../../api/FeedbackServices";
import toast from "react-hot-toast";

interface Props {
  onSubmitSuccess?: () => void;
}

const StudentFeedbackPopup: React.FC<Props> = ({ onSubmitSuccess }) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [responses, setResponses] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await feedbackService.getQuestions();

      console.log("Questions API:", res);

      setCourses(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Question fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (cloId: string, value: number) => {
    setResponses((prev: any) => ({
      ...prev,
      [cloId]: value,
    }));
  };

  // ==========================================
  // TOTAL QUESTIONS
  // ==========================================
  const totalQuestions = courses.reduce(
    (total, course) => total + (course.questions?.length || 0),
    0
  );

  // ==========================================
  // COMPLETED QUESTIONS
  // ==========================================
  const completedQuestions = courses.reduce(
    (total, course) =>
      total +
      (course.questions || []).filter(
        (clo: any) => responses[clo.clo_id]
      ).length,
    0
  );

  // ==========================================
  // PROGRESS
  // ==========================================
  const progress =
    totalQuestions > 0
      ? Math.round((completedQuestions / totalQuestions) * 100)
      : 0;

  const isComplete =
    totalQuestions > 0 &&
    completedQuestions === totalQuestions;

  // ==========================================
  // SUBMIT
  // ==========================================
  const handleSubmit = async () => {
    if (!isComplete || submitting) return;

    try {
      setSubmitting(true);

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

      toast.success("Feedback Submitted Successfully!");

      onSubmitSuccess?.();
    } catch (err) {
      console.error("Feedback submit error:", err);
      toast.error("Error submitting feedback");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // LOADING
  // ==========================================
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />

          <p className="text-sm font-medium text-gray-600">
            Loading course feedback...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // EMPTY
  // ==========================================
  if (courses.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-gray-300" />

          <h3 className="text-lg font-semibold text-gray-700">
            No Feedback Available
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Course feedback is currently not available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}
      <div className="shrink-0 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 px-6 py-5 text-white">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            <BookOpen className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              Course Feedback
            </h2>

            <p className="mt-1 text-sm text-indigo-100">
              Rate each course based on your learning experience.
            </p>
          </div>

        </div>

        {/* Progress */}
        <div className="mt-5">

          <div className="mb-2 flex items-center justify-between text-xs font-medium text-indigo-100">

            <span>
              Feedback Progress
            </span>

            <span>
              {completedQuestions} / {totalQuestions} completed
            </span>

          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/20">

            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

        </div>

      </div>


      {/* ================================================= */}
      {/* CONTENT */}
      {/* ================================================= */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-5">

        <div className="space-y-4">

          {courses.map((course) => {

            const courseQuestions = course.questions || [];

            const courseCompleted = courseQuestions.filter(
              (clo: any) => responses[clo.clo_id]
            ).length;

            const courseComplete =
              courseQuestions.length > 0 &&
              courseCompleted === courseQuestions.length;

            return (
              <div
                key={course.course_id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >

                {/* Course Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <BookOpen className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {course.course_name}
                      </h3>

                      <p className="text-xs text-gray-500">
                        {courseQuestions.length}{" "}
                        {courseQuestions.length === 1
                          ? "question"
                          : "questions"}
                      </p>
                    </div>

                  </div>

                  {/* Course completion */}
                  {courseComplete ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-500">
                      {courseCompleted}/{courseQuestions.length}
                    </span>
                  )}

                </div>


                {/* Questions */}
                <div className="divide-y divide-gray-100">

                  {courseQuestions.map((clo: any, index: number) => {

                    const selectedRating =
                      responses[clo.clo_id] || 0;

                    return (
                      <div
                        key={clo.clo_id}
                        className="px-5 py-5"
                      >

                        {/* Question */}
                        <div className="mb-4 flex gap-3">

                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                            {index + 1}
                          </div>

                          <p className="pt-1 text-sm font-medium leading-6 text-gray-800">
                            {clo.question}
                          </p>

                        </div>


                        {/* Rating */}
                        <div className="rounded-xl bg-gray-50 p-4">

                          <div className="mb-3 flex items-center justify-between">

                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Your Rating
                            </span>

                            <span
                              className={`text-sm font-bold ${
                                selectedRating
                                  ? "text-indigo-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {selectedRating
                                ? `${selectedRating} / 5`
                                : "Not rated"}
                            </span>

                          </div>


                          {/* Stars */}
                          <div className="flex items-center gap-2">

                            {[1, 2, 3, 4, 5].map((star) => {

                              const active =
                                selectedRating >= star;

                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() =>
                                    handleChange(
                                      clo.clo_id,
                                      star
                                    )
                                  }
                                  aria-label={`Rate ${star} out of 5`}
                                  className={`rounded-lg p-1 transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                                    active
                                      ? "text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                >
                                  <Star
                                    className="h-7 w-7"
                                    fill={
                                      active
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              );
                            })}

                          </div>


                          {/* Rating labels */}
                          <div className="mt-2 flex justify-between px-1 text-[11px] text-gray-400">
                            <span>Poor</span>
                            <span>Excellent</span>
                          </div>

                        </div>

                      </div>
                    );
                  })}

                </div>

              </div>
            );
          })}

        </div>

      </div>


      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">

        <div className="flex items-center justify-between gap-4">

          <div>

            <p className="text-sm font-semibold text-gray-700">
              {isComplete
                ? "All questions answered"
                : `${totalQuestions - completedQuestions} questions remaining`}
            </p>

            <p className="text-xs text-gray-500">
              Please rate every question before submitting.
            </p>

          </div>


          <button
            type="button"
            disabled={!isComplete || submitting}
            onClick={handleSubmit}
            className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${
              isComplete && !submitting
                ? "bg-indigo-600 hover:bg-indigo-700 hover:shadow-md"
                : "cursor-not-allowed bg-gray-300"
            }`}
          >

            <Send className="h-4 w-4" />

            {submitting
              ? "Submitting..."
              : "Submit Feedback"}

          </button>

        </div>

      </div>

    </div>
  );
};

export default StudentFeedbackPopup;