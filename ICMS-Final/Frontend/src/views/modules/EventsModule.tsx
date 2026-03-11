import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  description?: string;
  date: string;
  time?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface EventsModuleProps {
  token: string;
  userType: 'student' | 'instructor' | 'hod' | 'admin' | 'principal';
  canApprove?: boolean;
  darkMode?: boolean;
}

const EventsModule: React.FC<EventsModuleProps> = ({ 
  token, 
  userType, 
  canApprove = false, 
  darkMode = false 
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/events/', {
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const eventsList = Array.isArray(data) ? data : (data.results || []);
        
        // Filter events based on user type
        if (userType === 'student') {
          setEvents(eventsList.filter((event: Event) => event.status === 'approved'));
        } else {
          setEvents(eventsList);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/events/${id}/approve/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      fetchEvents();
    } catch (error) {
      console.error('Error approving event:', error);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/events/${id}/reject/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        }
      });
      fetchEvents();
    } catch (error) {
      console.error('Error rejecting event:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token, userType]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl shadow-md p-6 ${
        darkMode ? "bg-gray-800" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Calendar className="text-blue-500" />
          {userType === 'student' ? '🎉 Approved Events' : 'Event Management'}
        </h2>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading events...</p>
        </div>
      ) : events.length > 0 ? (
        <div className={`${canApprove ? 'space-y-3' : 'grid md:grid-cols-2 gap-4'}`}>
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl shadow transition-all ${
                darkMode ? "bg-gray-700" : "bg-gray-50"
              } hover:shadow-md border-l-4 border-blue-500`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-blue-600">
                    {event.title}
                  </h3>
                  <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                    {event.description || "No description available."}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(event.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getStatusColor(event.status)
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                📅 {event.date ? new Date(event.date).toLocaleDateString() : "N/A"}
                {event.time && ` 🕒 ${event.time}`}
              </p>

              {canApprove && event.status === 'pending' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprove(event.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md flex items-center gap-1 text-sm"
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(event.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md flex items-center gap-1 text-sm"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-300 text-center py-8">
          {userType === 'student' ? 'No approved events available.' : 'No events found.'}
        </p>
      )}
    </motion.div>
  );
};

export default EventsModule;