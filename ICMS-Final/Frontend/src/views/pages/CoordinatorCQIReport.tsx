import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import OBEReport from "views/pages/OBEReport";

interface Props {
  courseId?: string;
  batchId?: string;
  semesterId?: string;
}

const CoordinatorCQIReport: React.FC<Props> = ({
  courseId,
  batchId,
  semesterId
}) => {

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    // 🔒 Guard
    if (!courseId || !batchId || !semesterId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {

        // ✅ ONLY Coordinator API (NO check-status)
        const res = await api.get("assessments/cqi/coordinator/", {
          params: {
            course: courseId,
            batch: batchId,
            semester: semesterId
          }
        });

        console.log("CQI:", res.data);

        // ✅ Safe handling
        setData(Array.isArray(res.data) ? res.data : []);

      } catch (err) {
        console.error("CQI Fetch Error:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [courseId, batchId, semesterId]);

  // 🔄 Loading
  if (loading) {
    return <p className="p-6 text-gray-500">Loading CQI & Report...</p>;
  }

  // ❌ No CQI data
  if (!data.length) {
    return (
      <div className="p-6 text-center text-gray-500">
        No Approved CQI Found
      </div>
    );
  }

  return (
    <>
      {/* ✅ CQI TABLE */}
      <div className="p-6 bg-white rounded-xl shadow mb-6">
        <h2 className="text-xl font-bold mb-4 text-green-700">
          Approved CQI Reports
        </h2>

        <table className="w-full border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">CLO</th>
              <th className="p-2 border">Reason</th>
              <th className="p-2 border">Action Plan</th>
              <th className="p-2 border">Instructor</th>
              <th className="p-2 border">Approved By</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="text-center">
                <td className="p-2 border">{item.clo}</td>
                <td className="p-2 border">{item.reason}</td>
                <td className="p-2 border">{item.action_plan}</td>
                <td className="p-2 border">{item.instructor}</td>
                <td className="p-2 border">{item.approved_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔥 OBE REPORT */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4 text-blue-700">
          OBE / CLO Report
        </h2>

        <OBEReport
          courseId={courseId!}
          batchId={batchId!}
          semesterId={semesterId!}
        />
      </div>
    </>
  );
};

export default CoordinatorCQIReport;