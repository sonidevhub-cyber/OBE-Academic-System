import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

interface Props {
  courseId: string;
  batchId: string;
  semesterId: string;
}

const AttainmentAnalysis: React.FC<Props> = ({
  courseId,
  batchId,
  semesterId
}) => {

  const [data, setData] = useState<any[]>([]);
  const [weakClos, setWeakClos] = useState<string[]>([]);

  useEffect(() => {
    api.get(`assessments/clo-report/${courseId}/${batchId}/${semesterId}/`)
      .then((res: any) => {

        const response = res.data;

        if (response.error) return;

        const cloData = response.class_clo_attainment;

        const formatted: any[] = [];
        const weak: string[] = [];

        Object.entries(cloData).forEach(([clo, val]: any) => {

          const kpi = val.kpi ?? 60;   // ✅ FIXED (backend se lo)

          formatted.push({
            clo,
            attainment: val.percentage,
            kpi,
            level: val.level,          // ✅ FIXED (backend use)
            status: val.status
          });

          if (val.percentage < kpi) {
            weak.push(clo);
          }

        });

        setData(formatted);
        setWeakClos(weak);

      });
  }, [courseId, batchId, semesterId]);

  return (
    <div className="p-6">

      <h2 className="text-xl font-bold mb-4">
        Attainment Analysis
      </h2>

      {/* ✅ TABLE */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <table className="w-full text-sm text-center">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th>CLO</th>
              <th>Attainment %</th>
              <th>KPI</th>
              <th>Level</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td>{row.clo}</td>

                <td className="font-bold">
                  {row.attainment}%
                </td>

                <td>{row.kpi}%</td>

                <td>L{row.level}</td> {/* ✅ FIXED */}

                <td
                  className={
                    row.status === "Achieved"
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {row.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ GRAPH */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">

        <h3 className="font-semibold mb-3">
          CLO Attainment Graph
        </h3>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="clo" />
            <YAxis />

            <Tooltip />
            <Legend />

            <Bar dataKey="attainment" fill="#4CAF50" />

            {/* KPI LINE */}
            <ReferenceLine
              y={60}
              label="KPI"
              stroke="red"
              strokeDasharray="3 3"
            />
          </BarChart>
        </ResponsiveContainer>

      </div>

      {/* ✅ WEAK CLOs */}
      <div className="bg-white p-4 rounded-xl shadow">

        <h3 className="font-semibold mb-2 text-red-600">
          Weak CLOs (Need Improvement)
        </h3>

        {weakClos.length === 0 ? (
          <p className="text-green-600">
            All CLOs Achieved 🎉
          </p>
        ) : (
          <ul className="list-disc pl-5">
            {weakClos.map((clo, i) => {

              const cloData = data.find(d => d.clo === clo);

              return (
                <li key={i}>
                  {clo} — {cloData?.attainment}%  {/* ✅ FIXED */}
                </li>
              );
            })}
          </ul>
        )}

      </div>

    </div>
  );
};

export default AttainmentAnalysis;