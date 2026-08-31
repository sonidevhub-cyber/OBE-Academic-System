import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/api";
import {
  BookOpen,
  Download,
  FileText,
  LayoutDashboard,
  GraduationCap,
  TrendingUp,
  Award,
} from "lucide-react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Assessment {
  id?: string | number;
  title?: string;
  type?: string;
  obtained?: number;
  total?: number;
  semester?: {
    name?: string;
  } | string;
  course?: {
    name?: string;
    id?: string;
  } | string;
}

interface StudentResult {
  percentage?: number | string;
  total?: number;
  gpa?: number | string;
  status?: string;
  assessments?: Assessment[];
}

interface CourseResult {
  courseName: string;
  assessments: Assessment[];
}

const StudentResults: React.FC = () => {
  const [result, setResult] = useState<StudentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState<string>("");

  // =========================================================
  // FETCH RESULTS
  // =========================================================
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);

        const res = await api.get("/assessments/student/result/");

        console.log("Student Results API:", res.data);

        setResult(res.data);
      } catch (error) {
        console.error("Error fetching student results:", error);
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  // =========================================================
  // SEMESTERS
  // =========================================================
  const semesters = useMemo(() => {
    if (!result?.assessments?.length) {
      return [];
    }

    const semesterSet = new Set<string>();

    result.assessments.forEach((assessment) => {
      const semester =
        typeof assessment.semester === "object"
          ? assessment.semester?.name
          : assessment.semester;

      if (semester) {
        semesterSet.add(String(semester));
      }
    });

    return Array.from(semesterSet);
  }, [result]);

  // =========================================================
  // DEFAULT SEMESTER
  // =========================================================
  useEffect(() => {
    if (semesters.length > 0 && !selectedSemester) {
      setSelectedSemester(semesters[0]);
    }
  }, [semesters, selectedSemester]);

  // =========================================================
  // FILTER BY SEMESTER
  // =========================================================
  const filteredAssessments = useMemo(() => {
    if (!result?.assessments) {
      return [];
    }

    if (!selectedSemester) {
      return result.assessments;
    }

    return result.assessments.filter((assessment) => {
      const semester =
        typeof assessment.semester === "object"
          ? assessment.semester?.name
          : assessment.semester;

      return String(semester || "") === selectedSemester;
    });
  }, [result, selectedSemester]);

  // =========================================================
  // GROUP COURSES
  // =========================================================
  const courseResults = useMemo<CourseResult[]>(() => {
    const groups: Record<string, Assessment[]> = {};

    filteredAssessments.forEach((assessment) => {
      const courseName =
        typeof assessment.course === "object"
          ? assessment.course?.name
          : assessment.course;

      const name = courseName || "Other";

      if (!groups[name]) {
        groups[name] = [];
      }

      groups[name].push(assessment);
    });

    return Object.entries(groups).map(([courseName, assessments]) => ({
      courseName,
      assessments,
    }));
  }, [filteredAssessments]);

  // =========================================================
  // SEMESTER STATISTICS
  // =========================================================
  const semesterStats = useMemo(() => {
    let totalMarks = 0;
    let obtainedMarks = 0;

    filteredAssessments.forEach((assessment) => {
      totalMarks += Number(assessment.total || 0);
      obtainedMarks += Number(assessment.obtained || 0);
    });

    const percentage =
      totalMarks > 0
        ? ((obtainedMarks / totalMarks) * 100).toFixed(1)
        : "0.0";

    return {
      totalMarks,
      obtainedMarks,
      percentage,
    };
  }, [filteredAssessments]);

  // =========================================================
  // COURSE STATISTICS
  // =========================================================
  const getCourseStats = (assessments: Assessment[]) => {
    const total = assessments.reduce(
      (sum, assessment) => sum + Number(assessment.total || 0),
      0
    );

    const obtained = assessments.reduce(
      (sum, assessment) => sum + Number(assessment.obtained || 0),
      0
    );

    const percentage =
      total > 0 ? ((obtained / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      obtained,
      percentage,
    };
  };

  // =========================================================
  // PDF DOWNLOAD
  // =========================================================
  const downloadPDF = () => {
    if (!filteredAssessments.length) {
      return;
    }

    try {
      setDownloading(true);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      let currentPage = 1;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // =====================================================
      // REPORT HEADER
      // =====================================================

      doc.setFillColor(5, 150, 105);

      doc.rect(0, 0, pageWidth, 32, "F");

      doc.setTextColor(255, 255, 255);

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");

      doc.text(
        "STUDENT ACADEMIC RESULT REPORT",
        pageWidth / 2,
        13,
        {
          align: "center",
        }
      );

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      doc.text(
        selectedSemester
          ? `Semester: ${selectedSemester}`
          : "Academic Result",
        pageWidth / 2,
        22,
        {
          align: "center",
        }
      );

      // =====================================================
      // SUMMARY
      // =====================================================

      const summaryY = 42;

      doc.setTextColor(31, 41, 55);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");

      doc.text("Overall Performance", 14, summaryY);

      doc.setFont("helvetica", "normal");

      doc.text(
        `Obtained Marks: ${semesterStats.obtainedMarks} / ${semesterStats.totalMarks}`,
        14,
        summaryY + 8
      );

      doc.text(
        `Overall Percentage: ${semesterStats.percentage}%`,
        14,
        summaryY + 15
      );

      doc.text(
        `Total Assessments: ${filteredAssessments.length}`,
        14,
        summaryY + 22
      );

      doc.text(
        `Total Courses: ${courseResults.length}`,
        14,
        summaryY + 29
      );

      if (result?.gpa !== undefined && result?.gpa !== null) {
        doc.text(
          `GPA: ${result.gpa}`,
          pageWidth - 80,
          summaryY + 8
        );
      }

      if (result?.status) {
        doc.text(
          `Status: ${result.status}`,
          pageWidth - 80,
          summaryY + 15
        );
      }

      // =====================================================
      // COURSE SUMMARY TABLE
      // =====================================================

      const courseTableRows = courseResults.map((course) => {
        const stats = getCourseStats(course.assessments);

        return [
          course.courseName,
          course.assessments.length,
          stats.obtained,
          stats.total,
          `${stats.percentage}%`,
        ];
      });

      autoTable(doc, {
        startY: 78,

        head: [
          [
            "Course",
            "Assessments",
            "Obtained",
            "Total",
            "Percentage",
          ],
        ],

        body: courseTableRows,

        theme: "grid",

        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },

        bodyStyles: {
          textColor: [31, 41, 55],
          fontSize: 9,
        },

        alternateRowStyles: {
          fillColor: [240, 253, 250],
        },

        columnStyles: {
          0: {
            cellWidth: 85,
          },

          1: {
            halign: "center",
            cellWidth: 30,
          },

          2: {
            halign: "center",
            cellWidth: 30,
          },

          3: {
            halign: "center",
            cellWidth: 30,
          },

          4: {
            halign: "center",
            cellWidth: 35,
          },
        },

        margin: {
          left: 14,
          right: 14,
        },
      });

      // =====================================================
      // ASSESSMENT DETAIL
      // =====================================================

      const finalY =
        (doc as any).lastAutoTable?.finalY || 100;

      let detailStartY = finalY + 15;

      /*
       * If the course table has consumed the page,
       * start the assessment section on a new page.
       */
      if (detailStartY > pageHeight - 30) {
        doc.addPage();
        detailStartY = 20;
      }

      doc.setTextColor(31, 41, 55);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");

      doc.text("Assessment Details", 14, detailStartY);

      detailStartY += 6;

      // =====================================================
      // ASSESSMENT ROWS
      // =====================================================

      const assessmentRows = filteredAssessments.map(
        (assessment) => {
          const obtained = Number(assessment.obtained || 0);

          const total = Number(assessment.total || 0);

          const percentage =
            total > 0
              ? ((obtained / total) * 100).toFixed(1)
              : "0.0";

          const courseName =
            typeof assessment.course === "object"
              ? assessment.course?.name
              : assessment.course;

          const assessmentType = assessment.type
            ? assessment.type.charAt(0).toUpperCase() +
              assessment.type.slice(1)
            : "-";

          return [
            courseName || "Other",
            assessment.title || "-",
            assessmentType,
            obtained,
            total,
            `${percentage}%`,
          ];
        }
      );

      // =====================================================
      // ASSESSMENT TABLE
      // =====================================================

      autoTable(doc, {
        startY: detailStartY,

        head: [
          [
            "Course",
            "Assessment",
            "Type",
            "Obtained",
            "Total",
            "Percentage",
          ],
        ],

        body: assessmentRows,

        theme: "grid",

        headStyles: {
          fillColor: [13, 148, 136],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },

        bodyStyles: {
          fontSize: 8,
          textColor: [31, 41, 55],
        },

        alternateRowStyles: {
          fillColor: [240, 253, 250],
        },

        columnStyles: {
          0: {
            cellWidth: 55,
          },

          1: {
            cellWidth: 80,
          },

          2: {
            cellWidth: 35,
          },

          3: {
            cellWidth: 25,
            halign: "center",
          },

          4: {
            cellWidth: 25,
            halign: "center",
          },

          5: {
            cellWidth: 30,
            halign: "center",
          },
        },

        margin: {
          left: 14,
          right: 14,
          bottom: 15,
        },

        /*
         * IMPORTANT:
         * jspdf-autotable provides pageNumber through data.
         * This fixes:
         * TS2339 Property 'getNumberOfPages'...
         * and
         * TS2304 Cannot find name 'pageNumber'
         */
        didDrawPage: () => {
  const pageHeight =
    doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  doc.setTextColor(107, 114, 128);

  doc.text(
    `Student Academic Result Report • ${
      selectedSemester || "All Semesters"
    }`,
    14,
    pageHeight - 8
  );

  doc.text(
    `Page ${currentPage}`,
    pageWidth - 14,
    pageHeight - 8,
    {
      align: "right",
    }
  );

  currentPage++;
},
      });

      // =====================================================
      // FINAL REPORT FOOTER
      // =====================================================

      // =====================================================
// ADD FOOTER TO ALL GENERATED PAGES
// =====================================================

const pageCount =
  (doc.internal as any).getNumberOfPages
    ? (doc.internal as any).getNumberOfPages()
    : 1;

for (let page = 1; page <= pageCount; page++) {
  doc.setPage(page);

  const pageHeight =
    doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  doc.setTextColor(107, 114, 128);

  doc.text(
    `Student Academic Result Report • ${
      selectedSemester || "All Semesters"
    }`,
    14,
    pageHeight - 8
  );

  doc.text(
    `Page ${page} of ${pageCount}`,
    pageWidth - 14,
    pageHeight - 8,
    {
      align: "right",
    }
  );
}

      // =====================================================
      // FILE NAME
      // =====================================================

      const safeSemester = selectedSemester
        ? selectedSemester.replace(
            /[^a-zA-Z0-9-_]/g,
            "_"
          )
        : "All";

      doc.save(
        `Student_Result_${safeSemester}.pdf`
      );
    } catch (error) {
      console.error(
        "PDF generation error:",
        error
      );

      alert(
        "Unable to generate PDF report."
      );
    } finally {
      setDownloading(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">

          <div
            className="
              animate-spin
              rounded-full
              h-12 w-12
              border-4
              border-emerald-100
              border-t-emerald-600
            "
          />

          <p className="text-sm text-gray-500">
            Loading your academic report...
          </p>

        </div>
      </div>
    );
  }

  // =========================================================
  // NO RESULTS
  // =========================================================

  if (!result?.assessments?.length) {
    return (
      <div
        className="
          bg-white
          rounded-2xl
          border border-emerald-100
          shadow-sm
          p-12
          text-center
        "
      >

        <div
          className="
            w-16 h-16
            rounded-2xl
            bg-emerald-50
            text-emerald-500
            flex items-center justify-center
            mx-auto mb-4
          "
        >
          <FileText className="w-8 h-8" />
        </div>

        <p className="text-lg font-semibold text-gray-700">
          No results available
        </p>

        <p className="text-sm text-gray-500 mt-1">
          Your assessment results will appear here.
        </p>

      </div>
    );
  }

  // =========================================================
  // MAIN REPORT
  // =========================================================

  return (
    <div className="space-y-6">

      {/* =====================================================
          REPORT HEADER
      ===================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="
          bg-gradient-to-r
          from-emerald-600
          via-teal-600
          to-green-600
          rounded-2xl
          p-6
          text-white
          shadow-lg
        "
      >

        <div
          className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            justify-between
            gap-5
          "
        >

          <div className="flex items-center gap-4">

            <div
              className="
                w-14 h-14
                rounded-2xl
                bg-white/15
                border border-white/20
                flex items-center justify-center
              "
            >
              <GraduationCap className="w-8 h-8" />
            </div>

            <div>

              <p
                className="
                  text-emerald-100
                  text-xs
                  font-semibold
                  uppercase
                  tracking-widest
                "
              >
                Academic Performance
              </p>

              <h2 className="text-2xl font-bold mt-1">
                Student Result Report
              </h2>

              {selectedSemester && (
                <p className="text-emerald-100 text-sm mt-1">
                  {selectedSemester}
                </p>
              )}

            </div>

          </div>

          <button
            type="button"
            onClick={downloadPDF}
            disabled={
              downloading ||
              !filteredAssessments.length
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              px-5
              py-3
              rounded-xl
              bg-white
              text-emerald-700
              font-semibold
              shadow-sm
              hover:bg-emerald-50
              disabled:opacity-60
              disabled:cursor-not-allowed
              transition-all
            "
          >

            <Download className="w-5 h-5" />

            {downloading
              ? "Generating PDF..."
              : "Download PDF"}

          </button>

        </div>

      </motion.div>

      {/* =====================================================
          SEMESTER FILTER
      ===================================================== */}

      {semesters.length > 0 && (
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            bg-white
            rounded-2xl
            border border-emerald-100
            shadow-sm
            p-5
          "
        >

          <div
            className="
              flex
              flex-col
              md:flex-row
              md:items-center
              gap-4
            "
          >

            <div className="flex items-center gap-3 min-w-[180px]">

              <div
                className="
                  w-10 h-10
                  rounded-xl
                  bg-emerald-50
                  text-emerald-600
                  flex items-center justify-center
                "
              >
                <BookOpen className="w-5 h-5" />
              </div>

              <div>

                <p className="text-sm font-semibold text-gray-800">
                  Semester
                </p>

                <p className="text-xs text-gray-500">
                  Select report period
                </p>

              </div>

            </div>

            <select
              value={selectedSemester}
              onChange={(e) =>
                setSelectedSemester(
                  e.target.value
                )
              }
              className="
                flex-1
                px-4
                py-3
                bg-emerald-50/50
                border border-emerald-100
                rounded-xl
                text-gray-800
                font-medium
                focus:outline-none
                focus:ring-2
                focus:ring-emerald-500/20
                focus:border-emerald-500
              "
            >

              {semesters.map((semester) => (
                <option
                  key={semester}
                  value={semester}
                >
                  {semester}
                </option>
              ))}

            </select>

          </div>

        </motion.div>
      )}

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-4
          gap-5
        "
      >

        {/* MARKS */}

        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="
            bg-white
            rounded-2xl
            border border-emerald-100
            shadow-sm
            p-5
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p
                className="
                  text-xs
                  font-semibold
                  text-gray-500
                  uppercase
                  tracking-wider
                "
              >
                Marks
              </p>

              <p className="text-2xl font-bold text-gray-900 mt-2">

                {semesterStats.obtainedMarks}

                <span className="text-base text-gray-400">
                  /{semesterStats.totalMarks}
                </span>

              </p>

            </div>

            <div
              className="
                p-3
                rounded-xl
                bg-emerald-50
                text-emerald-600
              "
            >
              <FileText className="w-6 h-6" />
            </div>

          </div>

        </motion.div>

        {/* PERCENTAGE */}

        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.05,
          }}
          className="
            bg-white
            rounded-2xl
            border border-teal-100
            shadow-sm
            p-5
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p
                className="
                  text-xs
                  font-semibold
                  text-gray-500
                  uppercase
                  tracking-wider
                "
              >
                Percentage
              </p>

              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {semesterStats.percentage}%
              </p>

            </div>

            <div
              className="
                p-3
                rounded-xl
                bg-teal-50
                text-teal-600
              "
            >
              <TrendingUp className="w-6 h-6" />
            </div>

          </div>

        </motion.div>

        {/* COURSES */}

        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.1,
          }}
          className="
            bg-white
            rounded-2xl
            border border-green-100
            shadow-sm
            p-5
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p
                className="
                  text-xs
                  font-semibold
                  text-gray-500
                  uppercase
                  tracking-wider
                "
              >
                Courses
              </p>

              <p className="text-2xl font-bold text-gray-900 mt-2">
                {courseResults.length}
              </p>

            </div>

            <div
              className="
                p-3
                rounded-xl
                bg-green-50
                text-green-600
              "
            >
              <BookOpen className="w-6 h-6" />
            </div>

          </div>

        </motion.div>

        {/* GPA */}

        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.15,
          }}
          className="
            bg-white
            rounded-2xl
            border border-lime-100
            shadow-sm
            p-5
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <p
                className="
                  text-xs
                  font-semibold
                  text-gray-500
                  uppercase
                  tracking-wider
                "
              >
                GPA
              </p>

              <p className="text-2xl font-bold text-gray-900 mt-2">
                {result?.gpa ?? "-"}
              </p>

            </div>

            <div
              className="
                p-3
                rounded-xl
                bg-lime-50
                text-lime-600
              "
            >
              <Award className="w-6 h-6" />
            </div>

          </div>

        </motion.div>

      </div>

      {/* =====================================================
          COMPLETE REPORT TABLE
      ===================================================== */}

      <motion.section
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="
          bg-white
          rounded-2xl
          border border-emerald-100
          shadow-sm
          overflow-hidden
        "
      >

        {/* REPORT TITLE */}

        <div
          className="
            px-6
            py-5
            bg-emerald-50/70
            border-b border-emerald-100
          "
        >

          <div className="flex items-center justify-between">

            <div>

              <h3
                className="
                  text-xl
                  font-bold
                  text-gray-800
                  flex
                  items-center
                  gap-2
                "
              >
                <LayoutDashboard className="w-5 h-5 text-emerald-600" />
                Complete Academic Report
              </h3>

              <p className="text-sm text-gray-500 mt-1">
                Course-wise and assessment-wise performance
              </p>

            </div>

            <span
              className="
                px-3
                py-1.5
                rounded-full
                bg-emerald-100
                text-emerald-700
                text-xs
                font-semibold
              "
            >
              {selectedSemester || "All Semesters"}
            </span>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse">

            <thead>

              <tr
                className="
                  bg-emerald-600
                  text-white
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wider
                "
              >

                <th className="px-5 py-4">
                  #
                </th>

                <th className="px-5 py-4">
                  Course
                </th>

                <th className="px-5 py-4">
                  Assessment
                </th>

                <th className="px-5 py-4">
                  Type
                </th>

                <th className="px-5 py-4 text-center">
                  Obtained
                </th>

                <th className="px-5 py-4 text-center">
                  Total
                </th>

                <th className="px-5 py-4 text-center">
                  Percentage
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-emerald-50">

              {courseResults.map(
                (course, courseIndex) => {

                  const stats =
                    getCourseStats(
                      course.assessments
                    );

                  return (
                    <React.Fragment
                      key={course.courseName}
                    >

                      {/* COURSE SUMMARY */}

                      <tr className="bg-emerald-50/60">

                        <td
                          className="
                            px-5
                            py-4
                            font-bold
                            text-emerald-700
                          "
                        >
                          {courseIndex + 1}
                        </td>

                        <td
                          colSpan={3}
                          className="px-5 py-4"
                        >

                          <div>

                            <p className="font-bold text-gray-800">
                              {course.courseName}
                            </p>

                            <p className="text-xs text-gray-500 mt-0.5">
                              {course.assessments.length}{" "}
                              {course.assessments.length === 1
                                ? "assessment"
                                : "assessments"}
                            </p>

                          </div>

                        </td>

                        <td
                          className="
                            px-5
                            py-4
                            text-center
                            font-bold
                            text-gray-800
                          "
                        >
                          {stats.obtained}
                        </td>

                        <td
                          className="
                            px-5
                            py-4
                            text-center
                            font-semibold
                            text-gray-500
                          "
                        >
                          {stats.total}
                        </td>

                        <td className="px-5 py-4 text-center">

                          <span
                            className={`
                              inline-flex
                              px-3
                              py-1
                              rounded-full
                              text-xs
                              font-bold
                              ${
                                Number(
                                  stats.percentage
                                ) >= 70
                                  ? "bg-emerald-100 text-emerald-700"
                                  : Number(
                                      stats.percentage
                                    ) >= 40
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }
                            `}
                          >
                            {stats.percentage}%
                          </span>

                        </td>

                      </tr>

                      {/* ASSESSMENTS */}

                      {course.assessments.map(
                        (
                          assessment,
                          assessmentIndex
                        ) => {

                          const obtained =
                            Number(
                              assessment.obtained || 0
                            );

                          const total =
                            Number(
                              assessment.total || 0
                            );

                          const percentage =
                            total > 0
                              ? (
                                  (obtained /
                                    total) *
                                  100
                                ).toFixed(1)
                              : "0.0";

                          return (
                            <tr
                              key={
                                assessment.id ||
                                `${courseIndex}-${assessmentIndex}`
                              }
                              className="
                                hover:bg-emerald-50/30
                                transition-colors
                              "
                            >

                              <td className="px-5 py-4 text-sm text-gray-400">
                                {courseIndex + 1}.
                                {assessmentIndex + 1}
                              </td>

                              <td className="px-5 py-4 text-sm text-gray-500">
                                —
                              </td>

                              <td className="px-5 py-4">

                                <p className="font-medium text-gray-800">
                                  {assessment.title || "-"}
                                </p>

                              </td>

                              <td className="px-5 py-4">

                                <span
                                  className="
                                    inline-flex
                                    px-2.5
                                    py-1
                                    rounded-full
                                    bg-gray-100
                                    text-gray-600
                                    text-xs
                                    font-semibold
                                    capitalize
                                  "
                                >
                                  {assessment.type || "-"}
                                </span>

                              </td>

                              <td
                                className="
                                  px-5
                                  py-4
                                  text-center
                                  font-semibold
                                  text-gray-800
                                "
                              >
                                {obtained}
                              </td>

                              <td
                                className="
                                  px-5
                                  py-4
                                  text-center
                                  text-gray-500
                                "
                              >
                                {total}
                              </td>

                              <td className="px-5 py-4 text-center">

                                <span
                                  className={`
                                    font-semibold
                                    ${
                                      Number(
                                        percentage
                                      ) >= 70
                                        ? "text-emerald-600"
                                        : Number(
                                            percentage
                                          ) >= 40
                                        ? "text-amber-600"
                                        : "text-red-600"
                                    }
                                  `}
                                >
                                  {percentage}%
                                </span>

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </React.Fragment>
                  );
                }
              )}

            </tbody>

            {/* =================================================
                TABLE FOOTER
            ================================================= */}

            <tfoot>

              <tr className="bg-gray-800 text-white">

                <td
                  colSpan={4}
                  className="
                    px-5
                    py-4
                    font-bold
                  "
                >
                  Semester Total
                </td>

                <td
                  className="
                    px-5
                    py-4
                    text-center
                    font-bold
                  "
                >
                  {semesterStats.obtainedMarks}
                </td>

                <td
                  className="
                    px-5
                    py-4
                    text-center
                    font-bold
                  "
                >
                  {semesterStats.totalMarks}
                </td>

                <td
                  className="
                    px-5
                    py-4
                    text-center
                  "
                >

                  <span className="font-bold text-emerald-300">
                    {semesterStats.percentage}%
                  </span>

                </td>

              </tr>

            </tfoot>

          </table>

        </div>

      </motion.section>

      {/* =====================================================
          REPORT FOOTNOTE
      ===================================================== */}

      <div
        className="
          flex
          flex-col
          sm:flex-row
          justify-between
          items-start
          sm:items-center
          gap-3
          px-2
          text-xs
          text-gray-500
        "
      >

        <p>
          This report contains your assessment
          performance for the selected semester.
        </p>

        <button
          type="button"
          onClick={downloadPDF}
          disabled={downloading}
          className="
            inline-flex
            items-center
            gap-2
            text-emerald-700
            hover:text-emerald-800
            font-semibold
            disabled:opacity-50
          "
        >

          <Download className="w-4 h-4" />

          {downloading
            ? "Generating..."
            : "Download PDF Report"}

        </button>

      </div>

    </div>
  );
};

export default StudentResults;