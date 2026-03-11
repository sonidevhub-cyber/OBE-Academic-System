import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdmissionsSection() {
  const [open, setOpen] = useState<number | null>(null);

  const items = [
    {
      id: 1,
      title: "Admission Information",
      content: (
        <ul className="list-disc pl-5 space-y-2">
          <li>Admissions open once a year for undergraduate programs.</li>
          <li>Eligibility based on intermediate results and entry test.</li>
          <li>Merit lists are published on the official website.</li>
          <li>Selected candidates are notified via email/SMS.</li>
        </ul>
      ),
    },
    {
      id: 2,
      title: "How to Apply (Step-by-Step)",
      content: (
        <ol className="list-decimal pl-5 space-y-2">
          <li>Visit the official admissions portal.</li>
          <li>Create your applicant account.</li>
          <li>Fill out the online application form.</li>
          <li>Upload required documents.</li>
          <li>Submit the application and download the challan.</li>
          <li>Appear in entry test (if applicable).</li>
        </ol>
      ),
    },
    {
      id: 3,
      title: "Required Documents",
      content: (
        <ul className="list-disc pl-5 space-y-2">
          <li>Matric & Intermediate certificates</li>
          <li>CNIC / B-Form</li>
          <li>Domicile</li>
          <li>Passport size photographs</li>
        </ul>
      ),
    },
  ];

  return (
    <section id="admissions" className="py-24 px-6 md:px-20 bg-gray-50">
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <h3 className="text-3xl font-bold text-[#5b2fc1] mb-6">
          Admissions & How to Apply
        </h3>
        <p className="text-gray-600 mb-10">
          Learn about admission requirements, eligibility criteria, and the
          step-by-step application process.
        </p>

        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-xl bg-white shadow-sm"
            >
              <button
                onClick={() =>
                  setOpen(open === item.id ? null : item.id)
                }
                className="w-full flex justify-between items-center px-6 py-4 text-left font-semibold text-gray-800"
              >
                {item.title}
                <span className="text-[#5b2fc1] text-xl">
                  {open === item.id ? "−" : "+"}
                </span>
              </button>

              <AnimatePresence>
                {open === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden px-6 pb-5 text-gray-700"
                  >
                    {item.content}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}