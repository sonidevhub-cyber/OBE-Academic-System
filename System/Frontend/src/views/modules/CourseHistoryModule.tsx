import React, { useEffect, useState } from "react";
import { Eye, FileText } from "lucide-react";
import courseHistoryService from "../../api/courseHistoryService";

interface CourseHistoryItem {
  id?: number | string;
  allocation_id?: number | string;

  course_name?: string;
  course_code?: string;

  course?: {
    name?: string;
    code?: string;
  };

  batch_name?: string;
  batch_id?: number | string;

  batch?: {
    name?: string;
  };

  semester_name?: string;
  semester_no?: number | string;

  semester?: {
    name?: string;
  };
}

interface CourseHistoryModuleProps {
  onViewReport?: (course: CourseHistoryItem) => void;
}

const CourseHistoryModule: React.FC<CourseHistoryModuleProps> = ({
  onViewReport,
}) => {
  const [history, setHistory] = useState<CourseHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await courseHistoryService.getHistory();

        const data =
          response.data?.data ||
          response.data?.results ||
          response.data ||
          [];

        setHistory(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Course history error:", err);

        if (err?.response?.status === 401) {
          setError("Unauthorized. Please login again.");
        } else {
          setError("Failed to load course history.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">
          Loading course history...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Previous Teaching Assignments
        </p>

        <h2 className="mt-1 text-2xl font-black text-gray-900">
          Course History
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          View your previously taught courses and their reports.
        </p>
      </div>

      {/* EMPTY */}
      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />

          <p className="font-semibold text-gray-600">
            No course history found.
          </p>

          <p className="mt-1 text-sm text-gray-400">
            Previous semester courses will appear here.
          </p>
        </div>
      ) : (

        /* COURSES */
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {history.map((item, index) => {

            const courseName =
              item.course_name ||
              item.course?.name ||
              "Course";

            const courseCode =
              item.course_code ||
              item.course?.code ||
              "";

            const batchName =
              item.batch_name ||
              item.batch?.name ||
              "N/A";

            const semester =
              item.semester_name ||
              item.semester?.name ||
              item.semester_no ||
              "N/A";

            return (
              <div
                key={item.id || item.allocation_id || index}
                className="
                  group
                  rounded-2xl
                  border border-gray-100
                  bg-white
                  p-5
                  shadow-sm
                  transition-all
                  hover:-translate-y-1
                  hover:shadow-lg
                "
              >

                {/* COURSE */}
                <div>
                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <h3 className="truncate text-lg font-black text-gray-900">
                        {courseName}
                      </h3>

                      <p className="mt-1 text-sm font-semibold text-indigo-600">
                        {courseCode}
                      </p>

                    </div>

                    <div className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-indigo-50
                      text-indigo-600
                    ">
                      <FileText className="h-5 w-5" />
                    </div>

                  </div>
                </div>

                {/* DETAILS */}
                <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-500">
                      Batch
                    </span>

                    <span className="font-semibold text-gray-800">
                      {batchName}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-500">
                      Semester
                    </span>

                    <span className="font-semibold text-gray-800">
                      {semester}
                    </span>
                  </div>

                </div>

                {/* REPORT BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    if (onViewReport) {
                      onViewReport(item);
                    }
                  }}
                  disabled={!onViewReport}
                  className="
                    mt-5
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-indigo-600
                    px-4
                    py-2.5
                    text-sm
                    font-bold
                    text-white
                    transition
                    hover:bg-indigo-700
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <Eye className="h-4 w-4" />
                  View OBE Report
                </button>

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
};

export default CourseHistoryModule;