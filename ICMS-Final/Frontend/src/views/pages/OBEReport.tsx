import React, { useState, useEffect } from 'react';
import { api } from '../../api/api';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
interface OBEReportProps {
  courseId: string;
  batchId: string;
  semesterId: string;
}

const OBEReport: React.FC<OBEReportProps> = ({ courseId, batchId, semesterId }) => {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
 

  useEffect(() => {
    fetchReport();
  }, [courseId, batchId, semesterId]);

  const fetchReport = async () => {
    try {
      console.log("Fetching report with:", { courseId, batchId, semesterId });
      const res = await api.get(
        `/assessments/clo-report/${courseId}/${batchId}/${semesterId}/`
      );
      console.log("Report API response:", res);
      
      // Handle both possible response formats
      let data;
      if (res.data?.data) {
        data = res.data.data;
      } else if (res.data?.students) {
        data = res.data;
      } else {
        data = res.data;
      }
      
      console.log("Processed report data:", data);
      setReportData(data);
     
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Loading Report...</div>;
  if (!reportData) return <div className="text-center py-8">No report data available</div>;

  const allReportStudents = reportData.students || [];
  const totalStudents = allReportStudents.length;

const passedStudents =
  allReportStudents.filter((s: any) => s.status === "PASS").length || 0;

const failedStudents = totalStudents - passedStudents;

const overallPercentage =
  totalStudents > 0
    ? (
        allReportStudents.reduce(
          (sum: number, s: any) => sum + s.percentage,
          0
        ) / totalStudents
      ).toFixed(2)
    : 0;

const overallGPA =
  totalStudents > 0
    ? (
        allReportStudents.reduce(
          (sum: number, s: any) => sum + s.gpa,
          0
        ) / totalStudents
      ).toFixed(2)
    : 0;
    const pieData = [
  { name: "Passed", value: passedStudents },
  { name: "Failed", value: failedStudents },
];

const displayClassCloAttainment = Object.entries(reportData.class_clo_attainment || {}).reduce(
  (acc: Record<string, any>, [cloCode, value]: any) => {
    const passedCount = allReportStudents.filter((student: any) => {
      if (student.is_retake && student.retake_display_cells) {
        const retakeCloCells = Object.entries(student.retake_display_cells).filter(([key]) =>
          key.endsWith(`:${cloCode}`)
        );
        if (retakeCloCells.length > 0) {
          const totals = retakeCloCells.reduce(
            (sum: { obtained: number; total: number }, [, cell]: any) => ({
              obtained: sum.obtained + Number(cell?.obtained ?? 0),
              total: sum.total + Number(cell?.total ?? 0),
            }),
            { obtained: 0, total: 0 }
          );
          return totals.total > 0 && (totals.obtained / totals.total) * 100 >= 50;
        }
      }
      const percentage = Number(student.clo_attainment?.[cloCode]?.percentage ?? 0);
      return percentage >= 50;
    }).length;
    const percentage = totalStudents > 0 ? Number(((passedCount / totalStudents) * 100).toFixed(2)) : 0;
    const kpi = Number(value?.kpi ?? 60);
    acc[cloCode] = {
      ...value,
      percentage,
      status: percentage >= kpi ? 'Achieved' : 'Not Achieved',
    };
    return acc;
  },
  {}
);

const lineData = Object.entries(displayClassCloAttainment).map(
  ([clo, value]: any) => ({
    clo,
    percentage: value.percentage,
  })
);

const COLORS = ["#22c55e", "#ef4444"];
  
  const getTypeTitle = (type: string) => {
    switch (type) {
      case 'quiz': return 'Quiz';
      case 'assignment': return 'Assignment';
      case 'midterm': return 'Midterm';
      case 'presentation': return 'Presentation';
      case 'final': return 'Final';
      default: return type;
    }
  };

  const shouldShowTypeTotal = (type: string) => {
    return !['midterm', 'final'].includes(type);
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return 0;
    return value;
  };

  const formatMarks = (value: any) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return formatCellValue(value);
    return Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(2);
  };

  const formatBloomLevel = (level: any) => {
    const rawLevel = String(level || '').trim();
    return rawLevel.replace(/^L(?=C?\d)/i, '');
  };

  const renderStudentDataRow = (student: any, typeGroups: any[]) => (
    <tr key={student.retake_id || student.student_id || student.count} className="hover:bg-gray-50">
      <td className="border p-2 font-semibold text-center">{student.count}</td>
      <td className="border p-2 font-semibold text-center">
        <div>{student.name}</div>
        {student.is_retake && (
          <div className="mt-1 text-xs font-bold text-amber-700">
            Retake Attempt {student.attempt_number || 1}
          </div>
        )}
      </td>
      {typeGroups.map((group: any, groupIdx: number) => (
        <React.Fragment key={`row-group-${student.count}-${groupIdx}`}>
          {group.assessments?.map((ass: any, assIdx: number) => {
            const studentAssData = student.assessments?.[ass.id];
            return (
              <React.Fragment key={`row-ass-${ass.id || assIdx}`}>
                {ass.clos?.map((clo: any, cloIdx: number) => {
                  const retakeCell = student.retake_display_cells?.[`${group.type}:${clo.clo}`];
                  const isExempt = studentAssData?.clo_data?.[clo.clo]?.is_exempt;
                  return (
                    <td key={`${groupIdx}-${assIdx}-${cloIdx}`} className="border p-2 text-center">
                      {student.is_retake && retakeCell ? (
                        <div className="leading-tight">
                          <div className="text-xs font-semibold text-amber-700">{retakeCell.title || getTypeTitle(group.type)}</div>
                          <div className="font-bold">
                            {formatMarks(retakeCell.obtained)}/{formatMarks(retakeCell.total)}
                          </div>
                        </div>
                      ) : isExempt ? (
                        'NA'
                      ) : (
                        formatCellValue(studentAssData?.clo_data?.[clo.clo]?.obtained)
                      )}
                    </td>
                  );
                })}
              </React.Fragment>
            );
          })}
          {shouldShowTypeTotal(group.type) && (
            <td className="border p-2 text-center font-semibold">
              {student.is_retake && student.retake_type_totals?.[group.type] ? (
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-amber-700">{getTypeTitle(group.type)} Total</div>
                  <div>
                    {formatMarks(student.retake_type_totals[group.type].obtained)}/
                    {formatMarks(student.retake_type_totals[group.type].total)}
                  </div>
                </div>
              ) : student.type_totals?.[group.type]?.is_exempt ? (
                'NA'
              ) : (
                formatCellValue(student.type_totals?.[group.type]?.obtained)
              )}
            </td>
          )}
        </React.Fragment>
      ))}
      <td className={`border p-2 text-center font-bold ${student.percentage >= 50 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {student.percentage}%
      </td>
      <td className="border p-2 text-center">{student.gpa}</td>
      <td className={`border p-2 text-center font-bold ${student.status === 'PASS' ? 'text-green-700' : 'text-red-700'}`}>
        {student.status}
      </td>
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      {/* Course Info Header */}
      <div className="bg-white p-4 mb-4 rounded-lg shadow">
        <h3 className="text-xl font-bold text-gray-800">
          {reportData.course?.code && reportData.course?.name ? (
            `${reportData.course.code} - ${reportData.course.name}`
          ) : "Student Report"}
        </h3>
        {reportData.semester?.number && (
          <p className="text-gray-600 mt-1">Semester: {reportData.semester.number}</p>
        )}
      </div>

      <div className="flex justify-end mb-4">
        <button className="bg-green-600 text-white px-4 py-2 rounded-lg">
          Export Excel
        </button>
        
      </div>

      <table className="w-full border-collapse border border-gray-300">
        {/* Header Row 1 - Assessment Type Groups */}
        <thead>
          <tr>
            <th rowSpan={2} className="border p-3 bg-blue-900 text-white font-bold w-16">
              #
            </th>
            <th rowSpan={2} className="border p-3 bg-blue-900 text-white font-bold w-40">
              Name
            </th>
            {reportData.type_groups?.map((group: any, idx: number) => {
              let groupColSpan = 0;
              group.assessments?.forEach((ass: any) => {
                groupColSpan += ass.clos?.length || 0;
              });
              if (shouldShowTypeTotal(group.type)) {
                groupColSpan++;
              }
              return (
                <th
                  key={idx}
                  colSpan={groupColSpan}
                  className="border p-3 bg-blue-900 text-white font-bold text-center"
                >
                  {getTypeTitle(group.type)}
                </th>
              );
            })}
            <th rowSpan={2} className="border p-3 bg-blue-900 text-white font-bold">
              Total %
            </th>
            <th rowSpan={2} className="border p-3 bg-blue-900 text-white font-bold">
              GPA
            </th>
            <th rowSpan={2} className="border p-3 bg-blue-900 text-white font-bold">
              Status
            </th>
          </tr>

          {/* Header Row 2 - Individual Assessments */}
          <tr>
            {reportData.type_groups?.map((group: any) => (
              <>
                {group.assessments?.map((ass: any, assIdx: number) => (
                  <>
                    {ass.clos?.map((clo: any, cloIdx: number) => (
                      <th
                        key={`${assIdx}-${cloIdx}`}
                        className="border p-2 bg-blue-800 text-white text-center"
                      >
                        <div className="font-semibold">{ass.title}</div>
                        <div className="text-xs text-gray-200">
                          {clo.clo} ({clo.total} marks)
                        </div>
                      </th>
                    ))}
                  </>
                ))}
                {shouldShowTypeTotal(group.type) && (
                  <th className="border p-2 bg-blue-700 text-white text-center font-semibold">
                    {getTypeTitle(group.type)} Total
                  </th>
                )}
              </>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* Student Rows */}
          {reportData.students?.map((student: any) => renderStudentDataRow(student, reportData.type_groups || []))}

          {/* Class CLO Summary Row */}
          <tr className="bg-gray-200">
            <td className="border p-3 font-bold text-center"></td>
            <td className="border p-3 font-bold text-center">Class CLO</td>
            {(() => {
              const shownClos = new Set<string>();
              const cells: React.ReactNode[] = [];
              
              reportData.type_groups?.forEach((group: any) => {
                group.assessments?.forEach((ass: any) => {
                  ass.clos?.forEach((clo: any) => {
                    if (!shownClos.has(clo.clo)) {
                      shownClos.add(clo.clo);
                      const cloData = displayClassCloAttainment?.[clo.clo];
                      cells.push(
                        <td
                          key={`class-clo-${clo.clo}`}
                          className="border p-2 text-center font-semibold"
                        >
                          <div>{clo.clo}</div>
                          <div className="text-sm">
                            {cloData?.percentage}%
                          </div>
                          {cloData?.level && (
                            <div className="text-xs text-gray-600">
                              {formatBloomLevel(cloData.level)}
                            </div>
                          )}
                        </td>
                      );
                    } else {
                      cells.push(
                        <td key={`class-clo-empty-${clo.clo}-${ass.id}`} className="border p-2"></td>
                      );
                    }
                  });
                });
                if (shouldShowTypeTotal(group.type)) {
                  cells.push(<td key={`class-total-${group.type}`} className="border p-2"></td>);
                }
              });
              
              return cells;
            })()}
            <td colSpan={3} className="border p-2"></td>
          </tr>

          {/* KPI Summary Row */}
          <tr className="bg-yellow-200">
            <td className="border p-3 font-bold text-center"></td>
            <td className="border p-3 font-bold text-center">KPI</td>
            {(() => {
              const shownClos = new Set<string>();
              const cells: React.ReactNode[] = [];
              
              reportData.type_groups?.forEach((group: any) => {
                group.assessments?.forEach((ass: any) => {
                  ass.clos?.forEach((clo: any) => {
                    if (!shownClos.has(clo.clo)) {
                      shownClos.add(clo.clo);
                      const cloData = displayClassCloAttainment?.[clo.clo];
                      cells.push(
                        <td
                          key={`kpi-${clo.clo}`}
                          className="border p-2 text-center font-semibold"
                        >
                          {clo.clo}
                          <div className="text-sm">
                            {cloData?.kpi}%
                          </div>
                        </td>
                      );
                    } else {
                      cells.push(
                        <td key={`kpi-empty-${clo.clo}-${ass.id}`} className="border p-2"></td>
                      );
                    }
                  });
                });
                if (shouldShowTypeTotal(group.type)) {
                  cells.push(<td key={`kpi-total-${group.type}`} className="border p-2"></td>);
                }
              });
              
              return cells;
            })()}
            <td colSpan={3} className="border p-2"></td>
          </tr>

          {/* Achievement Summary Row */}
          <tr className="bg-gray-100">
            <td className="border p-3 font-bold text-center"></td>
            <td className="border p-3 font-bold text-center">Achievement</td>
            {(() => {
              const shownClos = new Set<string>();
              const cells: React.ReactNode[] = [];
              
              reportData.type_groups?.forEach((group: any) => {
                group.assessments?.forEach((ass: any) => {
                  ass.clos?.forEach((clo: any) => {
                    if (!shownClos.has(clo.clo)) {
                      shownClos.add(clo.clo);
                      const cloData = displayClassCloAttainment?.[clo.clo];
                      const isAchieved = cloData?.status === 'Achieved';
                      cells.push(
                        <td
                          key={`achievement-${clo.clo}`}
                          className={`border p-2 text-center font-bold ${
                            isAchieved
                              ? 'bg-green-400 text-green-900'
                              : 'bg-red-400 text-red-900'
                          }`}
                        >
                          {clo.clo}
                          <div className="text-xs">
                            {isAchieved ? 'Achieved' : 'Not Achieved'}
                          </div>
                        </td>
                      );
                    } else {
                      cells.push(
                        <td key={`achievement-empty-${clo.clo}-${ass.id}`} className="border p-2"></td>
                      );
                    }
                  });
                });
                if (shouldShowTypeTotal(group.type)) {
                  cells.push(<td key={`achievement-total-${group.type}`} className="border p-2"></td>);
                }
              });
              
              return cells;
            })()}
            <td colSpan={3} className="border p-2"></td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-5 gap-4 mt-8">

<div className="bg-blue-100 rounded-lg p-4 text-center shadow">
<h3 className="font-bold">Total Students</h3>
<p className="text-2xl font-bold">{totalStudents}</p>
</div>

<div className="bg-green-100 rounded-lg p-4 text-center shadow">
<h3 className="font-bold">Passed</h3>
<p className="text-2xl font-bold">{passedStudents}</p>
</div>

<div className="bg-red-100 rounded-lg p-4 text-center shadow">
<h3 className="font-bold">Failed</h3>
<p className="text-2xl font-bold">{failedStudents}</p>
</div>

<div className="bg-yellow-100 rounded-lg p-4 text-center shadow">
<h3 className="font-bold">Overall %</h3>
<p className="text-2xl font-bold">{overallPercentage}%</p>
</div>

<div className="bg-purple-100 rounded-lg p-4 text-center shadow">
<h3 className="font-bold">Overall GPA</h3>
<p className="text-2xl font-bold">{overallGPA}</p>
</div>

</div>
{/* ================= PERFORMANCE ANALYTICS ================= */}

<div className="mt-10">

  <h2 className="text-2xl font-bold mb-5">
    Performance Analytics
  </h2>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

    {/* ================= PASS / FAIL PIE ================= */}
    <div className="bg-white shadow rounded-lg p-5">
      <h3 className="font-bold text-center mb-3">
        Pass / Fail Ratio
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
            label
          >
            {pieData.map((entry: any, index: number) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>

          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>

    {/* ================= PASS / FAIL BAR ================= */}
    <div className="bg-white shadow rounded-lg p-5">
      <h3 className="font-bold text-center mb-3">
        Pass vs Fail
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={[
            {
              name: "Students",
              Pass: passedStudents,
              Fail: failedStudents,
            },
          ]}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Bar dataKey="Pass" fill="#22c55e" />

          <Bar dataKey="Fail" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {/* ================= CLO LINE CHART ================= */}
    <div className="bg-white shadow rounded-lg p-5 lg:col-span-2">
      <h3 className="font-bold text-center mb-3">
        CLO Attainment
      </h3>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={lineData}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="clo" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"
            dataKey="percentage"
            stroke="#2563eb"
            strokeWidth={3}
          />

        </LineChart>
      </ResponsiveContainer>
    </div>

  </div>

</div>
    </div>
  );
};

export default OBEReport;
