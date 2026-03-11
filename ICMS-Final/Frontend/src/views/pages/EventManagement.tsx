import React, { useEffect, useState } from "react";
import axios from "axios";

const EventManagement: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  // ✅ Token & Role from correct localStorage key
  const authData = JSON.parse(localStorage.getItem("auth") || "{}");
  const token = authData?.access_token;
  const userRole = authData?.user?.role;
  const isSuperuser = authData?.user?.is_superuser;

  useEffect(() => {
    fetchEvents();
  }, []);

  // 🟢 Fetch all events
  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/events/", {
        headers: { Authorization: `Token ${token}` },
      });
      setEvents(res.data);
    } catch (error: any) {
      console.error("Error fetching events:", error.response?.data || error);
    }
  };

  // 🟡 Approve / Reject event (Principal only)
  const handleApproval = async (id: number, status: string) => {
    try {
      await axios.patch(
        `http://127.0.0.1:8000/api/events/${id}/`,
        { status },
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      fetchEvents();
    } catch (error: any) {
      console.error("Error updating event:", error.response?.data || error);
      alert("Failed to update event.");
    }
  };

  // 🟣 Admin creates event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        "http://127.0.0.1:8000/api/events/",
        { title, description, date },
        { headers: { Authorization: `Token ${token}` } }
      );
      alert("✅ Event created successfully!");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setDate("");
      fetchEvents();
    } catch (error: any) {
      console.error("Error creating event:", error.response?.data || error);
      alert("❌ Failed to create event.");
    }
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Event Management</h2>

        {/* 🟦 Only Admin can Add Event */}
        {(userRole === "admin" || userRole === "super_admin" || isSuperuser) && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            + Add Event
          </button>
        )}
      </div>

      {/* 🟩 Events Table */}
      <table className="w-full text-left border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Title</th>
            <th className="p-2">Date</th>
            <th className="p-2">Description</th>
            <th className="p-2">Status</th>
            {userRole === "principal" && <th className="p-2">Action</th>}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-t">
              <td className="p-2">{event.title}</td>
              <td className="p-2">{event.date}</td>
              <td className="p-2">{event.description}</td>
              <td className="p-2 font-semibold capitalize">{event.status}</td>

              {/* 🟠 Approve / Reject only for Principal */}
              {userRole === "principal" && (
                <td className="p-2 flex gap-2">
                  <button
                    onClick={() => handleApproval(event.id, "approved")}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApproval(event.id, "rejected")}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🟦 Modal for Add Event Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-xl font-bold mb-4 text-center">Add New Event</h3>
            <form onSubmit={handleCreateEvent}>
              <div className="mb-3">
                <label className="block font-semibold mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full border px-3 py-2 rounded"
                />
              </div>

              <div className="mb-3">
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full border px-3 py-2 rounded"
                />
              </div>

              <div className="mb-3">
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full border px-3 py-2 rounded"
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-400 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagement;
