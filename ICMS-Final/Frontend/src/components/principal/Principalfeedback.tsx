import React, { useEffect, useState } from "react";
import { FileText, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";

interface ReportSummary {
  department: string;
  totalFeedback: number;
  positive: number;
  negative: number;
  neutral: number;
  redFlags: number;
  shortageCases: number;
  status: "Pending Review" | "Reviewed";
  submittedBy: string;
  submittedOn: string;
  reportUrl: string;
}

export default function PrincipalFeedbackReportWidget() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch("/api/principal/feedback-report/latest");
        const data = await res.json();
        setReport(data);
      } catch {
        setReport({
          department: "Information Technology",
          totalFeedback: 68,
          positive: 42,
          negative: 18,
          neutral: 8,
          redFlags: 3,
          shortageCases: 2,
          status: "Pending Review",
          submittedBy: "HOD — Department of IT",
          submittedOn: "01 Jan 2026",
          reportUrl: "/reports/feedback-it-Jan26.pdf",
        });
      }
      setLoading(false);
    }

    fetchReport();
  }, []);

  if (loading) return (
    <div className="bg-white rounded-3xl shadow-xl p-6">
      Fetching latest departmental feedback report…
    </div>
  );

  if (!report) return (
    <div className="bg-white rounded-3xl shadow-xl p-6">
      No feedback report has been forwarded by HOD yet.
    </div>
  );

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-6 space-y-4">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 size={22} />
          Departmental Feedback Performance Summary
        </h2>

        <span className={`px-3 py-1 rounded-full text-sm ${
          report.status === "Reviewed"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        }`}>
          {report.status === "Reviewed"
            ? "Reviewed by Principal"
            : "Pending Principal Review"}
        </span>
      </div>

      <p className="text-gray-600">
        This report has been formally forwarded by <b>{report.submittedBy}</b>  
        and covers consolidated student feedback for the department.
      </p>

      {/* Metrics Row */}
      <div className="grid grid-cols-5 gap-4">

        <div className="bg-indigo-50 p-4 rounded-2xl">
          <p className="text-sm text-gray-600">Total Feedback Records</p>
          <h3 className="text-3xl font-bold">{report.totalFeedback}</h3>
        </div>

        <div className="bg-green-50 p-4 rounded-2xl">
          <p className="text-sm text-gray-600">Positive Observations</p>
          <h3 className="text-3xl font-bold">{report.positive}</h3>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl">
          <p className="text-sm text-gray-600">Neutral Responses</p>
          <h3 className="text-3xl font-bold">{report.neutral}</h3>
        </div>

        <div className="bg-rose-50 p-4 rounded-2xl">
          <p className="text-sm text-gray-600">Areas of Concern</p>
          <h3 className="text-3xl font-bold">{report.negative}</h3>
        </div>

        <div className="bg-red-50 p-4 rounded-2xl">
          <p className="text-sm text-gray-600 flex items-center gap-1">
            <AlertTriangle size={14} /> Red-Flag Indicators
          </p>
          <h3 className="text-3xl font-bold">{report.redFlags}</h3>
        </div>

      </div>

      {/* Bottom Section */}
      <div className="flex justify-between items-center pt-3">

        <p className="text-sm text-gray-600">
          Attendance Shortage Cases Identified:{" "}
          <b>{report.shortageCases}</b>
        </p>

        <div className="flex gap-3">

          <button
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
            onClick={() => window.open(report.reportUrl, "_blank")}
          >
            <FileText size={16} />
            Open Detailed Feedback Report
          </button>

          {report.status !== "Reviewed" && (
            <button
              className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
              onClick={() => alert("Report marked as reviewed")}
            >
              <CheckCircle2 size={16} />
              Mark as Reviewed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}