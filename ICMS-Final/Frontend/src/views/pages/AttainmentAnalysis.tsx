import React, { useEffect, useState } from "react";
import { api } from "../../api/api";

const AttainmentAnalysis = ({ courseId }: { courseId: number }) => {

  const [cloData, setCLOData] = useState<any[]>([]);
  const [gaData, setGAData] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/obe/reports/marksheet/?course=${courseId}`)
      .then(res => {
        console.log("Full response:", res.data);

        setCLOData(res.data.course_clo_attainment || []);
        setGAData(res.data.course_ga_attainment || []);
      })
      .catch(err => console.error(err));
  }, [courseId]);

  const getLevel = (val: number) => {
    if (val >= 80) return "High";
    if (val >= 60) return "Medium";
    return "Low";
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">

      <h2 className="text-xl font-bold mb-4">
        Attainment Analysis
      </h2>

      {/* 🔥 CLO TABLE */}
      <h3 className="font-semibold mb-2">CLO Attainment</h3>

      <table className="w-full text-center border mb-6">
        <thead className="bg-gray-200">
          <tr>
            <th>CLO</th>
            <th>Average %</th>
            <th>Status</th>
            <th>Level</th>
          </tr>
        </thead>

        <tbody>
          {cloData.map((c, i) => (
            <tr key={i}>
              <td>{c.clo_number}</td>
              <td>{c.average}%</td>

              <td className={c.pass ? "text-green-600" : "text-red-600"}>
                {c.pass ? "Achieved" : "Not Achieved"}
              </td>

              <td className={
                c.average >= 80 ? "text-green-600" :
                c.average >= 60 ? "text-yellow-600" :
                "text-red-600"
              }>
                {getLevel(c.average)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔥 GA TABLE */}
      <h3 className="font-semibold mb-2">GA Attainment</h3>

      <table className="w-full text-center border">
        <thead className="bg-gray-200">
          <tr>
            <th>GA</th>
            <th>Average %</th>
            <th>Status</th>
            <th>Level</th>
          </tr>
        </thead>

        <tbody>
          {gaData.map((g, i) => (
            <tr key={i}>
              <td>{g.ga_code}</td>
              <td>{g.average}%</td>

              <td className={g.pass ? "text-green-600" : "text-red-600"}>
                {g.pass ? "Achieved" : "Not Achieved"}
              </td>

              <td className={
                g.average >= 80 ? "text-green-600" :
                g.average >= 60 ? "text-yellow-600" :
                "text-red-600"
              }>
                {getLevel(g.average)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
};

export default AttainmentAnalysis;