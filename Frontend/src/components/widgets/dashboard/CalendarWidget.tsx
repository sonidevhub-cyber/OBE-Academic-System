import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Event {
  id: string;
  title: string;
  date: Date;
  type: 'exam' | 'deadline' | 'meeting' | 'holiday';
  description?: string;
}

const CalendarWidget: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const events: Event[] = [
    {
      id: '1',
      title: 'Mid-term Exams Begin',
      date: new Date(2024, 9, 15), // October 15, 2024
      type: 'exam',
      description: 'Mathematics and Physics mid-term examinations'
    },
    {
      id: '2',
      title: 'Fee Payment Deadline',
      date: new Date(2024, 9, 20), // October 20, 2024
      type: 'deadline',
      description: 'Last date for semester fee payment'
    },
    {
      id: '3',
      title: 'Faculty Meeting',
      date: new Date(2024, 9, 18), // October 18, 2024
      type: 'meeting',
      description: 'Monthly faculty coordination meeting'
    },
    {
      id: '4',
      title: 'Independence Day',
      date: new Date(2024, 9, 26), // October 26, 2024 (assuming Indian calendar)
      type: 'holiday',
      description: 'National holiday - No classes'
    }
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event =>
      event.date.toDateString() === date.toDateString()
    );
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'exam': return 'bg-red-500';
      case 'deadline': return 'bg-orange-500';
      case 'meeting': return 'bg-blue-500';
      case 'holiday': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(currentDate);
  const upcomingEvents = events.filter(event => event.date >= new Date()).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Calendar</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[120px] text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="mb-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="h-8"></div>;
            }

            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();

            return (
              <motion.button
                key={index}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedDate(date)}
                className={`h-8 w-8 text-xs rounded-lg relative transition-colors ${
                  isToday
                    ? 'bg-blue-600 text-white font-bold'
                    : isSelected
                    ? 'bg-blue-100 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {date.getDate()}
                {dayEvents.length > 0 && (
                  <div className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${getEventTypeColor(dayEvents[0].type)}`}></div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Upcoming Events</h4>
        <div className="space-y-2">
          {upcomingEvents.map(event => (
            <div key={event.id} className="flex items-center space-x-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.type)}`}></div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium truncate">{event.title}</p>
                <p className="text-gray-500">
                  {event.date.toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CalendarWidget;
