import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Principal {
  id: number;
  first_name: string;
  last_name: string;
  username?: string;
  employee_id: string;
  rank: string;
  gender: string;
  phone: string;
  email: string;
  joining_date: string;
  retirement_date: string;
  status: string;
  created_at: string;
  profile_pic?: string;
}

interface Props {
  principal: Principal | null;
  onClose: () => void;
}

// Helper function to get full image URL
const getFullImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/media/')) {
    return `http://localhost:8000${url}`;
  }
  return `http://localhost:8000/media/${url}`;
};

const PrincipalViewModal: React.FC<Props> = ({ principal, onClose }) => {
  const [imageError, setImageError] = useState(false);
  
  if (!principal) return null;

  const fullName = `${principal.first_name || ''} ${principal.last_name || ''}`.trim();

  const initials =
    (principal.first_name?.charAt(0) || '') + (principal.last_name?.charAt(0) || '');

  const statusColor =
    principal.status === "active"
      ? "bg-green-100 text-green-700"
      : principal.status === "inactive"
      ? "bg-red-100 text-red-700"
      : "bg-yellow-100 text-yellow-700";

  // Format date helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "—";
      return date.toLocaleString();
    } catch {
      return "—";
    }
  };

  // ---------- DOWNLOAD PDF ----------
  const downloadPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Principal Profile Report", 14, 18);

    doc.setFontSize(11);
    doc.text(`Name: ${fullName}`, 14, 28);
    doc.text(`Status: ${principal.status.toUpperCase()}`, 14, 34);

    autoTable(doc, {
      startY: 40,
      theme: "grid",
      styles: { fontSize: 10 },

      head: [["Field", "Value"]],

      body: [
        ["Username", principal.username || "—"],
        ["Employee ID", principal.employee_id || "—"],
        ["Rank / Designation", principal.rank || "—"],
        ["Gender", principal.gender || "—"],
        ["Phone", principal.phone || "—"],
        ["Email", principal.email || "—"],
        ["Joining Date", formatDate(principal.joining_date)],
        ["Retirement Date", formatDate(principal.retirement_date)],
        ["Account Status", principal.status || "—"],
        [
          "Record Created",
          formatDateTime(principal.created_at),
        ],
      ],
    });

    doc.save(`Principal_${fullName}.pdf`);
  };

  // Render avatar - shows image or fallback to initials
  const renderAvatar = () => {
    if (principal.profile_pic && !imageError) {
      return (
        <img 
          src={getFullImageUrl(principal.profile_pic)}
          alt={fullName}
          className="w-16 h-16 rounded-full object-cover border-2 border-purple-300"
          onError={() => setImageError(true)}
        />
      );
    }
    return (
      <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-xl font-bold text-purple-800">
        {initials || 'P'}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">

      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">

        {/* ===== HEADER ===== */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">Principal Profile</h2>

          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* ===== PROFILE HEAD ===== */}
        <div className="px-6 py-5 flex items-center gap-4">

          {renderAvatar()}

          <div>
            <h3 className="text-xl font-semibold">{fullName}</h3>
            {principal.username && (
              <p className="text-sm text-gray-500">@{principal.username}</p>
            )}
            <span className={`px-3 py-1 text-xs rounded-full font-semibold ${statusColor}`}>
              {principal.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* ===== DETAILS SECTIONS ===== */}
        <div className="px-6 pb-6 space-y-5">

          {/* PERSONAL INFO */}
          <section>
            <h4 className="font-semibold mb-2 text-gray-700">
              Personal Information
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-xl border">
              <p><b>Username:</b> {principal.username || "—"}</p>
              <p><b>Gender:</b> {principal.gender || "—"}</p>
              <p><b>Phone:</b> {principal.phone || "—"}</p>
              <p><b>Email:</b> {principal.email || "—"}</p>
            </div>
          </section>

          {/* EMPLOYMENT INFO */}
          <section>
            <h4 className="font-semibold mb-2 text-gray-700">
              Employment Details
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-xl border">
              <p><b>Employee ID:</b> {principal.employee_id || "—"}</p>
              <p><b>Rank / Designation:</b> {principal.rank || "—"}</p>
              <p><b>Joining Date:</b> {formatDate(principal.joining_date)}</p>
              <p><b>Retirement Date:</b> {formatDate(principal.retirement_date)}</p>
            </div>
          </section>

          {/* SYSTEM INFO */}
          <section>
            <h4 className="font-semibold mb-2 text-gray-700">
              System Metadata
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-xl border">
              <p><b>Created At:</b> {formatDateTime(principal.created_at)}</p>
            </div>
          </section>
        </div>

        {/* ===== FOOTER BUTTONS ===== */}
        <div className="border-t bg-white px-6 py-3 flex justify-between">

          <button
            onClick={downloadPDF}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Download Pdf
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default PrincipalViewModal;
