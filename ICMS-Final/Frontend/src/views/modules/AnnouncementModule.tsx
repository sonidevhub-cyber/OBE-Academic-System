import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Announcement {
  id: number;
  title: string;
  message: string;
  created_at: string;
  author?: string;
}

interface AnnouncementModuleProps {
  token?: string;
  canCreate?: boolean;
  onAnnouncementCreate?: (announcement: Announcement) => void;
}

const AnnouncementModule: React.FC<AnnouncementModuleProps> = ({ 
  token, 
  canCreate = false, 
  onAnnouncementCreate 
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '' });
  const [loading, setLoading] = useState(false);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/announcements/', {
        headers: token ? {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.data || data || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !token) return;

    try {
      const response = await fetch('http://localhost:8000/api/announcements/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAnnouncement)
      });

      if (response.ok) {
        const data = await response.json();
        setNewAnnouncement({ title: '', message: '' });
        fetchAnnouncements();
        onAnnouncementCreate?.(data);
        alert('✅ Announcement added successfully!');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [token]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 bg-white rounded-2xl shadow-md"
    >
      <h2 className="text-2xl font-bold text-blue-600 mb-4">📢 Announcements</h2>

      {/* Create Announcement Form */}
      {canCreate && (
        <form onSubmit={handleCreateAnnouncement} className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="Title"
            value={newAnnouncement.title}
            onChange={(e) =>
              setNewAnnouncement({ ...newAnnouncement, title: e.target.value })
            }
            className="w-full p-2 border rounded-md"
            required
          />
          <textarea
            placeholder="Message"
            value={newAnnouncement.message}
            onChange={(e) =>
              setNewAnnouncement({ ...newAnnouncement, message: e.target.value })
            }
            className="w-full p-2 border rounded-md"
            rows={4}
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Add Announcement
          </button>
        </form>
      )}

      {/* Announcement List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {canCreate ? 'Existing Announcements' : 'Latest Announcements'}
          </h3>
          <button
            onClick={fetchAnnouncements}
            disabled={loading}
            className="bg-gray-500 text-white px-3 py-1 rounded-md text-sm hover:bg-gray-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <motion.div
                key={announcement.id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border-b border-gray-300 pb-3 mb-3 last:border-b-0"
              >
                <h4 className="text-blue-600 font-bold">{announcement.title}</h4>
                <p className="text-gray-700 mt-1">{announcement.message}</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">
                    Posted on: {new Date(announcement.created_at).toLocaleDateString()}
                  </p>
                  {announcement.author && (
                    <p className="text-xs text-gray-500">
                      By: {announcement.author}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No announcements yet.</p>
        )}
      </div>
    </motion.div>
  );
};

export default AnnouncementModule;