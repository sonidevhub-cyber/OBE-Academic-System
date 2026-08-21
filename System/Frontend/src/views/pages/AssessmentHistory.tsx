import React, { useEffect, useState, useCallback } from "react";
import axiosInstance from "../../api/axiosInstance";
import { toast } from "react-hot-toast";

interface Props {
  courseId: string;
  batchId: string;
  semesterNumber: number | string;
  onEditAssessment?: (assessment: AssessmentItem) => void;
  forceLocked?: boolean; // Testing ya override ke liye optional prop
}

export interface AssessmentItem {
  id: string;
  title: string;
  type: string;
  date: string;
  total_marks: number;
  is_finalized: boolean;
  is_locked: boolean;
}

const AssessmentHistory: React.FC<Props> = ({
  courseId,
  batchId,
  semesterNumber,
  onEditAssessment,
  forceLocked = false,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  // Fetch History List
  const fetchHistory = useCallback(async () => {
    if (!courseId || !batchId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get("/assessments/history/", {
        params: {
          course: courseId,
          batch: batchId,
          semester: semesterNumber,
        },
      });

      // Backend data ko map kar ke agar forceLocked true ho to sab ko locked kar dein
      const data = (response.data || []).map((item: any) => ({
        ...item,
        is_locked: forceLocked ? true : item.is_locked,
      }));

      setAssessments(data);
    } catch (err) {
      console.error("Error fetching assessment history:", err);
      setError("Failed to load history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [courseId, batchId, semesterNumber, forceLocked]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleView = (assessment: AssessmentItem) => {
    if (onEditAssessment) {
      onEditAssessment(assessment);
    }
  };

  // Request Unlock Handler for HOD approval
  const requestEditing = async (assessmentId: string) => {
    try {
      setRequestingId(assessmentId);
      const res = await axiosInstance.post(`/assessments/request-editing/${assessmentId}/`);
      toast.success(res.data.message || "Edit request sent to HOD successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send edit request");
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12 text-slate-600 font-medium">
        Loading Assessment History...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">
          Assessment History
        </h2>
        <button
          onClick={fetchHistory}
          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-sm">
              <th className="border border-slate-200 p-2.5 text-center w-12">#</th>
              <th className="border border-slate-200 p-2.5 text-left">Title</th>
              <th className="border border-slate-200 p-2.5 text-center">Type</th>
              <th className="border border-slate-200 p-2.5 text-center">Total Marks</th>
              <th className="border border-slate-200 p-2.5 text-center">Date</th>
              <th className="border border-slate-200 p-2.5 text-center">Status</th>
              <th className="border border-slate-200 p-2.5 text-center w-40">Action</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-4 text-slate-500">
                  No assessment history found.
                </td>
              </tr>
            ) : (
              assessments.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-slate-50 text-sm">
                  <td className="border border-slate-200 p-2 text-center text-slate-600">
                    {index + 1}
                  </td>
                  <td className="border border-slate-200 p-2 font-medium text-slate-800">
                    {item.title}
                  </td>
                  <td className="border border-slate-200 p-2 text-center text-slate-600 capitalize">
                    {item.type}
                  </td>
                  <td className="border border-slate-200 p-2 text-center font-semibold text-slate-700">
                    {item.total_marks}
                  </td>
                  <td className="border border-slate-200 p-2 text-center text-slate-600">
                    {item.date}
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        item.is_locked
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.is_locked ? "Locked" : "Active"}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    {item.is_locked ? (
                      <button
                        onClick={() => requestEditing(item.id)}
                        disabled={requestingId === item.id}
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded transition-colors font-semibold shadow-sm disabled:opacity-50"
                      >
                        {requestingId === item.id ? "Sending..." : "Request Unlock"}
                      </button>
                    ) : (
                      <button
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors font-semibold"
                        onClick={() => handleView(item)}
                      >
                        Edit Marks
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssessmentHistory;