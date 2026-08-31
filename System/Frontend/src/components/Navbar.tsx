import React from "react";
import logo from "../assets/logo2.png";
import { Link } from "react-router-dom";

const links = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "notice", label: "Notice Board" }, 
];

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-md border-b border-gray-100">

      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">

        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center ring-1 ring-[#5b2fc1]/15 overflow-hidden">
            <img src={logo} alt="OBE Academic System Logo" className="w-11 h-11 object-cover scale-125" />
          </div>

          <div>
            <div className="text-base font-bold text-[#5b2fc1] leading-tight">
              OBE Academic System
            </div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">
              Outcome-Based Education Portal
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav>
          <ul className="hidden md:flex items-center gap-6">

            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className="text-gray-700 hover:text-[#5b2fc1] transition"
                >
                  {l.label}
                </a>
              </li>
            ))}

            {/* LOGIN BUTTON */}
            <li>
              <Link
                to="/rolebased-login"
                className="bg-[#5b2fc1] text-white px-4 py-2 rounded-md shadow-sm hover:opacity-90 transition"
              >
                Login
              </Link>
            </li>

          </ul>

          {/* MOBILE SIMPLE */}
          <div className="md:hidden">
            <a href="#home" className="text-gray-700">
              Menu
            </a>
          </div>

        </nav>
      </div>
    </header>
  );
}