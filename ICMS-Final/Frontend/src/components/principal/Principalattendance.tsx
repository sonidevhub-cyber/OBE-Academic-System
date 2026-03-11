import React, { useEffect, useState } from "react";

interface DepartmentAttendanceSummary {
  id: number;
  department: string;
  semesterCount: number;
  totalInstructors: number;
  avgAttendance: number;
  totalShortageCases: number;
  redFlagInstructors: number;
  status: "submitted" | "reviewed";
  hodSubmittedBy: string;
  lastUpdated: string;
}

const PrincipalDepartmentWiseAttendance: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentAttendanceSummary[]>([]);
  const [selectedDept, setSelectedDept] =
    useState<DepartmentAttendanceSummary | null>(null);

  // Dummy HOD-forwarded analytics (replace later with API)
  useEffect(() => {
    setDepartments([
      {
        id: 1,
        department: "BS Information Technology",
        semesterCount: 8,
        totalInstructors: 22,
        avgAttendance: 86,
        totalShortageCases: 15,
        redFlagInstructors: 3,
        status: "submitted",
        hodSubmittedBy: "HOD — IT",
        lastUpdated: "30 Dec 2025",
      },
      {
        id: 2,
        department: "Software Engineering",
        semesterCount: 8,
        totalInstructors: 18,
        avgAttendance: 91,
        totalShortageCases: 6,
        redFlagInstructors: 1,
        status: "reviewed",
        hodSubmittedBy: "HOD — SE",
        lastUpdated: "29 Dec 2025",
      },
      {
        id: 3,
        department: "Computer Science",
        semesterCount: 8,
        totalInstructors: 25,
        avgAttendance: 88,
        totalShortageCases: 9,
        redFlagInstructors: 2,
        status: "submitted",
        hodSubmittedBy: "HOD — CS",
        lastUpdated: "29 Dec 2025",
      },
    ]);
  }, []);

  return (
    <div className="p-6 space-y-3">
      <h2 className="text-2xl font-bold">
        Department-wise Attendance — Principal Governance View
      </h2>

      <p className="text-sm opacity-70">
        📌 Data Source: <b>HOD Verified & Forwarded Consolidated Attendance Reports</b>
        &nbsp;(Student-level data hidden for privacy)
      </p>

      {/* Department Table */}
      <div className="mt-3 border rounded-2xl p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-semibold border-b">
              <th className="p-2 text-left">Department</th>
              <th className="p-2 text-center">Semesters</th>
              <th className="p-2 text-center">Instructors</th>
              <th className="p-2 text-center">Avg Attendance %</th>
              <th className="p-2 text-center">Shortage Cases</th>
              <th className="p-2 text-center">Red-Flag Instructors</th>
              <th className="p-2 text-center">Status</th>
              <th className="p-2 text-center">View</th>
            </tr>
          </thead>

          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="p-2">{d.department}</td>

                <td className="p-2 text-center">{d.semesterCount}</td>

                <td className="p-2 text-center">{d.totalInstructors}</td>

                <td className="p-2 text-center font-semibold">
                  {d.avgAttendance}%
                </td>

                <td className="p-2 text-center">{d.totalShortageCases}</td>

                <td className="p-2 text-center">
                  {d.redFlagInstructors > 0 ? (
                    <span className="px-2 py-1 rounded-xl bg-red-200">
                      {d.redFlagInstructors}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-xl bg-green-200">
                      0
                    </span>
                  )}
                </td>

                <td className="p-2 text-center">
                  {d.status === "submitted" ? (
                    <span className="px-2 py-1 rounded-xl bg-yellow-200">
                      Submitted
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-xl bg-blue-200">
                      Reviewed
                    </span>
                  )}
                </td>

                <td className="p-2 text-center">
                  <button
                    onClick={() => setSelectedDept(d)}
                    className="px-3 py-1 rounded-xl border"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Department Detail Drawer */}
      {selectedDept && (
        <div className="mt-4 p-4 border rounded-2xl space-y-2">
          <h3 className="text-lg font-bold">
            Department Summary — {selectedDept.department}
          </h3>

          <p>
            <b>Semesters:</b> {selectedDept.semesterCount}
          </p>

          <p>
            <b>Total Instructors:</b> {selectedDept.totalInstructors}
          </p>

          <p>
            <b>Average Attendance:</b> {selectedDept.avgAttendance}%
          </p>

          <p>
            <b>Total Shortage Cases:</b> {selectedDept.totalShortageCases}
          </p>

          <p>
            <b>Red-Flag Instructors:</b> {selectedDept.redFlagInstructors}
          </p>

          <p>
            <b>Submitted By:</b> {selectedDept.hodSubmittedBy}
          </p>

          <p>
            <b>Last Updated:</b> {selectedDept.lastUpdated}
          </p>

          <p className="text-xs opacity-70 mt-1">
            ⚠ Principal view is read-only — detailed attendance & student records remain under HOD
            authority.
          </p>

          <button
            onClick={() => setSelectedDept(null)}
            className="mt-2 px-4 py-2 rounded-xl border"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default PrincipalDepartmentWiseAttendance;