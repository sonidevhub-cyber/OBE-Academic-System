import React, { useEffect, useState } from "react";
import axios from "axios";
import PrincipalEditModel from "./principalUI/PrincipalEditModel";
import PrincipalViewModel from "./principalUI/PrincipalViewModel";
import { XMarkIcon } from "@heroicons/react/24/outline";

const API_BASE = "http://localhost:8000/api/principal";

export default function AdminPrincipalManagement() {
  const [principals, setPrincipals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [tabFilter, setTabFilter] = useState<'all' | 'active' | 'retired'>('all');

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    employee_id: "",
    rank: "",
    gender: "",
    phone: "",
    joining_date: "",
    retirement_date: "",
    status: "active",
  });

  // ---------- FETCH PRINCIPALS ----------
  const fetchPrincipals = async () => {
    try {
      const res = await axios.get(`${API_BASE}/`);
      setPrincipals(res.data);
    } catch (error) {
      console.log("Error loading principals", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrincipals();
  }, []);

  // ---------- CREATE PRINCIPAL ----------
  const createPrincipal = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // If a profile picture is provided, send multipart/form-data
      if (profilePicFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, v as any);
        });
        fd.append('profile_pic', profilePicFile);
        await axios.post(`${API_BASE}/create/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await axios.post(`${API_BASE}/create/`, form);
      }

      alert("Principal Created Successfully");
      setShowForm(false);

      setForm({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        password: "",
        employee_id: "",
        rank: "",
        gender: "",
        phone: "",
        joining_date: "",
        retirement_date: "",
        status: "active",
      });

      fetchPrincipals();
      setProfilePicFile(null);
      setProfilePicPreview(null);
    } catch (err) {
      console.log("Create failed", err);
      alert("Failed to Create Principal");
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setProfilePicPreview(URL.createObjectURL(file));
  };

  // ---------- STATUS ACTIONS ----------
  const approve = async (id: number) => {
    await axios.patch(`${API_BASE}/activate/${id}/`, { status: "active" });
    fetchPrincipals();
  };

  const deactivate = async (id: number) => {
    const retirement_date = prompt("Enter Retirement Date (YYYY-MM-DD)");
    if (!retirement_date) return;

    await axios.patch(`${API_BASE}/deactivate/${id}/`, {
      status: "inactive",
      retirement_date,
    });

    fetchPrincipals();
  };

  const activate = async (id: number) => {
    await axios.patch(`${API_BASE}/activate/${id}/`, { status: "active" });
    fetchPrincipals();
  };
  const deletePrincipal = async (id: number) => {
  if (!window.confirm("Delete this principal permanently?")) return;
  await axios.delete(`${API_BASE}/delete/${id}/`);
  fetchPrincipals();
};
  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-3xl font-bold">Principal Management</h1>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              const activeCount = principals.filter(p => p.status === 'active').length;
              if (activeCount > 0) {
                alert('Cannot create new principal while an active principal exists. Please mark the active principal as retired first.');
                return;
              }
              setShowForm(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            + Create Principal
          </button>
        </div>
      </div>

      {/* Sub-tabs for Active / Retired - moved up and emphasized */}
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 bg-white/95 p-2 rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1 rounded text-sm font-medium border ${tabFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>
            All ({principals.length})
          </button>
          <button
            onClick={() => setTabFilter('active')}
            className={`px-3 py-1 rounded text-sm font-medium border ${tabFilter === 'active' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'}`}>
            Active ({principals.filter(p => p.status === 'active').length})
          </button>
          <button
            onClick={() => setTabFilter('retired')}
            className={`px-3 py-1 rounded text-sm font-medium border ${tabFilter === 'retired' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200'}`}>
            Retired ({principals.filter(p => p.status === 'inactive' || p.status === 'retired').length})
          </button>
        </div>
      </div>

      <p className="text-gray-600 mb-6">
        Admin can create, activate, deactivate & manage principal records.
      </p>

      {loading && <p>Loading...</p>}

      {/* ========== PRINCIPAL CARDS ========== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {principals
          .filter((p: any) => {
            if (tabFilter === 'all') return true;
            if (tabFilter === 'active') return p.status === 'active';
            // treat both 'inactive' and 'retired' as retired records
            return p.status === 'inactive' || p.status === 'retired';
          })
          .map((p: any) => (
          <div
            key={p.id}
            className={`rounded-2xl border shadow-sm p-5 transition
              ${p.status === "inactive" ? "bg-gray-100" : "bg-white"}`}
          >
              {/* profile picture */}
              {p.profile_pic && (
                <img src={p.profile_pic} alt="profile" className="w-20 h-20 rounded-full mb-3 object-cover" />
              )}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">
                {p.first_name} {p.last_name}
              </h2>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold
                  ${
                    p.status === "active"
                      ? "bg-green-200 text-green-800"
                      : p.status === "inactive"
                      ? "bg-red-200 text-red-800"
                      : "bg-yellow-200 text-yellow-800"
                  }`}
              >
                {p.status.toUpperCase()}
              </span>
            </div>

            <p className="text-sm text-gray-600">
              <b>Employee ID:</b> {p.employee_id}
            </p>

            <p className="text-sm text-gray-600">
              <b>Email:</b> {p.email}
            </p>

            {p.department && (
              <p className="text-sm text-gray-600">
                <b>Department:</b> {p.department}
              </p>
            )}

            {p.rank && (
              <p className="text-sm text-gray-600">
                <b>Rank:</b> {p.rank}
              </p>
            )}

            {p.status === "inactive" && (
              <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded-xl">
                <p className="text-sm text-red-700">
                  <b>Retirement Date:</b> {p.retirement_date || "—"}
                </p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="mt-4 flex gap-2">

              {p.status === "pending" && (
                <button
                  onClick={() => approve(p.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl"
                >
                  Approve
                </button>
              )}

              {p.status === "active" && (
                <button
                  onClick={() => deactivate(p.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl"
                >
                  Mark Inactive
                </button>
              )}

              {p.status === "inactive" && (
                <button
                  onClick={() => activate(p.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl"
                >
                  Reactivate
                </button>
              )}

              <button
                onClick={() => { setSelectedPrincipal(p); setViewModal(true); }}
                className="bg-gray-700 text-white px-4 py-2 rounded-xl"
              >
                View Profile
              </button>

              <button
                onClick={() => { setSelectedPrincipal(p); setEditModal(true); }}
                className="bg-yellow-500 text-white px-4 py-2 rounded-xl"
              >
                Edit
              </button>
              <button
  onClick={() => deletePrincipal(p.id)}
  className="bg-red-700 text-white px-4 py-2 rounded-xl"
>
  Delete
</button>

            </div>
          </div>
        ))}
      </div>
      
{/* ===================== CREATE PRINCIPAL MODAL ===================== */}
{showForm && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">

    {/* MAIN MODAL CARD */}
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl
                    max-h-[92vh] flex flex-col">

      {/* ====== STICKY HEADER ====== */}
      <div className="sticky top-0 bg-white border-b px-6 py-3 z-10 flex justify-between">
        <h2 className="text-xl font-bold">Create Principal</h2>
        <button
  onClick={() => setShowForm(false)}
  className="p-1 rounded-full hover:bg-gray-200"
>
  <XMarkIcon className="w-6 h-6 text-gray-600" />
</button>
      </div>

      {/* ====== SCROLLABLE FORM BODY ====== */}
      <form onSubmit={createPrincipal}
            className="overflow-y-auto px-6 py-4 space-y-4">

        {/* PERSONAL INFO */}
        <div className="bg-gray-50 border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Personal Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <input className="border p-2 rounded" placeholder="First Name"
              value={form.first_name}
              onChange={e => setForm({ ...form, first_name: e.target.value })}
              required />

            <input className="border p-2 rounded" placeholder="Last Name"
              value={form.last_name}
              onChange={e => setForm({ ...form, last_name: e.target.value })}
              required />

            <select className="border p-2 rounded"
              value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            <input className="border p-2 rounded" placeholder="Phone Number"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
            <div>
              <label className="text-sm">Profile Picture</label>
              <input type="file" accept="image/*" onChange={handleProfilePicChange} className="mt-1" />
              {profilePicPreview && (
                <img src={profilePicPreview} alt="preview" className="w-20 h-20 rounded-full mt-2 object-cover" />
              )}
            </div>
          </div>
        </div>

        {/* LOGIN */}
        <div className="bg-gray-50 border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Login Credentials</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <input className="border p-2 rounded" placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required />

            <input className="border p-2 rounded" placeholder="Username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required />

            <input className="border p-2 rounded" type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required />
          </div>
        </div>

        {/* EMPLOYMENT */}
        <div className="bg-gray-50 border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Employment Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <input className="border p-2 rounded" placeholder="Employee ID"
              value={form.employee_id}
              onChange={e => setForm({ ...form, employee_id: e.target.value })} />

            

            <input className="border p-2 rounded" placeholder="Rank / Designation"
              value={form.rank}
              onChange={e => setForm({ ...form, rank: e.target.value })} />
          </div>
        </div>

        {/* DATES */}
        <div className="bg-gray-50 border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Employment Duration</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div>
              <label className="text-sm text-gray-600">Joining Date</label>
              <input type="date" className="border p-2 rounded w-full"
                value={form.joining_date}
                onChange={e => setForm({ ...form, joining_date: e.target.value })} />
            </div>

            <div>
              <label className="text-sm text-gray-600">Retirement Date</label>
              <input type="date" className="border p-2 rounded w-full"
                value={form.retirement_date}
                onChange={e => setForm({ ...form, retirement_date: e.target.value })} />
            </div>
          </div>
        </div>

        {/* STATUS */}
        <div className="bg-gray-50 border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Account Status</h3>

          <select className="border p-2 rounded w-full"
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </form>

      {/* ====== STICKY FOOTER BUTTONS ====== */}
      <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-3">
        <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">
          Cancel
        </button>

        <button type="submit"
          onClick={createPrincipal}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white">
          Create Principal
        </button>
      </div>

    </div>
  </div>
)}
      {/* ===================== VIEW PROFILE MODAL ===================== */}
      {viewModal && selectedPrincipal && (
        <PrincipalViewModel
          principal={selectedPrincipal}
          onClose={() => setViewModal(false)}
        />
      )}

      {/* ===================== EDIT MODAL ===================== */}
      {editModal && selectedPrincipal && (
        <PrincipalEditModel
          principal={selectedPrincipal}
          onClose={() => setEditModal(false)}
          onUpdated={fetchPrincipals}
        />
      )}

    </div>
  );
}