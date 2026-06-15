import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  Bell,
  MessageSquare,
  User,
  LogOut
} from "lucide-react";
import { api } from "../../api/api";
import HODNotice from "../pages/HODNotice";

// 🔥 NEW IMPORT
import HODCQI from "../pages/HODCQI";
// ICMS-Final\Frontend\src\views\pages\HODCQI.tsx

type Tab = "dashboard" | "cqi" | "notice" | "feedback";

const HODDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const menu = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "cqi", label: "CQI Control", icon: ClipboardCheck },
    { id: "notice", label: "Notice Board", icon: Bell },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
  ];

  return (
    <div className="flex min-h-screen bg-[#EEF2FF]">

      {/* ================= SIDEBAR ================= */}
      <div className="w-64 bg-gradient-to-b from-indigo-800 to-purple-900 text-white p-4">

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/20 rounded-full mx-auto flex items-center justify-center">
            <User />
          </div>
          <h2 className="mt-2 font-bold">HOD Panel</h2>
          <p className="text-xs text-purple-200">Head of Department</p>
        </div>

        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`flex items-center w-full px-3 py-2 mb-2 rounded ${
                activeTab === item.id
                  ? "bg-white/20"
                  : "hover:bg-white/10"
              }`}
            >
              <Icon className="mr-2" size={18} />
              {item.label}
            </button>
          );
        })}

        <button className="mt-10 w-full bg-red-600 py-2 rounded flex items-center justify-center gap-2">
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* ================= MAIN ================= */}
      <div className="flex-1">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-5 text-white flex justify-between">
          <h1 className="text-xl font-bold capitalize">{activeTab}</h1>
          <span className="text-sm">HOD Control Panel</span>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "cqi" && <HODCQI />}   {/* 🔥 UPDATED */}
          {activeTab === "notice" && <HODNotice />}
          {activeTab === "feedback" && <FeedbackModule />}
        </div>

      </div>
    </div>
  );
};

export default HODDashboard;


/// ================= DASHBOARD =================

const Dashboard = () => {
  const [cqi, setCqi] = useState<any[]>([]);
  const [ann, setAnn] = useState<any[]>([]);
  const [fb, setFb] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get("assessments/hod-cqi/"),
      api.get("noticeboard/"),
      api.get("feedback/")
    ]).then(([c, a, f]) => {
      setCqi(c.data || []);
      setAnn(a.data || []);
      setFb(f.data || []);
    });
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-6">

      <Card title="CQI" value={cqi.length} color="blue" />
      <Card title="Notice Board" value={ann.length} color="green" />
      <Card title="Feedback" value={fb.length} color="purple" />

    </div>
  );
};


/// ================= CARD =================

const Card = ({ title, value, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow">
    <h3 className="text-gray-500 text-sm">{title}</h3>
    <h2 className={`text-3xl font-bold text-${color}-600`}>
      {value}
    </h2>
  </div>
);



/// ================= FEEDBACK =================

const FeedbackModule = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    api.get("feedback/").then(res => setData(res.data));
  }, []);

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Feedback</h2>

      {data.length === 0 ? (
        <p className="text-gray-500">No Feedback</p>
      ) : (
        data.map((f, i) => (
          <div key={i} className="border p-3 mb-2 rounded">
            <p>{f.comment}</p>
            <p className="text-xs text-gray-500">
              {f.student_name}
            </p>

            <button className="mt-2 bg-indigo-600 text-white px-3 py-1 rounded">
              Send to Principal
            </button>
          </div>
        ))
      )}
    </div>
  );
};