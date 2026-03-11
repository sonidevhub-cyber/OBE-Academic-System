import React, { useEffect, useState } from "react";
import { Inbox, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Complaint {
  id: number;
  submittedBy: string;
  role: string;
  department: string;
  category: string;
  description: string;
  status: string;
  submittedOn: string;
}

const DUMMY_COMPLAINTS: Complaint[] = [
  {
    id: 1,
    submittedBy: "Dr. Ayesha Khan",
    role: "HOD",
    department: "Computer Science",
    category: "Faculty Coordination Issue",
    description:
      "Department timetable conflict between two sections — request review & restructuring.",
    status: "Pending",
    submittedOn: "2026-01-01",
  },
  {
    id: 2,
    submittedBy: "Sir Ahmed Raza",
    role: "Instructor",
    department: "Software Engineering",
    category: "Lab Resource Complaint",
    description:
      "Required lab systems are outdated & affecting CLO assessment execution.",
    status: "Resolved",
    submittedOn: "2025-12-30",
  },
  {
    id: 3,
    submittedBy: "Coordinator Samina",
    role: "Coordinator",
    department: "IT",
    category: "Assessment Submission Delay",
    description:
      "Multiple instructors delayed mid-term assessment submission — disciplinary review requested.",
    status: "Pending",
    submittedOn: "2025-12-28",
  },
];

export default function PrincipalComplaintsInbox() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComplaints() {
      try {
        const res = await fetch("/api/complaints/principal");
        const data = await res.json();

        // If backend returns empty → show dummy data instead
        if (!data || data.length === 0) {
          setComplaints(DUMMY_COMPLAINTS);
        } else {
          setComplaints(data);
        }
      } catch {
        // If API fails → still show dummy complaints
        setComplaints(DUMMY_COMPLAINTS);
      }

      setLoading(false);
    }

    loadComplaints();
  }, []);

  return (
    <div className="bg-white rounded-3xl shadow-xl border p-6 space-y-4">

      <h2 className="text-2xl font-bold text-gray-800 flex gap-2 items-center">
        <Inbox /> Principal Complaint Governance Panel
      </h2>

      <p className="text-gray-600">
        Centralized complaint desk for <b>Instructor • HOD • Coordinator</b>
      </p>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {complaints.map((c) => {
          const isOpen = expanded === c.id;

          return (
            <motion.div
              key={c.id}
              layout
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25 }}
              className="border rounded-2xl shadow-sm p-4 bg-gradient-to-b from-white to-gray-50"
            >
              <div className="flex justify-between items-center">

                <div>
                  <p className="font-semibold text-gray-800">
                    {c.category} — {c.department}
                  </p>

                  <p className="text-sm text-gray-600">
                    {c.submittedBy} ({c.role})
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium
                    ${c.status === "Resolved"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {c.status}
                  </span>

                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-100 flex gap-1 items-center"
                  >
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                    Details
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mt-3 pl-1"
                  >
                    <p className="text-gray-700 leading-relaxed">
                      {c.description}
                    </p>

                    <p className="text-sm text-gray-500 mt-2">
                      Submitted on: {c.submittedOn}
                    </p>

                    <div className="flex gap-3 mt-3">
                      <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white flex gap-1">
                        <Eye size={16} /> View Case File
                      </button>

                      {c.status !== "Resolved" && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-2 rounded-xl bg-green-600 text-white flex gap-1"
                        >
                          <CheckCircle2 size={16} /> Mark as Resolved
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}