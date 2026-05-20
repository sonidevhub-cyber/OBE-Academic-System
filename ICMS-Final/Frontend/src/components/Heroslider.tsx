import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "assets/logo2.png";
import activity from "assets/activity.jpg";
import welcome from "assets/welcome.jpg";
import department from "assets/department.jpg";
import campus from "assets/campus.jpg";
import Sports from "assets/sports.jpg";

// 🎯 CS DEPARTMENT SLIDES
const slides = [
  {
    id: 1,
    title: "Welcome to Computer Science Department",
    subtitle: "Innovation | Programming | Future Technology",
    image: welcome,
  },
  {
    id: 2,
    title: "BS Computer Science Program",
    subtitle: "Software Engineering, AI, Web & App Development",
    image: department,
  },
  {
    id: 3,
    title: "Student Projects & Research",
    subtitle: "FYPs, OBE System, Real-world Applications",
    image: campus,
  },
  {
    id: 4,
    title: "Tech Activities & Events",
    subtitle: "Hackathons, Coding Competitions, Workshops",
    image: activity,
  },
  {
    id: 5,
    title: "Department Environment",
    subtitle: "Labs, Innovation & Collaborative Learning",
    image: Sports,
  },
];

export default function HeroSlider() {
  const [index, setIndex] = useState(0);

  // 🔁 AUTO SLIDE
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full h-screen relative overflow-hidden">

      <AnimatePresence initial={false}>
        {slides.map((s, i) =>
          i === index ? (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0"
            >
              🌿 SOFT GREEN OVERLAY (NO BLACK)
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `
  linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.05)),
  url(${s.image})
`,
                }}
              />

              {/* 📘 TEXT CONTENT */}
              <div className="absolute inset-0 flex items-center justify-end pr-8 md:pr-24">
                <div className="max-w-lg text-right">

                  <motion.h1
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.7 }}
                    className="text-3xl md:text-5xl font-bold text-white leading-tight drop-shadow-lg"
                  >
                    {s.title}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.7 }}
                    className="text-md md:text-lg text-white/90 mt-3"
                  >
                    {s.subtitle}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                    className="mt-6"
                  >
                    <a
                      href="#contact"
                      className="inline-block bg-[#5b2fc1] hover:bg-[#4c28a8] text-white px-6 py-2 rounded-md shadow-lg transition"
                    >
                      Contact Us
                    </a>
                  </motion.div>

                </div>
              </div>

              {/* 🔵 LOGO CIRCLE */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1 }}
                className="absolute left-16 top-24 hidden md:flex items-center justify-center w-56 h-56 rounded-full bg-white border-[5px] border-[#5b2fc1] shadow-lg"
              >
                <img src={logo} alt="logo" className="w-36 h-auto" />
              </motion.div>

            </motion.div>
          ) : null
        )}
      </AnimatePresence>

      {/* 🔘 DOTS */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-3 h-3 rounded-full ${
              i === index ? "bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>

    </div>
  );
}