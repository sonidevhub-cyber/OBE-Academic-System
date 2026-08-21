import React from 'react';
import { motion } from 'framer-motion';

const CalendarWidget = () => {
  const events = [
    { date: "Today", title: "Faculty Meeting", time: "2:00 PM" },
    { date: "Tomorrow", title: "Student Orientation", time: "10:00 AM" },
    { date: "Dec 25", title: "Winter Break Starts", time: "All Day" },
    { date: "Jan 2", title: "Classes Resume", time: "8:00 AM" }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Events</h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400"
          >
            <div>
              <p className="font-medium text-gray-800">{event.title}</p>
              <p className="text-sm text-gray-600">{event.date}</p>
            </div>
            <span className="text-sm text-blue-600 font-medium">{event.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CalendarWidget;