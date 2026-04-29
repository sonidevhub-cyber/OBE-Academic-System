import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaFileExcel } from "react-icons/fa";
import { api } from "../../api/api";
import logo from "assets/logo2.png";

const ExcelIcon = FaFileExcel as unknown as React.FC;

interface Props {
  courseId: number;
}

const OBEReport: React.FC<Props> = ({ courseId }) => {

  const [data, setData] = useState<any[]>([]);
  const [clos, setClos] = useState<string[]>([]);

  useEffect(() => {
    api
      .get(`obe/student-assessments/obe-report/?course=${courseId}`)
      .then((res) => {
        setData(res.data);

        if (res.data.length > 0) {
          setClos(Object.keys(res.data[0].clo_total || {}));
        }
      })
      .catch((err) => console.error(err));
  }, [courseId]);

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
        <div className="flex items-center gap-4 mb-4">
          <img src={logo} className="w-16 h-16" />
          <div>
            <h1 className="text-xl font-bold">
              FG Postgraduate College for Women Wah Cantt
            </h1>
            <p className="text-sm text-gray-600">
              Applications of Information & Communication Technologies
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <p><b>Program:</b> BSE</p>
          <p><b>Semester:</b> Fall 2024</p>
          <p><b>Section:</b> A</p>
          <p><b>Teacher:</b> XYZ</p>
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
      <div className="bg-white p-4 rounded-xl shadow">
        <table className="w-full text-xs text-center">

          <thead>

            <tr className="bg-blue-900 text-white">
              <th rowSpan={3} className="border p-2">Name</th>

              <th colSpan={clos.length * 2 + 1} className="bg-yellow-400 text-black">Quizzes</th>
              <th colSpan={clos.length * 2 + 1} className="bg-blue-400">Assignments</th>
              <th colSpan={clos.length + 1} className="bg-green-400 text-black">Midterm</th>
              <th colSpan={clos.length + 1} className="bg-pink-400">Presentation</th>
              <th colSpan={clos.length + 1} className="bg-purple-400">Final</th>
              
              

              <th rowSpan={3} className="bg-gray-800 text-white">Total %</th>
              <th rowSpan={3} className="bg-black text-white">GPA</th>
              <th rowSpan={3} className="bg-red-500 text-white">Status</th>
            </tr>

            <tr>
              {[1,2].map((q,i)=>clos.map((clo,j)=>
                <th key={`q-${i}-${j}`}>Q{q} {clo}</th>
              ))}
              <th>%</th>

              {[1,2].map((q,i)=>clos.map((clo,j)=>
                <th key={`a-${i}-${j}`}>A{q} {clo}</th>
              ))}
              <th>%</th>

              {clos.map((clo,i)=><th key={`m-${i}`}>{clo}</th>)}
              <th>%</th>

              {clos.map((clo,i)=><th key={`f-${i}`}>{clo}</th>)}
              <th>%</th>

              {clos.map((clo,i)=><th key={`p-${i}`}>{clo}</th>)}
              <th>%</th>

              {clos.map((clo,i)=><th key={`l-${i}`}>{clo}</th>)}
              <th>%</th>
            </tr>

          </thead>

          <tbody>
            {data.map((row, i) => {

              const totalClos = clos.length || 1;

              const sum = (obj:any)=>
                Object.values(obj||{}).reduce((a:number,b:any)=>a+Number(b||0),0);

              // ✅ fallback fix
              const quizData = row.quiz || row.clo_total || {};
              const assignData = row.assignment || row.clo_total || {};
              const midData = row.midterm || row.clo_total || {};
              const finalData = row.final || row.clo_total || {};
              const presData = row.presentation || row.clo_total || {};
              const labData = row.lab || row.clo_total || {};

              const quizP = sum(quizData);
              const assignP = sum(assignData);
              const midP = sum(midData);
              const finalP = sum(finalData);
              const presP = sum(presData);
              

              const total = row.percentage;

              const gpa = row.gpa;
              const fail = row.status === "Fail";
              return (
                <tr key={i}>

                  <td className="border p-2 font-semibold text-left">{row.name}</td>

                  {[1,2].map((_,qi)=>
                    clos.map((clo,ci)=>
                      <td key={`q-${qi}-${ci}`}>{quizData?.[clo] || 0}</td>
                  ))}
                  <td className="bg-yellow-200 font-bold">{quizP.toFixed(1)}</td>

                  {[1,2].map((_,ai)=>
                    clos.map((clo,ci)=>
                      <td key={`a-${ai}-${ci}`}>{assignData?.[clo] || 0}</td>
                  ))}
                  <td className="bg-blue-200 font-bold">{assignP.toFixed(1)}</td>

                  {clos.map((clo,i)=>
                    <td key={`m-${i}`}>{midData?.[clo] || 0}</td>
                  )}
                  <td className="bg-green-200 font-bold">{midP.toFixed(1)}</td>

                  {clos.map((clo,i)=>
                    <td key={`f-${i}`}>{finalData?.[clo] || 0}</td>
                  )}
                  <td className="bg-purple-200 font-bold">{finalP.toFixed(1)}</td>

                  {clos.map((clo,i)=>
                    <td key={`p-${i}`}>{presData?.[clo] || 0}</td>
                  )}
                  <td className="bg-pink-200 font-bold">{presP.toFixed(1)}</td>

                  {clos.map((clo,i)=>
                    <td key={`l-${i}`}>{labData?.[clo] || 0}</td>
                  )}
                  

                  <td className={`font-bold ${fail?"bg-red-500 text-white":"bg-green-500 text-white"}`}>
                    {total.toFixed(1)}%
                  </td>

                  <td className="font-bold">{gpa.toFixed(2)}</td>

                  <td className={`font-bold ${fail?"text-red-600":"text-green-600"}`}>
                    {fail?"FAIL":"PASS"}
                  </td>

                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default OBEReport;