import React from "react";
import { motion } from "framer-motion";

const news = [
  { title: "Spring Admissions Open 2026", date: "Dec 1, 2025" },
  { title: "AI Workshop for Students", date: "Nov 15, 2025" },
  { title: "Semester Results Announced", date: "Oct 10, 2025" },
];

export default function NewsEvents() {
  return (
    <div className="max-w-5xl mx-auto">
      <motion.h3
        className="text-3xl font-bold text-[#5b2fc1] mb-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        News & Events
      </motion.h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {news.map((n, i) => (
          <motion.div
            key={i}
            className="bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
          >
            <div className="text-sm text-gray-500">{n.date}</div>
            <div className="font-semibold mt-2">{n.title}</div>
            <p className="text-gray-600 text-sm mt-2">Short summary or link to full news — replace with real items.</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}