import React, { useState } from "react";
import { api } from "../../api/api";
import { toast } from "react-toastify";

const HODNotice = () => {

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [file, setFile] = useState<any>(null);

  const handleSubmit = async () => {

    if (!title || !type) {
      toast.error("Title & Type required");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("notice_type", type);
    if (file) formData.append("file", file);

    try {
      await api.post("noticeboard/create/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast.success("Notice uploaded ✅");

      setTitle("");
      setDescription("");
      setType("");
      setFile(null);

    } catch (err) {
      console.error(err);
      toast.error("Upload failed ❌");
    }
  };

  return (
    <div className="bg-white p-6 rounded shadow">

      <h2 className="text-xl font-bold mb-4">Upload Notice</h2>

      <input
        placeholder="Title"
        className="border p-2 w-full mb-3"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Description"
        className="border p-2 w-full mb-3"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <select
        className="border p-2 w-full mb-3"
        value={type}
        onChange={e => setType(e.target.value)}
      >
        <option value="">Select Type</option>
        <option value="announcement">Announcement</option>
        <option value="datesheet">Date Sheet</option>
        <option value="timetable">Time Table</option>
      </select>

      <input
        type="file"
        className="mb-3"
        onChange={e => setFile(e.target.files?.[0])}
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        Upload Notice
      </button>

    </div>
  );
};

export default HODNotice;