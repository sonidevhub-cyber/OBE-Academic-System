import React, { useEffect, useState } from "react";
import Heroslider from "../components/Heroslider";
import Navbar from "../components/Navbar";
import Footer from "../components/Footers";
import NoticeBoard from "../components/NoticeBoard"; // ✅ separate component

export default function CUIPortalPage() {

  // 🔔 NOTICE CONTROL
  const [showNotice, setShowNotice] = useState(false);

  // 🔥 AUTO SHOW (10 sec)
  useEffect(() => {
    setShowNotice(true);

    const timer = setTimeout(() => {
      setShowNotice(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ✅ NAVBAR */}
      <Navbar onNoticeClick={() => setShowNotice(true)} />

      {/* ✅ HERO */}
      <section id="home" className="min-h-screen">
        <Heroslider />
      </section>

      {/* ✅ ABOUT */}
      <section id="about" className="py-20 px-6 md:px-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-[#5b2fc1] mb-4">
            About College
          </h2>

          <p className="text-gray-700 leading-relaxed mb-3">
            F.G Postgraduate College Wah Cantt provides quality education
            supported by modern digital systems.
          </p>

          <p className="text-gray-600">
            This portal helps students stay updated with announcements,
            date sheets, and timetables in real-time.
          </p>
        </div>
      </section>

      {/* 🔥 NOTICE POPUP */}
      <NoticeBoard
        show={showNotice}
        onClose={() => setShowNotice(false)}
      />

      {/* ✅ FOOTER (CONTACT LINKED HERE) */}
      <Footer />

    </div>
  );
}