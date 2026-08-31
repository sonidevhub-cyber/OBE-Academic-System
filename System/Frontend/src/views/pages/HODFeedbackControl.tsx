import React, { useEffect, useState } from "react";
import { feedbackService } from "../../api/FeedbackServices";
import { api } from "../../api/api";

const HODFeedbackControl = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");

  // 🔹 Fetch batches
  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await api.get("/feedback/hod/batches/");

      const data = Array.isArray(res.data)
        ? res.data
        : res.data.results || [];

      console.log("Batches API Response:", data);

      setBatches(data);

      if (data.length > 0) {
        setSelectedBatch(String(data[0].id)); // ✅ FIX (string force)
      }

    } catch (err) {
      console.error("Batch fetch error", err);
    }
  };

  // 🔹 Check status when batch changes
  useEffect(() => {
    if (selectedBatch) {
      checkStatus();
    }
  }, [selectedBatch]);

 const checkStatus = async () => {
  try {
    console.log("Checking status for batch:", selectedBatch);

    const res = await feedbackService.status(selectedBatch);

    console.log("RAW STATUS RESPONSE:", res);
    console.log("STATUS TYPE:", typeof res);
    console.log("STATUS JSON:", JSON.stringify(res));

    if (res && typeof res === "object") {
      setIsEnabled(Boolean(res.enabled));
    } else {
      console.error("Invalid status response:", res);
      setIsEnabled(false);
    }

  } catch (err) {
    console.error("Status error:", err);
    setIsEnabled(false);
  }
};

  // 🔹 Toggle feedback
  const toggleFeedback = async () => {
    if (!selectedBatch) {
      alert("Select batch first");
      return;
    }

    console.log("Sending batch to backend:", selectedBatch);

    setLoading(true);

    try {
      if (isEnabled) {
        await feedbackService.disable(selectedBatch);
      } else {
        await feedbackService.enable(selectedBatch);
      }

      // refresh status after toggle
      await checkStatus();

    } catch (err) {
      console.error("Toggle error", err);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white shadow-xl rounded-2xl p-6">

      <h2 className="text-2xl font-bold mb-4 text-indigo-600">
        🎛 Feedback Control Panel
      </h2>

      {/* 🔽 Batch Dropdown */}
      <div className="mb-4">
        <label className="block text-sm mb-1 font-medium">
          Select Batch
        </label>

        <select
          value={selectedBatch}
          onChange={(e) => setSelectedBatch(String(e.target.value))} // ✅ FIX
          className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Select Batch --</option>

          {Array.isArray(batches) &&
            batches.map((b: any) => (
              <option key={b.id} value={String(b.id)}> {/* ✅ FIX */}
                {b.name || b.code || `Batch ${b.id}`}
              </option>
            ))}
        </select>
      </div>

      {/* STATUS */}
      <div className="mb-4 text-center">
        <p className="text-lg font-semibold">Status:</p>

        <div
          className={`mt-2 px-4 py-2 rounded-full inline-block text-white font-bold ${
            isEnabled ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {isEnabled ? "OPEN 🟢" : "CLOSED 🔴"}
        </div>
      </div>

      {/* BUTTON */}
      <button
        onClick={toggleFeedback}
        disabled={loading}
        className={`w-full py-3 rounded-lg text-white font-semibold transition ${
          isEnabled
            ? "bg-red-600 hover:bg-red-700"
            : "bg-green-600 hover:bg-green-700"
        } ${loading && "opacity-60 cursor-not-allowed"}`}
      >
        {loading
          ? "Processing..."
          : isEnabled
          ? "Disable Feedback"
          : "Enable Feedback"}
      </button>

      {/* INFO */}
      <p className="text-sm text-gray-500 mt-4 text-center">
        Feedback will be enabled only for selected batch students.
      </p>
    </div>
  );
};

export default HODFeedbackControl;