import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

const API = "http://localhost:8000/api/obe";

const EnableResultEditing = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedSession, setSelectedSession] = useState("");

  const auth = JSON.parse(localStorage.getItem("auth") || "{}");
  const token = auth.access_token || auth.token;

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const res = await axios.get(
        "http://localhost:8000/api/batches/all/",
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      setBatches(res.data);
    } catch (err) {
      toast.error("Failed to load batches");
    }
  };

  const loadSessions = async (batchId: string) => {
  try {
    const res = await axios.get(
      `${API}/batches/${batchId}/sessions/`,
      {
        headers: {
          Authorization: `Token ${token}`,
        },
      }
    );

    console.log("Sessions Response:", res.data);

    console.log("Sessions Response:", res.data);
console.log("Sessions Array:", res.data.sessions);

setSessions(
  Array.isArray(res.data.sessions)
    ? res.data.sessions
    : []
);
  } catch (err) {
    toast.error("Failed to load sessions");
  }
};
  const enableEditing = async () => {
    if (!selectedSession) {
      toast.error("Select a course first");
      return;
    }

    try {
      const res = await axios.post(
        `${API}/course-sessions/${selectedSession}/enable-editing/`,
        {},
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || "Unable to enable editing"
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-2xl font-bold mb-6">
        Enable Result Editing
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
            onChange={(e) => setSelectedSession(e.target.value)}
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

        <button
          onClick={enableEditing}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          Enable Editing
        </button>

      </div>
    </div>
  );
};

export default EnableResultEditing;