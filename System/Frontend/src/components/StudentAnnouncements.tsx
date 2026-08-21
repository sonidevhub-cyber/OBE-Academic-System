import React, { useEffect, useState } from "react";
import { announcementService } from "../api/apiService";

const StudentAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementService.getAllAnnouncements();
        setAnnouncements(res.data || res);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="p-4 bg-gray-50 rounded-lg shadow-md">
      <h2 className="text-xl font-bold text-blue-600 mb-3">📢 Latest Announcements</h2>
      {announcements.length === 0 ? (
        <p className="text-gray-600">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((item) => (
            <li key={item.id} className="bg-white p-3 rounded shadow">
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-gray-700">{item.message}</p>
              <small className="text-gray-500">
                {new Date(item.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudentAnnouncements;