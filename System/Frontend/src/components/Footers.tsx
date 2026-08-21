import React from "react";
import logoImg from "../assets/logo2.png";

export default function Footer() {
  return (
    <footer className="bg-[#0b1220] text-white py-12">
      <div className="max-w-6xl mx-auto px-6 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-1 ring-white/20">
              <img src={logoImg} alt="OBE Academic System Logo" className="w-10 h-10 object-cover scale-125" />
            </div>
            <h4 className="font-bold text-lg">OBE Academic System</h4>
          </div>
          <p className="text-sm mt-2 text-gray-300">Outcome-Based Education management and assessment platform for modern academic institutions.</p>
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
          <p className="mt-3 text-sm text-gray-300">Phone: +92-XXX-XXXXXXX<br/>Email: info@obe.edu.pk</p>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">© {new Date().getFullYear()} OBE Academic System — All rights reserved.</div>
    </footer>
  );
}