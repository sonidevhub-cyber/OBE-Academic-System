import React, { useEffect, useState } from "react";
import { api } from "../api/api";
import { Megaphone, Calendar, FileText } from "lucide-react";

type Notice = {
  id: number;
  title: string;
  description: string;
  notice_type: string;
  file?: string;
  created_at: string;
};

const NoticeBoard = () => {
  const [data, setData] = useState<Notice[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    api.get("noticeboard/")
      .then(res => setData(res.data))
      .catch(err => console.error(err));
  }, []);

  // ✅ latest 5 sorted
  const filteredData = data
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    )
    .filter(item =>
      activeTab === "all" ? true : item.notice_type === activeTab
    )
    .slice(0, 5);

  // ✅ colors
  const getTypeColor = (type: string) => {
    if (type === "datesheet") return "text-red-300";
    if (type === "timetable") return "text-blue-300";
    if (type === "announcement") return "text-yellow-300";
    return "text-white";
  };

  // ✅ icons
  const getIcon = (type: string) => {
    if (type === "datesheet") return <Calendar size={14} />;
    if (type === "timetable") return <FileText size={14} />;
    return <Megaphone size={14} />;
  };

  return (
    <div className="p-4 rounded-xl shadow-2xl bg-[linear-gradient(145deg,#8b5a2b,#5c3b1e)]">

      {/* BOARD */}
      <div className="bg-green-900 p-6 rounded-lg h-[420px] text-white relative overflow-hidden">

        {/* TITLE */}
        <h2 className="text-2xl font-bold text-center mb-4 flex items-center justify-center gap-2">
          <Megaphone /> Notice Board
        </h2>

        {/* TABS */}
        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          {["all", "announcement", "datesheet", "timetable"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-sm capitalize border ${
                activeTab === tab
                  ? "bg-white text-black"
                  : "border-white/40 text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 🔥 CONTENT AREA */}
        <div className="relative h-[280px] overflow-hidden">

          {/* 🔥 AUTO SCROLL ONLY FOR ALL */}
          <div
            className={`absolute w-full ${
              activeTab === "all" ? "animate-scrollUp" : ""
            }`}
          >

            {filteredData.length === 0 ? (
              <p className="text-center text-gray-300">
                No notices available
              </p>
            ) : (
              filteredData.map((item) => (
                <div key={item.id} className="mb-6">

                  {/* TITLE */}
                  <h3 className="font-bold text-lg">
                    {item.title}
                  </h3>

                  {/* TYPE */}
                  <p className={`text-sm flex items-center gap-1 ${getTypeColor(item.notice_type)}`}>
                    {getIcon(item.notice_type)}
                    {item.notice_type}
                  </p>

                  {/* DESC */}
                  <p className="text-sm mt-1">
                    {item.description}
                  </p>

                  {/* FILE */}
                  {item.file && (
                    <a
                      href={`http://127.0.0.1:8000${item.file}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-300 underline text-sm"
                    >
                      📎 View File
                    </a>
                  )}

                  {/* DATE */}
                  <p className="text-xs text-gray-300 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>

                </div>
              ))
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default NoticeBoard;