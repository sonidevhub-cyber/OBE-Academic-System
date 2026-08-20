import React, { useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import { toast } from "react-hot-toast";

const EnableResultEditing = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    loadBatches();
    loadPendingRequests();
  }, []);

  const loadBatches = async () => {
    try {
      const res = await axiosInstance.get("/batches/all/");
      setBatches(res.data);
    } catch (err) {
      toast.error("Failed to load batches");
    }
  };

  const loadPendingRequests = async () => {
    try {
      const res = await axiosInstance.get("/assessments/pending-requests/");
      setPendingRequests(res.data || []);
    } catch (err) {
      console.error("Failed to load pending requests");
    }
  };

  const loadSessions = async (batchId: string) => {
    try {
      const res = await axiosInstance.get(`/obe/batches/${batchId}/sessions/`);
      setSessions(
        Array.isArray(res.data.sessions)
          ? res.data.sessions
          : []
      );
    } catch (err) {
      toast.error("Failed to load sessions");
    }
  };

  const enableEditing = async (sessionIdToUnlock?: string) => {
    const targetSession = sessionIdToUnlock || selectedSession;
    if (!targetSession) {
      toast.error("Select a course session first");
      return;
    }

    try {
      const res = await axiosInstance.post(
        `/obe/course-sessions/${targetSession}/enable-editing/`
      );

      toast.success(res.data.message || "Session unlocked successfully!");
      
      if (String(targetSession) === String(selectedSession)) {
        setSessionStatus((prev: any) => ({ ...prev, is_editable: true, editable: true }));
      }
      
      loadPendingRequests();
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Unable to enable editing"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Pending Requests Section for HOD */}
      <div className="bg-white rounded-xl shadow p-6 border border-amber-200">
        <h3 className="text-xl font-bold mb-4 text-amber-900">
          📥 Instructor Unlock Requests
        </h3>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending edit requests from instructors.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-100">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {req.course_name} <span className="text-xs text-slate-500 font-normal">({req.batch_name})</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Instructor: <span className="font-medium">{req.instructor_name}</span>
                  </p>
                </div>
                <button
                  onClick={() => enableEditing(req.course_session_id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                >
                  Approve & Unlock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Selection Panel */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-bold mb-6">
          Enable Result Editing Manually
        </h2>

        <div className="space-y-5">
          <div>
            <label className="font-semibold">
              Select Batch
            </label>
            <select
              className="w-full border rounded-lg p-2 mt-2"
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setSelectedSession("");
                setSessionStatus(null);
                loadSessions(e.target.value);
              }}
            >
              <option value="">Choose Batch</option>
              {batches.map((batch: any) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold">
              Select Course Session
            </label>
            <select
              className="w-full border rounded-lg p-2 mt-2"
              value={selectedSession}
              onChange={(e) => {
                const sId = e.target.value;
                setSelectedSession(sId);
                const found = sessions.find((s: any) => String(s.id) === String(sId));
                setSessionStatus(found || null);
              }}
            >
              <option value="">Choose Session</option>
              {Array.isArray(sessions) &&
                sessions.map((session: any) => (
                  <option key={session.id} value={session.id}>
                    {session.course_name} ({session.instructor_name})
                  </option>
                ))}
            </select>
          </div>

          {selectedSession && sessionStatus && (
            <div className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-between ${
              sessionStatus.is_editable || sessionStatus.editable 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <span>Status:</span>
              <span className="font-bold">
                {sessionStatus.is_editable || sessionStatus.editable ? "🟢 Unlocked (Editable)" : "🔒 Locked"}
              </span>
            </div>
          )}

          <button
            onClick={() => enableEditing()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-semibold"
          >
            Enable Editing
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnableResultEditing;