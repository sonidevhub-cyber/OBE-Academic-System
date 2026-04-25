import React, { useState } from "react";
import { api } from "../../../api/api";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface PrincipalForm {
  first_name: string;
  last_name: string;
  rank: string;
  department: string;
  gender: string;
  phone: string;
  email: string;
  joining_date: string;
  retirement_date: string;
  status: string;
  password?: string;
}

interface Props {
  principal: any;
  onClose: () => void;
  onUpdated: () => void;
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

const PrincipalEditModal: React.FC<Props> = ({ principal, onClose, onUpdated }) => {

  const [form, setForm] = useState<PrincipalForm>({
    first_name: principal?.first_name || "",
    last_name: principal?.last_name || "",
    rank: principal?.rank || "",
    department: principal?.department || "",
    gender: principal?.gender || "",
    phone: principal?.phone || "",
    email: principal?.email || "",
    joining_date: principal?.joining_date || "",
    retirement_date: principal?.retirement_date || "",
    status: principal?.status || "active",
    password: "",
  });

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setProfilePicPreview(URL.createObjectURL(file));
  };

  const updatePrincipal = async () => {
    try {
      // If a profile picture is provided, send multipart/form-data
      if (profilePicFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            fd.append(k, v as any);
          }
        });
        fd.append('profile_pic', profilePicFile);
        await api.put(`/principal/update/${principal.id}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Send regular JSON data (excluding empty password)
        const dataToSend = { ...form };
        if (!dataToSend.password) {
          delete dataToSend.password;
        }
        await api.put(`/principal/update/${principal.id}/`, dataToSend);
      }
      onUpdated();
      onClose();
    } catch (error) {
      console.error("Update failed", error);
      alert("Update failed — check API route or backend serializer.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[800px] max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Edit Principal</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Profile Picture Section */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Profile Picture</h3>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden">
                {profilePicPreview ? (
                  <img src={profilePicPreview} alt="preview" className="w-20 h-20 object-cover" />
                ) : principal?.profile_pic ? (
                  <img 
                    src={getFullImageUrl(principal.profile_pic)} 
                    alt="current" 
                    className="w-20 h-20 object-cover" 
                  />
                ) : (
                  <span className="text-2xl font-bold text-purple-600">
                    {(principal?.first_name?.charAt(0) || '') + (principal?.last_name?.charAt(0) || '')}
                  </span>
                )}
              </div>
              <div>
                <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  <span>Change Photo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProfilePicChange} 
                    className="hidden" 
                  />
                </label>
                <p className="text-sm text-gray-500 mt-1">Upload JPG, PNG or GIF</p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Personal Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <input 
                name="first_name" 
                value={form.first_name} 
                onChange={handleChange} 
                placeholder="First Name" 
                className="border p-2 rounded" 
              />
              <input 
                name="last_name" 
                value={form.last_name} 
                onChange={handleChange} 
                placeholder="Last Name" 
                className="border p-2 rounded" 
              />
              <select 
                name="gender" 
                value={form.gender} 
                onChange={handleChange} 
                className="border p-2 rounded"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <input 
                name="phone" 
                value={form.phone} 
                onChange={handleChange} 
                placeholder="Phone" 
                className="border p-2 rounded" 
              />
            </div>
          </div>

          {/* Employment Details */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Employment Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <input 
                name="rank" 
                value={form.rank} 
                onChange={handleChange} 
                placeholder="Rank / Designation" 
                className="border p-2 rounded" 
              />
              <input 
                name="department" 
                value={form.department} 
                onChange={handleChange} 
                placeholder="Department" 
                className="border p-2 rounded" 
              />
              <input 
                name="email" 
                value={form.email} 
                onChange={handleChange} 
                placeholder="Email" 
                className="border p-2 rounded" 
              />
            </div>
          </div>

          {/* Dates */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Employment Duration</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Joining Date</label>
                <input 
                  type="date" 
                  name="joining_date" 
                  value={form.joining_date} 
                  onChange={handleChange} 
                  className="border p-2 rounded w-full" 
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Retirement Date</label>
                <input 
                  type="date" 
                  name="retirement_date" 
                  value={form.retirement_date} 
                  onChange={handleChange} 
                  className="border p-2 rounded w-full" 
                />
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Account Status</h3>
            <select 
              name="status" 
              value={form.status} 
              onChange={handleChange} 
              className="border p-2 rounded w-full"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          {/* Password */}
          <div className="bg-gray-50 border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Change Password (Optional)</h3>
            <div className="relative">
              <input 
                name="password" 
                type={showPassword ? "text" : "password"}
                value={form.password} 
                onChange={handleChange} 
                placeholder="Enter new password to change" 
                className="border p-2 rounded w-full pr-10" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">Leave empty to keep current password</p>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>

          <button 
            onClick={updatePrincipal} 
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Update Principal
          </button>
        </div>

      </div>
    </div>
  );
};

export default PrincipalEditModal;
