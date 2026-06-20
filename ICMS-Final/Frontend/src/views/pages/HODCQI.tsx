import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import { toast } from "react-toastify";

const HODCQI: React.FC = () => {

  const [data, setData] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔥 HOD COMMENT STATE
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assessments/hod-cqi/");
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load CQI data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= ACTION =================
  const handleAction = async (id: string, status: string) => {

    try {
      setLoadingId(id);

      await api.patch(`/assessments/hod-cqi/update/${id}/`, {
        status,
        hod_comment: comments[id] || ""
      });

      toast.success(`CQI ${status}`);

      fetchData();

    } catch (err: any) {
      console.error(err?.response?.data);
      toast.error("Action failed");
    } finally {
      setLoadingId(null);
    }
  };

  // ================= UI =================
  return (
    <div className="p-6">

      <h2 className="text-2xl font-bold mb-6">
        HOD CQI Review
      </h2>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500">No CQI Data Found</p>
      ) : (
        data.map((item) => (

          <div
            key={item.id}
            className="bg-white p-5 rounded-xl shadow mb-4 border"
          >

            {/* HEADER */}
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-red-600 text-lg">
                {item.clo_display}
              </h3>

              <span className={`px-3 py-1 rounded text-white text-sm ${
                item.status === "approved"
                  ? "bg-green-600"
                  : item.status === "rejected"
                  ? "bg-red-600"
                  : "bg-yellow-500"
              }`}>
                {item.status || "pending"}
              </span>
            </div>

            {/* INFO */}
            <p><b>Instructor:</b> {item.instructor_name}</p>
            <p><b>Reason:</b> {item.reason}</p>
            <p><b>Action Plan:</b> {item.action_plan}</p>

            {/* EXISTING COMMENT */}
            {item.hod_comment && (
              <p className="text-blue-600 mt-1">
                <b>HOD Comment:</b> {item.hod_comment}
              </p>
            )}

            {/* INPUT COMMENT */}
            {item.status === "pending" && (
              <textarea
                placeholder="Write comment (optional)"
                className="w-full border p-2 mt-3 rounded"
                value={comments[item.id] || ""}
                onChange={(e) =>
                  setComments({
                    ...comments,
                    [item.id]: e.target.value
                  })
                }
              />
            )}

            {/* DATE */}
            <p className="text-sm text-gray-500 mt-2">
              {new Date(item.created_at).toLocaleString()}
            </p>

            {/* ACTION BUTTONS */}
            {item.status === "pending" && (
              <div className="mt-4 flex gap-2">

                <button
                  onClick={() => handleAction(item.id, "approved")}
                  disabled={loadingId === item.id}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
                >
                  {loadingId === item.id ? "..." : "Approve"}
                </button>

                <button
                  onClick={() => handleAction(item.id, "rejected")}
                  disabled={loadingId === item.id}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded"
                >
                  {loadingId === item.id ? "..." : "Reject"}
                </button>

              </div>
            )}

          </div>

        ))
      )}

    </div>
  );
};

export default HODCQI;