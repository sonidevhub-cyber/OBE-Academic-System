import React from "react";

export default function Footer() {
  return (
    <footer className="bg-[#0b1220] text-white py-12">
      <div className="max-w-6xl mx-auto px-6 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-bold text-lg">FG Postgradaute College</h4>
          <p className="text-sm mt-2 text-gray-300">Address, contact phones, email — replace with official details.</p>
        </div>

        <div>
          <h5 className="font-semibold">Quick Links</h5>
          <ul className="mt-3 space-y-2 text-sm text-gray-300">
            <li><a href="#admissions">Admissions</a></li>
            <li><a href="#departments">Departments</a></li>
            <li><a href="#news">News</a></li>
          </ul>
        </div>

        <div>
          <h5 className="font-semibold">Contact</h5>
          <p className="mt-3 text-sm text-gray-300">Phone: +92-XXX-XXXXXXX<br/>Email: info@example.com</p>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">© {new Date().getFullYear()} CUI Lahore — All rights reserved.</div>
    </footer>
  );
}