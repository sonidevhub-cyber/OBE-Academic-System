import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Award,
  BookOpen,
  GraduationCap,
  History,
  UserCheck,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { getStudentRetakeHistory } from "./retakeApi";
import { RetakeStatusBadge } from "./statusBadge";
import type { CourseRetake } from "./types";

const StudentRetakeHistory: React.FC<{ studentId: string }> = ({
  studentId,
}) => {
  const { currentUser, loading: authLoading } = useAuth();

  const role =
    currentUser?.effective_role ||
    currentUser?.active_role ||
    currentUser?.role;

  const selfStudentId =
    currentUser?.student_profile?.student_id ||
    currentUser?.student_id ||
    currentUser?.studentProfile?.student_id ||
    currentUser?.studentProfile?.id ||
    currentUser?.id;

  const canView =
    role === "SAC" ||
    role === "coordinator" ||
    role === "hod" ||
    String(selfStudentId) === String(studentId);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CourseRetake[]>([]);

  // ==============================
  // LOAD RETAKE HISTORY
  // ==============================
  useEffect(() => {
    const loadHistory = async () => {
      if (!studentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data = await getStudentRetakeHistory(studentId);

        setHistory(data);
      } catch (error) {
        console.error("Failed to load retake history", error);
        toast.error("Failed to load retake history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [studentId]);

  // ==============================
  // SORT HISTORY
  // ==============================
  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (left, right) =>
        left.attempt_number - right.attempt_number
    );
  }, [history]);

  // ==============================
  // AUTH LOADING
  // ==============================
  if (authLoading) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className="
              h-10 w-10
              rounded-full
              border-4
              border-emerald-100
              border-t-emerald-600
              animate-spin
            "
          />

          <p className="text-sm font-medium text-gray-500">
            Loading student information...
          </p>
        </div>
      </div>
    );
  }

  // ==============================
  // PERMISSION
  // ==============================
  if (!canView) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-emerald-200 shadow-sm p-10">
        <div className="flex flex-col items-center text-center">
          <div
            className="
              w-16 h-16
              rounded-2xl
              bg-emerald-50
              text-emerald-500
              flex items-center justify-center
              mb-4
            "
          >
            <UserCheck className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-gray-800">
            Access Restricted
          </h3>

          <p className="text-sm text-gray-500 mt-2 max-w-md">
            You do not have permission to view this student's
            retake history.
          </p>
        </div>
      </div>
    );
  }

  // ==============================
  // DATA LOADING
  // ==============================
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-10">
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className="
              h-12 w-12
              rounded-full
              border-4
              border-emerald-100
              border-t-emerald-600
              animate-spin
            "
          />

          <div className="text-center">
            <p className="text-base font-semibold text-gray-700">
              Loading Retake History
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Please wait while we fetch your records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==============================
  // SUMMARY COUNTS
  // ==============================
  const activeCount = sortedHistory.filter(
    (retake) => retake.is_active
  ).length;

  const completedCount = sortedHistory.filter(
    (retake) =>
      String(retake.status).toLowerCase() === "completed"
  ).length;

  // ==============================
  // MAIN UI
  // ==============================
  return (
    <div className="space-y-6">

      {/* ==============================
          PAGE HEADER
      ============================== */}
      <div
        className="
          bg-gradient-to-r
          from-emerald-600
          via-teal-600
          to-green-600
          rounded-2xl
          p-6
          text-white
          shadow-lg
          overflow-hidden
          relative
        "
      >
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute right-20 -bottom-12 w-28 h-28 rounded-full bg-white/5" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">

          <div className="flex items-center gap-4">

            <div
              className="
                w-14 h-14
                rounded-2xl
                bg-white/15
                border border-white/20
                backdrop-blur-sm
                flex items-center justify-center
              "
            >
              <History className="w-7 h-7" />
            </div>

            <div>
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest">
                Academic Record
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-1">
                Retake History
              </h2>

              <p className="text-emerald-50 text-sm mt-1">
                Complete record of your retake attempts
              </p>
            </div>

          </div>

          {/* Total Attempts */}
          <div
            className="
              bg-white/10
              border border-white/20
              backdrop-blur-sm
              rounded-xl
              px-6 py-4
              min-w-[150px]
            "
          >
            <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
              Total Attempts
            </p>

            <p className="text-3xl font-bold mt-1">
              {sortedHistory.length}
            </p>
          </div>

        </div>
      </div>

      {/* ==============================
          SUMMARY CARDS
      ============================== */}
      {sortedHistory.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Total */}
          <div
            className="
              bg-white
              rounded-2xl
              border border-emerald-100
              shadow-sm
              p-5
              hover:shadow-md
              transition-shadow
            "
          >
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Retakes
                </p>

                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {sortedHistory.length}
                </p>
              </div>

              <div
                className="
                  w-11 h-11
                  rounded-xl
                  bg-emerald-50
                  text-emerald-600
                  flex items-center justify-center
                "
              >
                <History className="w-5 h-5" />
              </div>

            </div>
          </div>

          {/* Active */}
          <div
            className="
              bg-white
              rounded-2xl
              border border-emerald-100
              shadow-sm
              p-5
              hover:shadow-md
              transition-shadow
            "
          >
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Active
                </p>

                <p className="text-2xl font-bold text-emerald-600 mt-2">
                  {activeCount}
                </p>
              </div>

              <div
                className="
                  w-11 h-11
                  rounded-xl
                  bg-green-50
                  text-green-600
                  flex items-center justify-center
                "
              >
                <Award className="w-5 h-5" />
              </div>

            </div>
          </div>

          {/* Completed */}
          <div
            className="
              bg-white
              rounded-2xl
              border border-emerald-100
              shadow-sm
              p-5
              hover:shadow-md
              transition-shadow
            "
          >
            <div className="flex items-center justify-between">

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Completed
                </p>

                <p className="text-2xl font-bold text-teal-600 mt-2">
                  {completedCount}
                </p>
              </div>

              <div
                className="
                  w-11 h-11
                  rounded-xl
                  bg-teal-50
                  text-teal-600
                  flex items-center justify-center
                "
              >
                <GraduationCap className="w-5 h-5" />
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ==============================
          HISTORY TABLE CARD
      ============================== */}
      <div
        className="
          bg-white
          rounded-2xl
          border border-emerald-100
          shadow-sm
          overflow-hidden
        "
      >

        {/* Table Header */}
        <div
          className="
            px-6 py-5
            border-b border-emerald-100
            bg-emerald-50/60
          "
        >
          <div className="flex items-center gap-3">

            <div
              className="
                w-10 h-10
                rounded-xl
                bg-emerald-100
                text-emerald-700
                flex items-center justify-center
              "
            >
              <BookOpen className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Retake Records
              </h3>

              <p className="text-xs text-gray-500 mt-0.5">
                Detailed academic retake information
              </p>
            </div>

          </div>
        </div>

        {/* ==============================
            EMPTY STATE
        ============================== */}
        {sortedHistory.length === 0 ? (
          <div className="px-6 py-14 text-center">

            <div
              className="
                w-16 h-16
                rounded-2xl
                bg-emerald-50
                text-emerald-500
                flex items-center justify-center
                mx-auto mb-4
              "
            >
              <History className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-gray-700">
              No Retake History
            </h3>

            <p className="text-sm text-gray-500 mt-2">
              No retake records have been found for this student.
            </p>

          </div>
        ) : (
          /* ==============================
             TABLE
          ============================== */
          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead>
                <tr
                  className="
                    bg-gray-50
                    border-b border-gray-100
                    text-left
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-gray-500
                  "
                >
                  <th className="px-6 py-4 whitespace-nowrap">
                    Course
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap">
                    Failed Batch
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap">
                    Current Batch
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap text-center">
                    Attempt
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap">
                    Status
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap">
                    Teacher
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap text-center">
                    GA Score
                  </th>

                  <th className="px-6 py-4 whitespace-nowrap text-center">
                    State
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">

                {sortedHistory.map((retake, index) => (

                  <tr
                    key={retake.id}
                    className={`
                      group
                      transition-colors
                      ${
                        retake.is_active
                          ? "hover:bg-emerald-50/40"
                          : "bg-gray-50/70 opacity-75"
                      }
                    `}
                  >

                    {/* COURSE */}
                    <td className="px-6 py-5">

                      <div className="flex items-center gap-3 min-w-[180px]">

                        <div
                          className={`
                            w-9 h-9
                            rounded-lg
                            flex items-center justify-center
                            ${
                              retake.is_active
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-gray-100 text-gray-400"
                            }
                          `}
                        >
                          <BookOpen className="w-4 h-4" />
                        </div>

                        <div>
                          <p
                            className={`
                              font-semibold
                              ${
                                retake.is_active
                                  ? "text-gray-800"
                                  : "text-gray-500"
                              }
                            `}
                          >
                            {retake.failed_course?.name || "Unknown Course"}
                          </p>

                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Retake #{index + 1}
                          </p>
                        </div>

                      </div>

                    </td>

                    {/* FAILED BATCH */}
                    <td className="px-6 py-5">

                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {retake.failed_batch?.name || "N/A"}
                      </span>

                    </td>

                    {/* CURRENT BATCH */}
                    <td className="px-6 py-5">

                      <span className="text-sm text-gray-600 whitespace-nowrap">
                        {retake.current_batch?.name || "N/A"}
                      </span>

                    </td>

                    {/* ATTEMPT */}
                    <td className="px-6 py-5 text-center">

                      <span
                        className="
                          inline-flex
                          min-w-[34px]
                          justify-center
                          rounded-full
                          bg-emerald-50
                          border border-emerald-100
                          px-3 py-1.5
                          text-xs
                          font-bold
                          text-emerald-700
                        "
                      >
                        {retake.attempt_number}
                      </span>

                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-5">

                      <RetakeStatusBadge
                        status={retake.status}
                      />

                    </td>

                    {/* TEACHER */}
                    <td className="px-6 py-5">

                      <div className="flex items-center gap-2 min-w-[130px]">

                        <div
                          className="
                            w-8 h-8
                            rounded-full
                            bg-teal-50
                            text-teal-600
                            flex items-center justify-center
                          "
                        >
                          <UserCheck className="w-4 h-4" />
                        </div>

                        <span className="text-sm text-gray-600">
                          {retake.retake_teacher?.name ||
                            "Unassigned"}
                        </span>

                      </div>

                    </td>

                    {/* GA SCORE */}
                    <td className="px-6 py-5 text-center">

                      <span className="font-bold text-gray-700">
                        {retake.ga_score?.score ?? "N/A"}
                      </span>

                    </td>

                    {/* STATE */}
                    <td className="px-6 py-5 text-center">

                      {retake.is_active ? (
                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-full
                            bg-emerald-100
                            border border-emerald-200
                            px-3 py-1.5
                            text-[11px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-emerald-800
                          "
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span
                          className="
                            inline-flex
                            items-center
                            gap-1.5
                            rounded-full
                            bg-gray-100
                            border border-gray-200
                            px-3 py-1.5
                            text-[11px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-gray-600
                          "
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Superseded
                        </span>
                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>
          </div>
        )}

        {/* ==============================
            TABLE FOOTER
        ============================== */}
        {sortedHistory.length > 0 && (
          <div
            className="
              px-6 py-4
              border-t border-emerald-100
              bg-emerald-50/30
              flex flex-col sm:flex-row
              sm:items-center
              sm:justify-between
              gap-2
            "
          >
            <p className="text-xs text-gray-500">
              Showing{" "}
              <span className="font-semibold text-emerald-700">
                {sortedHistory.length}
              </span>{" "}
              retake{" "}
              {sortedHistory.length === 1
                ? "record"
                : "records"}
            </p>

            <p className="text-xs text-gray-400">
              Active records are highlighted for reference.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default StudentRetakeHistory;