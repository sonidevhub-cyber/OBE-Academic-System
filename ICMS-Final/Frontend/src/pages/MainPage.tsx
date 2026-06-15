import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

import Navbar from "../components/Navbar";
import HeroSlider from "../components/Heroslider";
import Footer from "../components/Footers";
import NoticeBoard from "../pages/NoticeBoard";
import NewEvents from "../components/NewEvents";
import ScrollAnimate from "../components/ScrollAnimate";

export default function CUIPortalPage() {

  const [showNoticePopup, setShowNoticePopup] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNoticePopup(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      <Navbar />

      {/* 🔥 NOTICE POPUP */}
      {showNoticePopup && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl w-[90%] md:w-[600px] relative">

            <button
              onClick={() => setShowNoticePopup(false)}
              className="absolute top-2 right-3 text-xl"
            >
              ✖
            </button>

            <h2 className="text-xl font-bold text-center mb-3">
              📢 Notice Board
            </h2>

            <NoticeBoard />

          </div>
        </div>
      )}

      {/* 🔥 HERO (TEXT REMOVED) */}
      <section id="home" className="min-h-screen relative">
        <HeroSlider />
      </section>

      {/* 🔥 NOTICE BOARD */}
      <section id="notice" className="py-16 px-6 md:px-20 bg-white">
        <ScrollAnimate>
          <h2 className="text-3xl font-bold text-[#5b2fc1] mb-6 text-center">
            📢 Latest Notices
          </h2>

          <NoticeBoard />
        </ScrollAnimate>
      </section>

      {/* 🔥 ABOUT */}
      <section id="about" className="py-20 px-6 md:px-20 bg-gray-50">
        <ScrollAnimate>
          <motion.div
            className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
          >

            <div>
              <h2 className="text-3xl font-bold text-[#5b2fc1] mb-4">
                About Department
              </h2>

              <p className="text-gray-700 mb-4">
                This department focuses on modern education, innovation,
                and student development to prepare future professionals.
              </p>

              <p className="text-gray-700">
                We emphasize practical learning, research, and industry-level skills.
              </p>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-2 gap-6">
              {[
                { value: "500+", label: "Students" },
                { value: "20+", label: "Faculty" },
                { value: "10+", label: "Labs" },
                { value: "100%", label: "Projects" },
              ].map((item, i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow text-center">
                  <h3 className="text-2xl font-bold text-[#5b2fc1]">
                    {item.value}
                  </h3>
                  <p className="text-gray-600">{item.label}</p>
                </div>
              ))}
            </div>

          </motion.div>
        </ScrollAnimate>
      </section>

      {/* 🔥 NEWS */}
      <section id="news" className="py-20 px-6 md:px-20 bg-slate-50">
        <ScrollAnimate>
          <NewEvents />
        </ScrollAnimate>
      </section>

      <Footer />

    </div>
  );
}