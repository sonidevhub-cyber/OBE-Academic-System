import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  AcademicCapIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/solid";

/* =======================
   TYPES
======================= */
type Department = {
  title: string;
  icon: React.ElementType;
  desc: string;
  semesters: string[];
  pdf: string; // scheme of study pdf
};

type Faculty = {
  name: string;
  departments: Department[];
};

/* =======================
   DATA (FACULTY WISE)
======================= */
const faculties: Faculty[] = [
  {
    name: "Faculty of Science",
    departments: [
      {
        title: "Information Technology (BS-IT)",
        icon: AcademicCapIcon,
        desc: "Computing, software development and information systems.",
        semesters: [
          "Semester 1: Programming Fundamentals, ICT",
          "Semester 2: OOP, Database Systems",
          "Semester 3: Data Structures, Operating Systems",
          "Semester 4: Web Development, Software Engineering",
          "Semester 5–8: Specialization, Internship, FYP",
        ],
        pdf: "/pdfs/bs-it-scheme.pdf",
      },
      {
        title: "Mathematics (BS)",
        icon: AcademicCapIcon,
        desc: "Pure and applied mathematics with analytical problem-solving.",
        semesters: [
          "Semester 1–2: Calculus, Linear Algebra",
          "Semester 3–4: Probability, Differential Equations",
          "Semester 5–8: Numerical Analysis, Research Project",
        ],
        pdf: "/pdfs/bs-maths-scheme.pdf",
      },
      {
        title: "Botany (BS)",
        icon: ComputerDesktopIcon,
        desc: "Plant sciences, biodiversity and biological research.",
        semesters: [
          "Semester 1–2: Cell Biology, Diversity of Plants",
          "Semester 3–4: Plant Anatomy, Genetics",
          "Semester 5–8: Ecology, Research Project",
        ],
        pdf: "/pdfs/bs-botany-scheme.pdf",
      },
    ],
  },
  {
    name: "Faculty of Arts",
    departments: [
      {
        title: "Islamic Studies (BS)",
        icon: AcademicCapIcon,
        desc: "Islamic education, jurisprudence and research studies.",
        semesters: [
          "Semester 1–2: Quran & Hadith Studies",
          "Semester 3–4: Islamic Jurisprudence",
          "Semester 5–8: Research & Special Topics",
        ],
        pdf: "/pdfs/bs-islamic-studies.pdf",
      },
      {
        title: "Health & Physical Education (BS-HPE)",
        icon: AcademicCapIcon,
        desc: "Physical fitness, sports sciences and health education.",
        semesters: [
          "Semester 1–2: Foundations of Physical Education",
          "Semester 3–4: Sports Psychology, Anatomy",
          "Semester 5–8: Coaching, Internship, Research",
        ],
        pdf: "/pdfs/bs-hpe-scheme.pdf",
      },
    ],
  },
  {
    name: "Faculty of Social Sciences",
    departments: [
      {
        title: "Psychology (BS)",
        icon: CpuChipIcon,
        desc: "Study of human behavior, cognition and mental processes.",
        semesters: [
          "Semester 1–2: Introduction to Psychology",
          "Semester 3–4: Developmental & Cognitive Psychology",
          "Semester 5–8: Clinical Psychology, Research Work",
        ],
        pdf: "/pdfs/bs-psychology-scheme.pdf",
      },
      {
        title: "Economics (BS)",
        icon: AcademicCapIcon,
        desc: "Microeconomics, macroeconomics and economic policy studies.",
        semesters: [
          "Semester 1–2: Principles of Economics",
          "Semester 3–4: Micro & Macro Economics",
          "Semester 5–8: Econometrics, Research Project",
        ],
        pdf: "/pdfs/bs-economics-scheme.pdf",
      },
    ],
  },
];

/* =======================
   COMPONENT
======================= */
export default function Departments() {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  return (
    <div className="max-w-6xl mx-auto">
      <motion.h2
        className="text-3xl md:text-4xl font-bold text-[#5b2fc1] mb-10"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        Faculties & Departments
      </motion.h2>

      {/* FACULTY LOOP */}
      {faculties.map((faculty, fIdx) => (
        <div key={fIdx} className="mb-14">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">
            {faculty.name}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {faculty.departments.map((dept, idx) => {
              const Icon = dept.icon;

              return (
                <motion.div
                  key={idx}
                  onClick={() => setSelectedDept(dept)}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-xl p-6 shadow-md 
                  border border-transparent hover:border-[#5b2fc1]/40 
                  transition-all duration-300 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-lg bg-[#f3ecff]">
                      <Icon className="w-8 h-8 text-[#5b2fc1]" />
                    </div>

                    <div>
                      <h4 className="font-semibold text-lg text-gray-900">
                        {dept.title}
                      </h4>
                      <p className="text-sm text-gray-600">{dept.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* SELECTED DEPARTMENT DETAILS */}
      {selectedDept && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 bg-gray-50 border rounded-xl p-8"
        >
          <h3 className="text-2xl font-semibold text-[#5b2fc1] mb-2">
            {selectedDept.title}
          </h3>

          <p className="text-gray-700 mb-4">
            {selectedDept.desc}
          </p>

          <h4 className="font-semibold text-lg mb-2">
            Program Structure (Semester-wise)
          </h4>

          <ul className="list-disc list-inside space-y-1 text-gray-700 mb-6">
            {selectedDept.semesters.map((sem, i) => (
              <li key={i}>{sem}</li>
            ))}
          </ul>

          {/* PDF DOWNLOAD */}
          <a
            href={selectedDept.pdf}
            download
            className="inline-flex items-center gap-2 
            bg-[#1C63D5] text-white px-5 py-2 
            rounded-md shadow hover:bg-[#154bb0] transition"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download Scheme of Study (PDF)
          </a>
        </motion.div>
      )}
    </div>
  );
}