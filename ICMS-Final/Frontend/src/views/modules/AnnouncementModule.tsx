import React, { useState, useEffect } from 'react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  is_pinned: boolean;
  file?: string;
  created_at: string;
  author_name?: string;
}

interface Props {
  token?: string;
  canCreate?: boolean;
}

const AnnouncementModule: React.FC<Props> = ({ token, canCreate = false }) => {

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    type: 'announcement',
    is_pinned: false
  });

  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 📥 FETCH
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/announcements/');
      const data = await res.json();

      if (Array.isArray(data)) {
        setAnnouncements(data);
      } else if (Array.isArray(data.results)) {
        setAnnouncements(data.results);
      } else if (Array.isArray(data.data)) {
        setAnnouncements(data.data);
      } else {
        setAnnouncements([]);
      }

    } catch (err) {
      console.error(err);
      setAnnouncements([]);
    }
    setLoading(false);
  };

  // ➕ CREATE / UPDATE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return;

    try {
      const formData = new FormData();
      formData.append("title", newAnnouncement.title);
      formData.append("content", newAnnouncement.message);
      formData.append("type", newAnnouncement.type);
      formData.append("is_pinned", String(newAnnouncement.is_pinned));

      if (file) {
        formData.append("file", file);
      }

      const url = editingId
        ? `http://localhost:8000/api/announcements/${editingId}/`
        : `http://localhost:8000/api/announcements/`;

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Token ${token}`
        },
        body: formData
      });

      if (res.ok) {
        alert(editingId ? "✅ Updated" : "✅ Uploaded");

        setNewAnnouncement({
          title: '',
          message: '',
          type: 'announcement',
          is_pinned: false
        });

        setFile(null);
        setEditingId(null);

        fetchAnnouncements();
      } else {
        const err = await res.json();
        alert("❌ " + JSON.stringify(err));
      }

    } catch (err) {
      console.error(err);
    }
  };

  // ❌ DELETE
  const handleDelete = async (id: string) => {
    if (!token) return;

    if (!window.confirm("Delete this?")) return;

    const res = await fetch(`http://localhost:8000/api/announcements/${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Token ${token}`
      }
    });

    if (res.ok) {
      alert("✅ Deleted");
      fetchAnnouncements();
    }
  };

  // ✏️ EDIT
  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setNewAnnouncement({
      title: a.title,
      message: a.content,
      type: a.type,
      is_pinned: a.is_pinned
    });
  };

  // 🎯 TYPE COLOR
  const getBadgeColor = (type: string) => {
    if (type === "datesheet") return "bg-yellow-200 text-black";
    if (type === "timetable") return "bg-blue-200 text-black";
    return "bg-gray-200 text-black";
  };

  // 🔝 SORT (PINNED FIRST → LATEST)
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  return (
    <div className="p-6 bg-white rounded-xl shadow">

      <h2 className="text-xl font-bold mb-4">📢 Announcements</h2>

      {/* FORM */}
      {canCreate && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">

          <input
            type="text"
            placeholder="Title"
            value={newAnnouncement.title}
            onChange={(e) =>
              setNewAnnouncement({ ...newAnnouncement, title: e.target.value })
            }
            className="w-full p-2 border rounded"
            required
          />

          <textarea
            placeholder="Message"
            value={newAnnouncement.message}
            onChange={(e) =>
              setNewAnnouncement({ ...newAnnouncement, message: e.target.value })
            }
            className="w-full p-2 border rounded"
            required
          />

          <select
            value={newAnnouncement.type}
            onChange={(e) =>
              setNewAnnouncement({ ...newAnnouncement, type: e.target.value })
            }
            className="w-full p-2 border rounded"
          >
            <option value="announcement">Announcement</option>
            <option value="datesheet">Date Sheet</option>
            <option value="timetable">Time Table</option>
          </select>

          {/* ⭐ PIN */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newAnnouncement.is_pinned}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  is_pinned: e.target.checked
                })
              }
            />
            ⭐ Pin Important Notice
          </label>

          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            {editingId ? "Update" : "Upload"}
          </button>

        </form>
      )}

      {/* LIST */}
      {loading ? <p>Loading...</p> : (
        <div className="space-y-4">

          {sortedAnnouncements.map((a) => (
            <div
              key={a.id}
              className={`border-b pb-3 p-3 rounded ${
                a.is_pinned ? "bg-yellow-100 border-yellow-400" : ""
              }`}
            >

              {/* ⭐ PIN LABEL */}
              {a.is_pinned && (
                <span className="text-xs bg-yellow-400 px-2 py-1 rounded">
                  ⭐ Important
                </span>
              )}

              <h4 className="font-bold text-blue-600">{a.title}</h4>

              <p>{a.content}</p>

              {/* 🎯 TYPE */}
              <span className={`text-xs px-2 py-1 rounded ${getBadgeColor(a.type)}`}>
                {a.type}
              </span>

              {/* 📄 FILE */}
              {a.file && (
                <a
                  href={a.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-500 mt-1"
                >
                  📄 View File
                </a>
              )}

              <p className="text-xs text-gray-400">
                {new Date(a.created_at).toLocaleDateString()}
              </p>

              {canCreate && (
                <div className="space-x-3 mt-2">
                  <button onClick={() => handleEdit(a)} className="text-blue-600 text-sm">
                    Edit
                  </button>

                  <button onClick={() => handleDelete(a.id)} className="text-red-600 text-sm">
                    Delete
                  </button>
                </div>
              )}

            </div>
          ))}

        </div>
      )}
    </div>
  );
};

export default AnnouncementModule;