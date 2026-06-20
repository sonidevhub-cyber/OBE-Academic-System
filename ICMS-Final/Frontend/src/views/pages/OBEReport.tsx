import React, { useState, useEffect } from 'react';
import { api } from '../../api/api';

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

  // Calculate total columns for summary rows
  let totalCols = 2; // count + name
  reportData.type_groups?.forEach((group: any) => {
    group.assessments?.forEach((ass: any) => {
      ass.clos?.forEach(() => {
        totalCols++;
      });
    });
    if (shouldShowTypeTotal(group.type)) {
      totalCols++;
    }
  });
  totalCols += 3; // Total %, GPA, Status

  return (
    <div className="overflow-x-auto">
      {/* Course Info Header */}
      <div className="bg-white p-4 mb-4 rounded-lg shadow">
        <h3 className="text-xl font-bold text-gray-800">
          {reportData.course?.code && reportData.course?.name ? (
            `${reportData.course.code} - ${reportData.course.name}`
          ) : "OBE Report"}
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
          {reportData.students?.map((student: any, idx: number) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="border p-2 font-semibold text-center">{student.count}</td>
              <td className="border p-2 font-semibold text-center">{student.name}</td>

              {reportData.type_groups?.map((group: any, groupIdx: number) => (
                <>
                  {group.assessments?.map((ass: any, assIdx: number) => {
                    const studentAssData = student.assessments[ass.id];
                    return (
                      <>
                        {ass.clos?.map((clo: any, cloIdx: number) => (
                          <td
                            key={`${groupIdx}-${assIdx}-${cloIdx}`}
                            className="border p-2 text-center"
                          >
                            {studentAssData?.clo_data?.[clo.clo]?.obtained ?? 0}
                          </td>
                        ))}
                      </>
                    );
                  })}
                  {shouldShowTypeTotal(group.type) && (
                    <td className="border p-2 text-center font-semibold">
                      {student.type_totals?.[group.type]?.obtained ?? 0}
                    </td>
                  )}
                </>
              ))}

              <td
                className={`border p-2 text-center font-bold ${
                  student.percentage >= 50 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {student.percentage}%
              </td>
              <td className="border p-2 text-center">{student.gpa}</td>
              <td
                className={`border p-2 text-center font-bold ${
                  student.status === 'PASS' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {student.status}
              </td>
            </tr>
          ))}

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
                      const cloData = reportData.class_clo_attainment?.[clo.clo];
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
                              L{cloData.level}
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
                      const cloData = reportData.class_clo_attainment?.[clo.clo];
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
                      const cloData = reportData.class_clo_attainment?.[clo.clo];
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
    </div>
  );
};

export default OBEReport;
