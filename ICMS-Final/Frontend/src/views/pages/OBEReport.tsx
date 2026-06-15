import React, { useEffect, useState } from "react";
import { FaFileExcel } from "react-icons/fa";
import { api } from "../../api/api";
import logo from "assets/logo2.png";

const ExcelIcon = FaFileExcel as unknown as React.FC;

interface Props {
  courseId: string;
  batchId: string;
  semesterId: string;
}

const OBEReport: React.FC<Props> = ({ courseId, batchId, semesterId }) => {

  const [data, setData] = useState<any[]>([]);
  const [clos, setClos] = useState<string[]>([]);
  const [report, setReport] = useState<any>(null);
  const [kpiMap, setKpiMap] = useState<Record<string, number>>({});

  // ✅ FETCH DATA
  useEffect(() => {
    api.get(`assessments/clo-report/${courseId}/${batchId}/${semesterId}/`)
      .then((res: any) => {

        const response = res.data;

        if (response.error) {
          console.error(response.error);
          setData([]);
          return;
        }

        setReport(response);
        setData(response.students);

        // 🔥 CLO extract (CORRECT)
        const allClos = new Set<string>();
        response.students.forEach((s: any) => {
          Object.keys(s.clo_attainment || {}).forEach(clo => allClos.add(clo));
        });

        setClos(Array.from(allClos).sort());

        // 🔥 KPI extract
        if (response.students.length > 0) {
          const kpiValues: Record<string, number> = {};

          Object.entries(response.students[0].clo_attainment || {}).forEach(
            ([clo, val]: any) => {
              kpiValues[clo] = val.kpi;
            }
          );

          setKpiMap(kpiValues);
        }

      })
      .catch((err: any) => console.error(err));
  }, [courseId, batchId, semesterId]);

  // ✅ SUM FUNCTION
  const sum = (obj: any) =>
    Object.values(obj || {}).reduce((a: number, b: any) => a + Number(b || 0), 0);

  // ✅ EXPORT
  const handleDownloadExcel = async () => {
    const response = await api.get(
      `obe/student-assessments/export-excel/?course=${courseId}`,
      { responseType: "blob" }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "OBE_Report.xlsx");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <div className="flex items-center gap-4">
          <img src={logo} className="w-16 h-16" />
          <div>
            <h1 className="text-xl font-bold">
              FG Postgraduate College for Women Wah Cantt
            </h1>
          </div>
        </div>
      </div>

      {/* BUTTON */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg"
        >
          <ExcelIcon />
          Export Excel
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white p-4 rounded-xl shadow overflow-x-auto">
        <table className="w-full text-xs text-center border">

          <thead>

            {/* MAIN HEADER */}
            <tr className="bg-blue-900 text-white">
              <th>Name</th>

              {["quiz","assignment","midterm","presentation","final"].map(type => (
                <th key={type} colSpan={clos.length + 1}>
                  {type.toUpperCase()}
                </th>
              ))}

              <th>Total %</th>
              <th>GPA</th>
              <th>Status</th>
            </tr>

            {/* SUB HEADER */}
            <tr className="bg-gray-200">
              <th>Name</th>

              {["quiz","assignment","midterm","presentation","final"].map(type => (
                <React.Fragment key={type}>
                  {clos.map(clo => (
                    <th key={`${type}-${clo}`}>{clo}</th>
                  ))}
                  <th>%</th>
                </React.Fragment>
              ))}

              <th>Total %</th>
              <th>GPA</th>
              <th>Status</th>
            </tr>

          </thead>

          <tbody>

            {/* 🔥 STUDENT ROWS */}
            {data.map((row, i) => {

              const quizP = sum(row.quiz);
              const assignP = sum(row.assignment);
              const midP = sum(row.midterm);
              const presP = sum(row.presentation);
              const finalP = sum(row.final);

              const fail = row.status === "FAIL";

              return (
                <tr key={i}>

                  <td className="border p-2 font-semibold">{row.name}</td>

                  {/* QUIZ */}
                  {clos.map(clo => <td key={`q-${i}-${clo}`}>{row.quiz?.[clo] || 0}</td>)}
                  <td>{quizP.toFixed(1)}</td>

                  {/* ASSIGNMENT */}
                  {clos.map(clo => <td key={`a-${i}-${clo}`}>{row.assignment?.[clo] || 0}</td>)}
                  <td>{assignP.toFixed(1)}</td>

                  {/* MID */}
                  {clos.map(clo => <td key={`m-${i}-${clo}`}>{row.midterm?.[clo] || 0}</td>)}
                  <td>{midP.toFixed(1)}</td>

                  {/* PRESENTATION */}
                  {clos.map(clo => <td key={`p-${i}-${clo}`}>{row.presentation?.[clo] || 0}</td>)}
                  <td>{presP.toFixed(1)}</td>

                  {/* FINAL */}
                  {clos.map(clo => <td key={`f-${i}-${clo}`}>{row.final?.[clo] || 0}</td>)}
                  <td>{finalP.toFixed(1)}</td>

                  <td className={fail ? "bg-red-500 text-white" : "bg-green-500 text-white"}>
                    {row.percentage?.toFixed(1)}%
                  </td>

                  <td>{row.gpa?.toFixed(2)}</td>

                  <td className={fail ? "text-red-600" : "text-green-600"}>
                    {row.status}
                  </td>

                </tr>
              );
            })}

            {/* 🔥 CLASS CLO ATTAINMENT */}
            <tr className="bg-gray-300 font-bold">
              <td>Class CLO</td>

              {clos.map(clo => (
                <td key={`att-${clo}`}>
                  {report?.class_clo_attainment?.[clo]?.percentage || 0}%
                  <br />
                  <span className="text-[10px]">
                    L{report?.class_clo_attainment?.[clo]?.level ?? 0}
                  </span>
                </td>
              ))}

              <td colSpan={(clos.length + 1) * 4 + 3}></td>
            </tr>

            {/* 🔥 KPI */}
            <tr className="bg-yellow-300 font-bold">
              <td>KPI</td>

              {clos.map(clo => (
                <td key={`kpi-${clo}`}>
                  {kpiMap[clo] ?? 60}%
                </td>
              ))}

              <td colSpan={(clos.length + 1) * 4 + 3}></td>
            </tr>

            {/* 🔥 ACHIEVEMENT */}
            <tr className="font-bold">
              <td>Achievement</td>

              {clos.map(clo => {

                const kpi = kpiMap[clo] ?? 60;
                const percentage = report?.class_clo_attainment?.[clo]?.percentage ?? 0;
                const achieved = percentage >= kpi;

                return (
                  <td
                    key={`ach-${clo}`}
                    className={achieved ? "bg-green-400" : "bg-red-400"}
                  >
                    {achieved ? "Achieved" : "Not Achieved"}
                  </td>
                );
              })}

              <td colSpan={(clos.length + 1) * 4 + 3}></td>
            </tr>

          </tbody>

        </table>
      </div>
    </div>
  );
};

export default OBEReport;