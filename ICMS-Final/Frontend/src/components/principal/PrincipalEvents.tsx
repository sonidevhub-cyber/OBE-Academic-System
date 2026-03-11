import React, { useEffect, useState } from "react";
import { api } from "../../api/api";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronDown, ChevronUp, Check, X } from "lucide-react";

export default function PrincipalEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchEvents = async () => {
    try {
      const res = await api.get("/events/");
      setEvents(res.data);
    } catch (error) {
      console.error("Error loading events", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const approveEvent = async (id: number) => {
    await api.post(`/events/${id}/approve/`);
    fetchEvents();
  };

  const rejectEvent = async (id: number) => {
    await api.post(`/events/${id}/reject/`);
    fetchEvents();
  };

  const getStatusBadge = (status: string) => {
    const map: any = {
      Approved: "bg-green-100 text-green-700",
      Pending: "bg-amber-100 text-amber-700",
      Rejected: "bg-rose-100 text-rose-700",
    };
    return map[status] || "bg-gray-200 text-gray-700";
  };

  if (loading)
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Event Review & Approval Panel
        </h2>

        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Calendar className="w-6 h-6" />
        Event Review & Approval Panel
      </h2>

      {events.length === 0 && (
        <p className="text-gray-500 italic">
          No event requests available at the moment.
        </p>
      )}

      <AnimatePresence>
        {events.map((event) => {
          const isOpen = expanded === event.id;

          return (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-white border rounded-2xl shadow-sm p-5 
              hover:shadow-md transition-all duration-300"
            >
              <div className="flex justify-between items-start">

                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {event.title}
                  </h3>

                  <p className="text-gray-600 mt-1 line-clamp-1">
                    {event.description}
                  </p>

                  <div className="mt-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                        event.status
                      )}`}
                    >
                      {event.status === "Pending"
                        ? "Awaiting Review"
                        : event.status}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setExpanded(isOpen ? null : event.id)}
                  className="px-3 py-2 rounded-xl border bg-gray-50 
                  hover:bg-gray-100 flex items-center gap-1"
                >
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                  {isOpen ? "Hide Details" : "View Details"}
                </button>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mt-4 pl-1 space-y-3"
                  >
                    <p className="text-gray-700 leading-relaxed">
                      {event.description}
                    </p>

                    {event.organizer && (
                      <p className="text-sm text-gray-500">
                        Requested By: {event.organizer}
                      </p>
                    )}

                    <div className="flex gap-3 mt-2">

                      {event.status !== "Approved" && (
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => approveEvent(event.id)}
                          className="px-4 py-2 rounded-xl bg-green-600 
                          text-white flex gap-1 items-center"
                        >
                          <Check size={16} /> Approve Request
                        </motion.button>
                      )}

                      {event.status !== "Rejected" && (
                        <motion.button
                          whileTap={{ scale: 0.93 }}
                          onClick={() => rejectEvent(event.id)}
                          className="px-4 py-2 rounded-xl bg-rose-600 
                          text-white flex gap-1 items-center"
                        >
                          <X size={16} /> Reject Request
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}