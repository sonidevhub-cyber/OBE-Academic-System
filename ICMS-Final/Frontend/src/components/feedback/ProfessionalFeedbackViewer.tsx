// src/pages/HODFeedbackDashboard.tsx
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  MessageSquare,
  Filter,
  Sun,
  Moon,
  DownloadCloud,
  RefreshCw,
} from "lucide-react";
import FeedbackCard from "../../components/FeedbackCard";
import HODFeedbackAnalytics from "../../components/HODFeedbackAnalytics";
import { feedbackService } from "../../api/FeedbackServices";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const HODFeedbackDashboard: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [allowLoading, setAllowLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [darkMode, setDarkMode] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchAll();
    fetchStatus();
    // eslint-disable-next-line
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await feedbackService.list();
      const arr = res.feedbacks || res.data?.feedbacks || res.data || res;
      setFeedbacks(Array.isArray(arr) ? arr : []);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await feedbackService.status();
      setIsAllowed(res.is_allowed ?? res.allowed ?? false);
    } catch (err) {
      console.error("Status error", err);
    }
  };

  const toggleAllow = async () => {
    try {
      setAllowLoading(true);
      const res = isAllowed
        ? await feedbackService.disable()
        : await feedbackService.allow();

      setIsAllowed(res.is_allowed ?? !isAllowed);
    } catch (err) {
      console.error("Toggle allow error", err);
    } finally {
      setAllowLoading(false);
    }
  };

  const markAsReviewed = async (id: number) => {
    try {
      await feedbackService.markReviewed(id);
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_reviewed: true } : f))
      );
    } catch (err) {
      console.error("Mark reviewed error", err);
    }
  };

  // FIXED PDF EXPORT
  const exportPDF = async () => {
    if (!containerRef.current) return;

    const el = containerRef.current;

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = canvas; // <— FIX: using canvas directly, no more getImageProperties
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`hod-feedback-report-${Date.now()}.pdf`);
  };

  const filtered = feedbacks.filter((f) => {
    const statusMatch =
      filter === "all" ||
      (filter === "unreviewed" && !f.is_reviewed) ||
      (filter === "reviewed" && f.is_reviewed);

    const typeMatch = typeFilter === "all" || f.feedback_type === typeFilter;

    return statusMatch && typeMatch;
  });

  return (
    <div className={darkMode ? "dark" : ""}>
      <div
        className={`min-h-screen transition-colors duration-300 ${
          darkMode
            ? "bg-gray-900 text-slate-100"
            : "bg-gray-100 text-slate-900"
        }`}
      >
        <div className="max-w-7xl mx-auto p-6" ref={containerRef}>
          {/* HEADER */}
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-start justify-between gap-6 mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-xl">
                <ShieldCheck />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">HOD Feedback Control</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {feedbacks.length} feedback(s) • manage & review
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchAll}
                title="Refresh"
                className="p-2 rounded-lg bg-white/70 dark:bg-white/5 shadow hover:scale-105 transition-transform"
              >
                <RefreshCw />
              </button>

              <button
                onClick={exportPDF}
                title="Download PDF"
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
              >
                <DownloadCloud size={16} /> Export PDF
              </button>

              <button
                onClick={toggleAllow}
                disabled={allowLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  isAllowed
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-green-600 text-white hover:bg-green-700"
                } ${allowLoading ? "opacity-60 cursor-not-allowed" : "shadow-lg"}`}
              >
                {allowLoading
                  ? "Updating..."
                  : isAllowed
                  ? "Disable Feedback"
                  : "Allow Feedback"}
              </button>

              <button
                onClick={() => setDarkMode((d) => !d)}
                className="p-2 rounded-full bg-white/10"
              >
                {darkMode ? <Sun /> : <Moon />}
              </button>
            </div>
          </motion.div>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LIST */}
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
                {/* Filters */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-purple-600" />
                    <h3 className="text-lg font-semibold">Student Feedback</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <Filter />
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-transparent outline-none text-sm"
                      >
                        <option value="all">All</option>
                        <option value="unreviewed">Unreviewed</option>
                        <option value="reviewed">Reviewed</option>
                      </select>
                    </div>

                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="teaching">Teaching Quality</option>
                      <option value="communication">Communication</option>
                      <option value="support">Student Support</option>
                      <option value="management">Department Management</option>
                      <option value="general">General</option>
                    </select>

                    <label className="flex items-center gap-2 text-sm ml-2">
                      <input
                        type="checkbox"
                        checked={compactView}
                        onChange={() => setCompactView((c) => !c)}
                      />
                      Compact
                    </label>
                  </div>
                </div>

                {/* Actual List */}
                <div className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                    </div>
                  ) : filtered.length > 0 ? (
                    filtered.map((f) => (
                      <FeedbackCard
                        key={f.id}
                        f={f}
                        compact={compactView}
                        onMarkReviewed={markAsReviewed}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      No feedback found.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ANALYTICS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
              <h4 className="text-lg font-semibold mb-4">Analytics</h4>
              <HODFeedbackAnalytics feedbacks={feedbacks} />
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Students only see feedback button when HOD allows it.
          </div>
        </div>
      </div>
    </div>
  );
};

export default HODFeedbackDashboard;