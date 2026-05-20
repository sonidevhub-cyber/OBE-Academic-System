import React from "react";

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0f172a] text-white py-12 mt-20">

      <div className="max-w-6xl mx-auto px-6 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* 🏫 COLLEGE INFO */}
        <div>
          <h4 className="font-bold text-lg text-[#60a5fa]">
            FG Postgraduate College
          </h4>

          <p className="text-sm mt-3 text-gray-300 leading-relaxed">
            Wah Cantt — Computer Science Department portal providing
            real-time academic updates, notices, and student services.
          </p>
        </div>

        {/* 🔗 QUICK LINKS */}
        <div>
          <h5 className="font-semibold text-white">Quick Links</h5>

          <ul className="mt-3 space-y-2 text-sm text-gray-300">

            <li>
              <a href="#home" className="hover:text-[#60a5fa] transition">
                Home
              </a>
            </li>

            <li>
              <a href="#about" className="hover:text-[#60a5fa] transition">
                About
              </a>
            </li>

            {/* ❌ NOTICE REMOVED (popup hai) */}

            <li>
              <a href="#contact" className="hover:text-[#60a5fa] transition">
                Contact Us
              </a>
            </li>

          </ul>
        </div>

        {/* 📞 CONTACT */}
        <div>
          <h5 className="font-semibold text-white">Contact</h5>

          <p className="mt-3 text-sm text-gray-300 leading-relaxed">
            📍 Wah Cantt, Pakistan <br />
            📞 +92-XXX-XXXXXXX <br />
            📧 csdept@college.edu.pk
          </p>
        </div>

      </div>

      {/* 🔻 BOTTOM */}
      <div className="mt-10 text-center text-sm text-gray-400 border-t border-gray-700 pt-4">
        © {new Date().getFullYear()} CS Department Portal — All rights reserved.
      </div>

    </footer>
  );
}