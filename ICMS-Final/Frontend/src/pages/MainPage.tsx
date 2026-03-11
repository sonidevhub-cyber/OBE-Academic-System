import React from "react";
import { motion } from "framer-motion";

import Navbar from "../components/Navbar";
import HeroSlider from "../components/Heroslider";
import Departments from "../components/Department";
import Footer from "../components/Footers";
import AdmissionsSection from "../components/AdmissionsSection";
import NewEvents from "../components/NewEvents";

import ScrollAnimate from "../components/ScrollAnimate";

export default function CUIPortalPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />

      {/* HERO */}
      <section id="home" className="min-h-screen relative">
        <HeroSlider />
      </section>

      {/* ABOUT */}
      <section id="about" className="py-24 px-6 md:px-20 bg-gray-50">
        <ScrollAnimate>
          <motion.div
            className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            {/* Left Content */}
            <div className="reveal-card">
              <h2 className="text-3xl md:text-4xl font-bold text-[#5b2fc1] mb-5">
                About F.G Postgraduate College
                <span className="block text-lg font-medium text-gray-500 mt-1">
                  Wah Cantt
                </span>
              </h2>

              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                F.G Postgraduate College, Wah Cantt is a prestigious public
                sector institution committed to academic excellence, research,
                and character building.
              </p>

              <p className="text-gray-700 leading-relaxed">
                The institution focuses on undergraduate and postgraduate
                education, fostering critical thinking, innovation and
                professional growth.
              </p>
            </div>

            {/* Right Stats */}
            <div className="grid grid-cols-2 gap-6">
              {[
                { value: "50+", label: "Years of Excellence" },
                { value: "10k+", label: "Graduates" },
                { value: "30+", label: "Academic Programs" },
                { value: "100+", label: "Qualified Faculty" },
              ].map((item, i) => (
                <ScrollAnimate delay={i * 160} key={i}>
                  <div className="reveal-card p-6 rounded-xl bg-white shadow-sm border text-center">
                    <h3 className="text-3xl font-bold text-[#5b2fc1]">
                      {item.value}
                    </h3>
                    <p className="text-gray-600 mt-1">{item.label}</p>
                  </div>
                </ScrollAnimate>
              ))}
            </div>
          </motion.div>
        </ScrollAnimate>
      </section>

      {/* DEPARTMENTS */}
      <section id="departments" className="py-20 px-6 md:px-20 bg-slate-50">
        <ScrollAnimate>
          <Departments />
        </ScrollAnimate>
      </section>

      {/* ADMISSIONS */}
      <section id="admissions" className="py-20 px-6 md:px-20 bg-white">
        <ScrollAnimate delay={120}>
          <AdmissionsSection />
        </ScrollAnimate>
      </section>

      {/* NEWS & EVENTS */}
      <section id="news" className="py-20 px-6 md:px-20 bg-slate-50">
        <ScrollAnimate delay={160}>
          <NewEvents />
        </ScrollAnimate>
      </section>

      {/* FOOTER */}
      <ScrollAnimate delay={200}>
        <Footer />
      </ScrollAnimate>
    </div>
  );
}