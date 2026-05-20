import React, { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  file?: string;
  is_pinned?: boolean;
  created_at: string;
}

export default function NoticeBoard({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!show) return;

    const fetchAnnouncements = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/announcements/");
        const data = await res.json();

        let list: Announcement[] = [];

        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.results)) list = data.results;
        else if (Array.isArray(data.data)) list = data.data;

        list.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setAnnouncements(list.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();

    // 🔥 auto scroll only first 10 sec
    setAutoScroll(true);
    const timer = setTimeout(() => {
      setAutoScroll(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">

      {/* 🪵 WOOD FRAME */}
      <div className="p-3 bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-300 rounded-lg shadow-2xl">

        {/* 🟩 BOARD */}
        <div className="w-[90vw] md:w-[500px] h-[320px] bg-green-900 rounded-md p-5 relative overflow-hidden">

          {/* ❌ CLOSE */}
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-white text-lg hover:scale-110 transition"
          >
            ✖
          </button>

          {/* 🧾 TITLE */}
          <h2 className="text-center text-white text-lg font-bold tracking-widest mb-4">
            NOTICE BOARD
          </h2>

          {/* 📜 CONTENT */}
          {loading ? (
            <p className="text-white text-center">Loading...</p>
          ) : announcements.length === 0 ? (
            <p className="text-white text-center">No announcements</p>
          ) : (
            <div
              className={
                autoScroll
                  ? "animate-scroll space-y-4"
                  : "space-y-4 overflow-y-auto h-[230px] pr-2 scrollbar-hide"
              }
            >

              {(autoScroll
                ? [...announcements, ...announcements]
                : announcements
              ).map((item, index) => (
                <div key={index} className="pb-2">

                  {item.is_pinned && (
                    <p className="text-yellow-300 text-xs font-semibold">
                      📌 IMPORTANT
                    </p>
                  )}

                  <p className="text-yellow-200 font-semibold text-sm">
                    {item.title}
                  </p>

                  <p className="text-yellow-300 text-xs">
                    {item.content}
                  </p>

                  {item.file && (
                    <a
                      href={item.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-400 underline text-xs"
                    >
                      View File
                    </a>
                  )}

                  <p className="text-white/70 text-[10px] mt-1">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>

                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* 🔥 CSS */}
      <style>
        {`
          @keyframes scroll {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }

          .animate-scroll {
            animation: scroll 15s linear infinite;
          }

          /* ✅ HIDE SCROLLBAR */
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>

    </div>
  );
}