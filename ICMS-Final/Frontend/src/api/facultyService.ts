// src/services/facultyService.ts
import axios from "axios";

/* =========================
   BASE URL
========================= */
const API_BASE = "http://127.0.0.1:8000/api/faculty";

/* =========================
   TOKEN HEADER
========================= */
function getTokenHeader() {
  const auth = JSON.parse(
    sessionStorage.getItem("auth") ||
    localStorage.getItem("auth") ||
    "{}"
  );

  const token = auth?.access_token || auth?.token || null;

  return token ? { Authorization: `Token ${token}` } : {};
}

/* =========================
   FACULTY SERVICE
========================= */
export const facultyService = {

  /* ===== FACULTY CRUD ===== */

  list: async () => {
    const headers = getTokenHeader();
    const res = await axios.get(`${API_BASE}/faculties/`, { headers });
    return res.data;
  },

  create: async (data: {
    name: string;
    description?: string;
  }) => {
    const headers = getTokenHeader();
    const res = await axios.post(`${API_BASE}/faculties/`, data, { headers });
    return res.data;
  },

  update: async (
    facultyId: number,
    data: { name?: string; description?: string }
  ) => {
    const headers = getTokenHeader();
    const res = await axios.put(
      `${API_BASE}/faculties/${facultyId}/`,
      data,
      { headers }
    );
    return res.data;
  },

  delete: async (facultyId: number) => {
    const headers = getTokenHeader();
    const res = await axios.delete(
      `${API_BASE}/faculties/${facultyId}/`,
      { headers }
    );
    return res.data;
  },

  /* ===== FACULTY ↔ DEPARTMENT ===== */

  assignDepartment: async (data: {
    faculty_id: number;
    department_id: number;
  }) => {
    const headers = getTokenHeader();
    const res = await axios.post(
      `${API_BASE}/faculty-departments/`,
      data,
      { headers }
    );
    return res.data;
  },

  removeDepartment: async (facultyDepartmentId: number) => {
    const headers = getTokenHeader();
    const res = await axios.delete(
      `${API_BASE}/faculty-departments/${facultyDepartmentId}/`,
      { headers }
    );
    return res.data;
  },
};
