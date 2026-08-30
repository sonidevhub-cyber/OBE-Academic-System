import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
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

// ================= TYPES & INTERFACES =================
interface OBEReportProps {
  courseId: string;
  batchId: string;
  semesterId: string;
}

interface CloItem {
  clo: string;
  total: number;
}

interface AssessmentItem {
  id: string | number;
  title: string;
  clos: CloItem[];
}

interface TypeGroup {
  type: string;
  weightage?: number;
  assessments: AssessmentItem[];
}

interface StudentAssessmentData {
  clo_data?: Record<string, { obtained?: number; is_exempt?: boolean }>;
}

interface Student {
  student_id?: string;
  retake_id?: string;
  count: number;
  name: string;
  registration_number?: string;
  custom_id?: string;
  percentage: number;
  gpa: number;
  status: 'PASS' | 'FAIL' | string;
  is_retake?: boolean;
  attempt_number?: number;
  assessments?: Record<string, StudentAssessmentData>;
  retake_display_cells?: Record<string, { title?: string; obtained?: number; total?: number }>;
  type_totals?: Record<string, { obtained?: number; is_exempt?: boolean; weighted_score?: number }>;
  retake_type_totals?: Record<string, { obtained?: number; total?: number }>;
  clo_attainment?: Record<string, { percentage?: number }>;
  type_weighted_scores?: Record<string, number>;
}

interface ClassCloAttainment {
  kpi?: number;
  level?: string;
  percentage?: number;
  status?: 'Achieved' | 'Not Achieved';
}

interface ReportData {
  course?: { code?: string; name?: string };
  semester?: { number?: string | number };
  students?: Student[];
  type_groups?: TypeGroup[];
  class_clo_attainment?: Record<string, ClassCloAttainment>;
}

const DEFAULT_WEIGHTAGES: Record<string, number> = {
  quiz: 5,
  assignment: 5,
  presentation: 5,
  midterm: 25,
  final: 50,
};

// ================= COMPONENT =================
const OBEReport: React.FC<OBEReportProps> = ({ courseId, batchId, semesterId }) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReport();
  }, [courseId, batchId, semesterId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assessments/clo-report/${courseId}/${batchId}/${semesterId}/`);
      let data: ReportData = res.data?.data || res.data?.students ? res.data : res.data;
      
      // Sort students by registration number and add sequential numbering
      if (data.students && Array.isArray(data.students)) {
        data.students = [...data.students]
          .sort((a: Student, b: Student) => {
            const regA = a.registration_number || a.custom_id || '';
            const regB = b.registration_number || b.custom_id || '';
            return regA.localeCompare(regB);
          })
          .map((student: Student, index: number) => ({
            ...student,
            count: index + 1
          }));
      }
      
      setReportData(data);
    } catch (err) {
      console.error("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeTitle = (type: string) => {
    const titles: Record<string, string> = {
      quiz: 'Quiz',
      assignment: 'Assignment',
      midterm: 'Midterm',
      presentation: 'Presentation',
      final: 'Final',
    };
    return titles[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTargetWeightage = (group: TypeGroup) => {
    const typeKey = group.type.toLowerCase();
    return group.weightage || DEFAULT_WEIGHTAGES[typeKey] || 10;
  };

  const formatMarks = (value: any) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return value ?? 0;
    return Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(2);
  };

  const formatBloomLevel = (level: any) => String(level || '').trim().replace(/^L(?=C?\d)/i, '');

  const calculateWeightedTotal = (student: Student, group: TypeGroup) => {
    const typeKey = group.type.toLowerCase();
    const targetWeight = getTargetWeightage(group);

    if (student.type_weighted_scores?.[typeKey] !== undefined) {
      return formatMarks(student.type_weighted_scores[typeKey]);
    }
    if (student.type_totals?.[typeKey]?.weighted_score !== undefined) {
      return formatMarks(student.type_totals[typeKey].weighted_score);
    }

    let totalObtained = 0;
    let totalMax = 0;

    (group.assessments || []).forEach((ass) => {
      const studentAssData = student.assessments?.[ass.id];
      ass.clos?.forEach((clo) => {
        const ob = studentAssData?.clo_data?.[clo.clo]?.obtained ?? 0;
        totalObtained += Number(ob);
        totalMax += Number(clo.total || 0);
      });
    });

    if (totalMax === 0) return "0";
    const weightedScore = (totalObtained / totalMax) * targetWeight;
    return formatMarks(weightedScore);
  };

  // COMPLETE DYNAMIC EXCEL EXPORT (MANUAL MATRIX BUILDER)
  const handleExportExcel = () => {
    setShowExportMenu(false);
    if (!reportData?.students?.length) return;

    const processedGroups = (reportData.type_groups || []).map((group) => {
      const typeKey = group.type.toLowerCase();
      if (typeKey === 'quiz' || typeKey === 'assignment') {
        return { ...group, assessments: (group.assessments || []).slice(0, 3) };
      }
      return group;
    });

    // 1. First Header Row
    const row1: string[] = ["#", "Student Name"];
    // 2. Second Header Row
    const row2: string[] = ["", ""];

    processedGroups.forEach((group) => {
      let groupColCount = 0;

      (group.assessments || []).forEach((ass) => {
        (ass.clos || []).forEach((clo) => {
          row2.push(`${ass.title} (${clo.clo}) [${clo.total}m]`);
          groupColCount++;
        });
      });

      const targetWeight = getTargetWeightage(group);
      row2.push(`${getTypeTitle(group.type)} Total (Wt: ${targetWeight})`);
      groupColCount++;

      row1.push(getTypeTitle(group.type));
      for (let i = 1; i < groupColCount; i++) {
        row1.push("");
      }
    });

    row1.push("Total %", "GPA", "Status");
    row2.push("", "", "");

    // 3. Student Data Rows
    const studentRows = reportData.students.map((student) => {
      const rowData: (string | number)[] = [
        student.count,
        student.is_retake ? `${student.name} (Retake ${student.attempt_number || 1})` : student.name
      ];

      processedGroups.forEach((group) => {
        const typeKey = group.type.toLowerCase();

        (group.assessments || []).forEach((ass) => {
          const studentAssData = student.assessments?.[ass.id];
          (ass.clos || []).forEach((clo) => {
            const retakeCell = student.retake_display_cells?.[`${group.type}:${clo.clo}`];
            const isExempt = studentAssData?.clo_data?.[clo.clo]?.is_exempt;

            if (student.is_retake && retakeCell) {
              rowData.push(`${formatMarks(retakeCell.obtained)}/${formatMarks(retakeCell.total)}`);
            } else if (isExempt) {
              rowData.push("NA");
            } else {
              rowData.push(formatMarks(studentAssData?.clo_data?.[clo.clo]?.obtained));
            }
          });
        });

        if (student.type_totals?.[typeKey]?.is_exempt) {
          rowData.push("NA");
        } else {
          rowData.push(calculateWeightedTotal(student, group));
        }
      });

      rowData.push(`${student.percentage}%`, student.gpa, student.status);
      return rowData;
    });

    // 4. Class CLO Summary Row
    const classCloRow: (string | number)[] = ["", "Class CLO %"];
    processedGroups.forEach((group) => {
      (group.assessments || []).forEach((ass) => {
        (ass.clos || []).forEach((clo) => {
          const cloData = displayClassCloAttainment?.[clo.clo];
          classCloRow.push(cloData?.percentage !== undefined ? `${cloData.percentage}%` : "-");
        });
      });
      classCloRow.push("");
    });
    classCloRow.push("", "", "");

    const sheetData = [row1, row2, ...studentRows, [], classCloRow];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    const colWidths = sheetData[1].map((val) => ({
      wch: Math.max(String(val).length + 3, 12),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OBE Report");
    XLSX.writeFile(workbook, `OBE_Complete_Report_${courseId}_Sem_${semesterId}.xlsx`);
  };

  // ISOLATED PRINT / PDF
  const handleExportPDF = () => {
    setShowExportMenu(false);
    window.print();
  };

  if (loading) return <div className="text-center py-12 text-blue-900 font-semibold text-lg">Loading Report Data...</div>;
  if (!reportData) return <div className="text-center py-12 text-gray-500 font-semibold">No report data available.</div>;

  const allReportStudents = reportData.students || [];
  const totalStudents = allReportStudents.length;
  const passedStudents = allReportStudents.filter((s) => s.status === "PASS").length;
  const failedStudents = totalStudents - passedStudents;

  const overallPercentage = totalStudents > 0
    ? (allReportStudents.reduce((sum, s) => sum + (s.percentage || 0), 0) / totalStudents).toFixed(2)
    : "0";

  const overallGPA = totalStudents > 0
    ? (allReportStudents.reduce((sum, s) => sum + (s.gpa || 0), 0) / totalStudents).toFixed(2)
    : "0";

  const pieData = [
    { name: "Passed", value: passedStudents },
    { name: "Failed", value: failedStudents },
  ];

  const processedTypeGroups = (reportData.type_groups || []).map((group) => {
    const typeKey = group.type.toLowerCase();
    if (typeKey === 'quiz' || typeKey === 'assignment') {
      return { ...group, assessments: (group.assessments || []).slice(0, 3) };
    }
    return group;
  });

  const displayClassCloAttainment = Object.entries(reportData.class_clo_attainment || {}).reduce(
    (acc: Record<string, ClassCloAttainment>, [cloCode, value]) => {
      const passedCount = allReportStudents.filter((student) => {
        if (student.is_retake && student.retake_display_cells) {
          const retakeCloCells = Object.entries(student.retake_display_cells).filter(([key]) =>
            key.endsWith(`:${cloCode}`)
          );
          if (retakeCloCells.length > 0) {
            const totals = retakeCloCells.reduce(
              (sum, [, cell]) => ({
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

  const lineData = Object.entries(displayClassCloAttainment).map(([clo, value]) => ({
    clo,
    percentage: value.percentage ?? 0,
  }));

  const COLORS = ["#1e40af", "#dc2626"];

  const renderSummaryRow = (
    label: string,
    rowBg: string,
    getValueNode: (cloCode: string, cloData: ClassCloAttainment | undefined) => React.ReactNode
  ) => {
    const shownClos = new Set<string>();
    const cells: React.ReactNode[] = [];

    processedTypeGroups.forEach((group, gIdx) => {
      group.assessments?.forEach((ass, aIdx) => {
        ass.clos?.forEach((clo, cIdx) => {
          const key = `${gIdx}-${aIdx}-${cIdx}`;
          if (!shownClos.has(clo.clo)) {
            shownClos.add(clo.clo);
            const cloData = displayClassCloAttainment?.[clo.clo];
            cells.push(
              <td key={`sum-${label}-${clo.clo}-${key}`} className="border border-blue-200 p-2 text-center font-semibold text-sm">
                {getValueNode(clo.clo, cloData)}
              </td>
            );
          } else {
            cells.push(<td key={`sum-empty-${label}-${key}`} className="border border-blue-200 p-2"></td>);
          }
        });
      });

      cells.push(<td key={`sum-type-total-${label}-${gIdx}`} className="border border-blue-200 p-2"></td>);
    });

    return (
      <tr className={rowBg}>
        <td className="border border-blue-200 p-3 font-bold text-center"></td>
        <td className="border border-blue-200 p-3 font-bold text-center text-blue-900">{label}</td>
        {cells}
        <td colSpan={3} className="border border-blue-200 p-2"></td>
      </tr>
    );
  };

  const renderStudentDataRow = (student: Student, typeGroups: TypeGroup[]) => (
    <tr key={student.retake_id || student.student_id || student.count} className="hover:bg-blue-50/50 transition-colors">
      <td className="border border-blue-200 p-2 font-semibold text-center text-blue-900">{student.count}</td>
      <td className="border border-blue-200 p-2 font-semibold text-center text-blue-950">
        <div>{student.name}</div>
        <div className="text-[11px] text-blue-600 font-normal">
          {student.registration_number || student.custom_id || ''}
        </div>
        {student.is_retake && (
          <span className="mt-1 inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            Retake Attempt {student.attempt_number || 1}
          </span>
        )}
      </td>
      {typeGroups.map((group, groupIdx) => {
        const targetWeight = getTargetWeightage(group);

        return (
          <React.Fragment key={`row-group-${student.count}-${groupIdx}`}>
            {group.assessments?.map((ass, assIdx) => {
              const studentAssData = student.assessments?.[ass.id];
              return (
                <React.Fragment key={`row-ass-${ass.id || assIdx}`}>
                  {ass.clos?.map((clo, cloIdx) => {
                    const retakeCell = student.retake_display_cells?.[`${group.type}:${clo.clo}`];
                    const isExempt = studentAssData?.clo_data?.[clo.clo]?.is_exempt;
                    return (
                      <td key={`${groupIdx}-${assIdx}-${cloIdx}`} className="border border-blue-200 p-2 text-center text-sm">
                        {student.is_retake && retakeCell ? (
                          <div className="leading-tight">
                            <div className="text-[11px] font-semibold text-amber-700">{retakeCell.title || getTypeTitle(group.type)}</div>
                            <div className="font-bold">
                              {formatMarks(retakeCell.obtained)}/{formatMarks(retakeCell.total)}
                            </div>
                          </div>
                        ) : isExempt ? (
                          <span className="text-gray-400 font-medium">NA</span>
                        ) : (
                          formatMarks(studentAssData?.clo_data?.[clo.clo]?.obtained)
                        )}
                      </td>
                    );
                  })}
                </React.Fragment>
              );
            })}

            <td className="border border-blue-200 p-2 text-center font-bold bg-blue-50 text-blue-950 text-sm">
              {student.type_totals?.[group.type.toLowerCase()]?.is_exempt ? (
                <span className="text-gray-400 font-medium">NA</span>
              ) : (
                calculateWeightedTotal(student, group)
              )}
            </td>
          </React.Fragment>
        );
      })}
      <td className={`border border-blue-200 p-2 text-center font-bold ${student.percentage >= 50 ? 'bg-blue-100/50 text-blue-900' : 'bg-red-50 text-red-700'}`}>
        {student.percentage}%
      </td>
      <td className="border border-blue-200 p-2 text-center font-medium text-blue-900">{student.gpa}</td>
      <td className="border border-blue-200 p-2 text-center">
        <span className={`px-2.5 py-1 rounded text-xs font-bold ${student.status === 'PASS' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`}>
          {student.status}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="p-4 bg-slate-50 min-h-screen printable-container">
      {/* Strict Media Print Styling - Isolates Only Report Table Header */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-container, .printable-container * {
            visibility: visible !important;
          }
          .printable-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
          }
          th, td {
            padding: 3px 2px !important;
            border: 1px solid #94a3b8 !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="bg-white p-5 mb-6 rounded-lg shadow-sm border border-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">
            {reportData.course?.code && reportData.course?.name
              ? `${reportData.course.code} - ${reportData.course.name}`
              : "Course OBE Report"}
          </h1>
          {reportData.semester?.number && (
            <p className="text-blue-700 font-medium mt-1">Semester: {reportData.semester.number}</p>
          )}
        </div>

        {/* EXPORT DROPDOWN */}
        <div className="relative no-print" ref={dropdownRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-md shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <span>📥</span> Export Report
            <span className="text-xs ml-1">▼</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-blue-100 py-1 z-50">
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-950 hover:bg-blue-50 flex items-center gap-2 transition-colors"
              >
                <span>📄</span> Export PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-950 hover:bg-blue-50 flex items-center gap-2 transition-colors border-t border-gray-100"
              >
                <span>📊</span> Export Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Report Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-blue-200">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-blue-800 p-3 bg-blue-900 text-white font-bold w-12 text-center">#</th>
              <th rowSpan={2} className="border border-blue-800 p-3 bg-blue-900 text-white font-bold w-48 text-center">Student Name</th>
              {processedTypeGroups.map((group, idx) => {
                let groupColSpan = (group.assessments || []).reduce((acc, ass) => acc + (ass.clos?.length || 0), 0) + 1;
                return (
                  <th
                    key={`group-hdr-${idx}`}
                    colSpan={groupColSpan}
                    className="border border-blue-800 p-3 bg-blue-900 text-white font-bold text-center"
                  >
                    {getTypeTitle(group.type)}
                  </th>
                );
              })}
              <th rowSpan={2} className="border border-blue-800 p-3 bg-blue-900 text-white font-bold text-center">Total %</th>
              <th rowSpan={2} className="border border-blue-800 p-3 bg-blue-900 text-white font-bold text-center">GPA</th>
              <th rowSpan={2} className="border border-blue-800 p-3 bg-blue-900 text-white font-bold text-center">Status</th>
            </tr>

            <tr>
              {processedTypeGroups.map((group, gIdx) => {
                const targetWeight = getTargetWeightage(group);

                return (
                  <React.Fragment key={`subhdr-group-${gIdx}`}>
                    {group.assessments?.map((ass, assIdx) => (
                      <React.Fragment key={`subhdr-ass-${ass.id || assIdx}`}>
                        {ass.clos?.map((clo, cloIdx) => (
                          <th
                            key={`subhdr-clo-${cloIdx}`}
                            className="border border-blue-700 p-2 bg-blue-800 text-white text-center font-normal min-w-[80px]"
                          >
                            <div className="font-semibold text-sm">{ass.title}</div>
                            <div className="text-[11px] text-blue-200">
                              {clo.clo} ({clo.total} m)
                            </div>
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                    <th className="border border-blue-600 p-2 bg-blue-950 text-white text-center font-semibold text-sm min-w-[90px]">
                      {getTypeTitle(group.type)} Total (Wt: {targetWeight})
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {reportData.students?.map((student) => renderStudentDataRow(student, processedTypeGroups))}

            {/* Class CLO Summary */}
            {renderSummaryRow("Class CLO", "bg-blue-50/80", (cloCode, cloData) => (
              <>
                <div>{cloCode}</div>
                <div className="text-sm font-bold text-blue-900">{cloData?.percentage}%</div>
                {cloData?.level && (
                  <div className="text-[11px] text-blue-700 font-normal">
                    {formatBloomLevel(cloData.level)}
                  </div>
                )}
              </>
            ))}

            {/* KPI Summary */}
            {renderSummaryRow("KPI Target", "bg-blue-100/50", (cloCode, cloData) => (
              <>
                <div>{cloCode}</div>
                <div className="text-sm font-bold text-blue-900">{cloData?.kpi}%</div>
              </>
            ))}

            {/* Achievement Summary */}
            {renderSummaryRow("Achievement", "bg-slate-50", (cloCode, cloData) => {
              const isAchieved = cloData?.status === 'Achieved';
              return (
                <div className={`p-1 rounded text-xs font-bold ${isAchieved ? 'bg-blue-700 text-white' : 'bg-red-600 text-white'}`}>
                  {cloCode}
                  <div>{isAchieved ? 'Achieved' : 'Not Achieved'}</div>
                </div>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 no-print">
        <div className="bg-white rounded-lg p-4 text-center border border-blue-200 shadow-sm">
          <h4 className="text-sm text-blue-800 font-medium">Total Students</h4>
          <p className="text-2xl font-extrabold text-blue-950 mt-1">{totalStudents}</p>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-blue-200 shadow-sm">
          <h4 className="text-sm text-blue-800 font-medium">Passed</h4>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">{passedStudents}</p>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-red-200 shadow-sm">
          <h4 className="text-sm text-red-600 font-medium">Failed</h4>
          <p className="text-2xl font-extrabold text-red-700 mt-1">{failedStudents}</p>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-blue-200 shadow-sm">
          <h4 className="text-sm text-blue-800 font-medium">Overall %</h4>
          <p className="text-2xl font-extrabold text-blue-900 mt-1">{overallPercentage}%</p>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-blue-200 shadow-sm col-span-2 md:col-span-1">
          <h4 className="text-sm text-blue-800 font-medium">Overall GPA</h4>
          <p className="text-2xl font-extrabold text-blue-950 mt-1">{overallGPA}</p>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="mt-10 no-print">
        <h2 className="text-xl font-bold text-blue-950 mb-5">Performance Analytics</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow-sm border border-blue-200 rounded-lg p-5">
            <h3 className="font-bold text-blue-900 text-center mb-4">Pass / Fail Ratio</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white shadow-sm border border-blue-200 rounded-lg p-5">
            <h3 className="font-bold text-blue-900 text-center mb-4">Pass vs Fail Comparison</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[{ name: "Students", Pass: passedStudents, Fail: failedStudents }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Pass" fill="#1e40af" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Fail" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white shadow-sm border border-blue-200 rounded-lg p-5 lg:col-span-2">
            <h3 className="font-bold text-blue-900 text-center mb-4">CLO Attainment (%)</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="clo" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="percentage" stroke="#1e40af" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OBEReport;