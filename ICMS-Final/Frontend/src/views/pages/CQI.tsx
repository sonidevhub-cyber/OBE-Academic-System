import React, { useEffect, useState } from "react";
import { api } from "../../api/api";

interface Props {
  weakClos: any[];   // 🔥 FROM BACKEND (IMPORTANT)
  courseId: string;
  batchId: string;
  semesterId: string;
  onComplete?: () => void;
}

const CQI: React.FC<Props> = ({
  weakClos,
  courseId,
  batchId,
  semesterId,
  onComplete
}) => {

  const [form, setForm] = useState<any>({});
  const [savedData, setSavedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ================= FETCH ONLY CQI (NO CLO REPORT) =================
  useEffect(() => {

    const fetchCQI = async () => {
      try {
        const res = await api.get(
          `/assessments/cqi/?course=${courseId}&batch=${batchId}&semester=${semesterId}`
        );

        setSavedData(res.data || []);

        // 🔥 PREFILL
        const prefilled: any = {};
        res.data.forEach((item: any) => {
          prefilled[String(item.clo)] = {
            reason: item.reason,
            action_plan: item.action_plan
          };
        });

        setForm(prefilled);

      } catch (err: any) {
        setError("❌ Failed to load CQI data");
      }
    };

    fetchCQI();

  }, [courseId, batchId, semesterId]);

  // ================= INPUT =================
  const handleChange = (clo: string, field: string, value: string) => {
    setForm((prev: any) => ({
      ...prev,
      [clo]: {
        ...prev[clo],
        [field]: value
      }
    }));
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {

    setError("");
    setSuccess("");

    const allFilled = weakClos.every(
      (c: any) => form[c.clo]?.reason && form[c.clo]?.action_plan
    );

    if (!allFilled) {
      setError("⚠️ Fill all fields!");
      return;
    }

    try {
      setLoading(true);

      await Promise.all(
        weakClos.map((c: any) => {

          const existing = savedData.find(
            (item: any) => String(item.clo) === String(c.clo)
          );

          // 🔥 RESUBMIT
          if (existing && existing.status === "rejected") {
            return api.patch(
              `/assessments/cqi/resubmit/${existing.id}/`,
              {
                reason: form[c.clo].reason,
                action_plan: form[c.clo].action_plan
              }
            );
          }

          // 🔥 NEW
          if (!existing) {
            return api.post("/assessments/cqi/", {
              course: courseId,
              batch: batchId,
              semester: semesterId,
              clo: c.clo,
              reason: form[c.clo].reason,
              action_plan: form[c.clo].action_plan
            });
          }

          return Promise.resolve();
        })
      );

      setSuccess("✅ CQI Submitted!");

      setTimeout(() => {
        if (onComplete) onComplete();
      }, 1500);

    } catch (err: any) {
      setError("❌ Submission failed");
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">

      <div className="bg-white p-6 rounded-xl w-[600px] max-h-[80vh] overflow-y-auto">

        <h2 className="text-xl font-bold mb-4">
          CQI (Continuous Improvement)
        </h2>

        {error && <p className="text-red-600">{error}</p>}
        {success && <p className="text-green-600">{success}</p>}

        {weakClos.length === 0 ? (
          <p className="text-green-600">All CLOs Achieved 🎉</p>
        ) : (
          <>
            {weakClos.map((item: any, i: number) => (

              <div key={i} className="bg-gray-100 p-4 rounded mb-3">

                <h3 className="text-red-600 font-bold mb-2">
                  {item.clo} — {item.attainment}% (KPI: {item.kpi})
                </h3>

                <textarea
                  className="w-full border p-2 mb-2"
                  placeholder="Reason"
                  value={form[item.clo]?.reason || ""}
                  onChange={(e) =>
                    handleChange(item.clo, "reason", e.target.value)
                  }
                />

                <textarea
                  className="w-full border p-2"
                  placeholder="Action Plan"
                  value={form[item.clo]?.action_plan || ""}
                  onChange={(e) =>
                    handleChange(item.clo, "action_plan", e.target.value)
                  }
                />

              </div>
            ))}

            <button
              onClick={handleSubmit}
              className="bg-blue-600 text-white w-full py-2 rounded mt-3"
              disabled={loading}
            >
              {loading ? "Saving..." : "Submit CQI"}
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default CQI;