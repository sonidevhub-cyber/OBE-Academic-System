import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo2.png";
import welcomeImg from "../assets/welcome.jpg";

import {
  AcademicCapIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  GlobeAltIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/solid";

type Box = { label: string; icon: React.ElementType; role: string };

const boxes: Box[] = [
  { label: "Admin Console", icon: AcademicCapIcon, role: "admin" },
  { label: "Faculty Console", icon: UserGroupIcon, role: "faculty" },
  { label: "Coordinator Console", icon: UsersIcon, role: "coordinator" },
  { label: "Instructor Console", icon: ClipboardDocumentCheckIcon, role: "instructor" },
  { label: "HOD Console", icon: GlobeAltIcon, role: "hod" },
  { label: "Student Console", icon: BuildingLibraryIcon, role: "student" },
];

export default function CUIPortalPage() {
  const navigate = useNavigate();
  const { forceLogout } = useAuth();

  return (
    <div className="w-full min-h-screen bg-[#f5f6fb] overflow-hidden flex">
      <div className="relative w-full h-screen">

        {/* LIGHT GLASS BLUE PANEL */}
        <div
          className="absolute left-0 top-0 h-full w-full overflow-hidden pointer-events-none"
          style={{
            clipPath: "polygon(0 0, 60% 0, 45% 100%, 0% 100%)",
            background:
              "linear-gradient(180deg,#5ba8ff 0%,#7fb6ff 40%,#bcd9ff 100%)",
            zIndex: 1,
          }}
        >
          <img
            src={welcomeImg}
            alt="campus"
            className="w-full h-full object-cover opacity-35"
          />

          {/* FROST GLASS OVERLAY */}
          <div className="w-full h-full backdrop-blur-[6px] bg-white/10" />
        </div>

        {/* BADGE */}
        <div className="absolute top-10 left-10 z-[999]">
          <div className="text-white bg-[#5b2fc1] px-6 py-2 rounded-full text-sm font-semibold shadow-lg tracking-wide">
            FG Postgraduate College for Women Wah Cantt
          </div>
        </div>

        {/* GLASSY LOGO */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute left-[41%] top-[30%] -translate-x-1/2 -translate-y-1/2 z-30
          w-52 h-52 md:w-60 md:h-60 rounded-full
          bg-white/40 backdrop-blur-xl
          shadow-[0_25px_60px_rgba(0,0,0,.18)]
          border border-white/60
          ring-4 ring-[#a88bff40] flex items-center justify-center"
          style={{
            perspective: 1200,
          }}
        >
          <motion.div
            className="w-40 h-40 rounded-full bg-white shadow-inner flex items-center justify-center"
            animate={{
              rotateX: [0, 18, 0, -18, 0],
              rotateY: [0, 180, 360],
              rotateZ: [0, 6, 0, -6, 0],
              scale: [1, 1.08, 1, 1.08, 1],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              repeatDelay: 0,
              ease: "easeInOut",
            }}
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            <img src={logo} alt="Logo" className="w-[68%] h-auto" />
          </motion.div>
        </motion.div>

        {/* RIGHT PANEL */}
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="absolute right-0 top-0 w-[45%] h-full flex items-center z-[999]"
        >
          <div className="px-12 py-16 w-full">

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-4xl md:text-5xl font-extrabold text-[#5b2fc1]"
            >
              FG Online Portal
            </motion.h1>

            <p className="text-gray-600 mt-2 mb-8">
              Smart • Secure • Modern Campus Access
            </p>

            {/* GLASS TILE PANEL */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { delayChildren: 0.5, staggerChildren: 0.12 },
                },
              }}
              className="backdrop-blur-xl bg-white/80 rounded-2xl border border-[#e6e0ff]
              shadow-xl p-6"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {boxes.map((b, i) => {
                  const Icon = b.icon;
                  return (
                    <motion.button
                      key={i}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      onClick={() => {
                        forceLogout();
                        navigate(`/login?role=${b.role}`);
                      }}
                      className="flex flex-col items-center justify-center
                      bg-white/90 backdrop-blur-md
                      rounded-xl p-4 border border-[#eee]
                      shadow-sm hover:shadow-2xl hover:-translate-y-1
                      transition-all duration-300"
                    >
                      <Icon className="w-6 h-6 text-[#5b2fc1]" />
                      <span className="text-sm text-gray-700 mt-2 text-center">
                        {b.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="mt-8"
            >
              <button
                onClick={() => navigate("/portal")}
                className="bg-[#1C63D5] text-white px-8 py-2.5 rounded-lg shadow-xl
                hover:-translate-y-[2px] hover:bg-[#184f9a] transition-all"
              >
                Enter Portal
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}