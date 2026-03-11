import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

function tokenHeader() {
  const auth =
    JSON.parse(sessionStorage.getItem("auth") || "{}") ||
    JSON.parse(localStorage.getItem("auth") || "{}");

  const token = auth?.access || auth?.token;

  return token ? { Authorization: `Token ${token}` } : {};
}

// 🔹 Principal Payload Type
export interface PrincipalPayload {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password: string;
  employee_id?: string;
  department?: string | number;
  rank?: string;
}

export const principalService = {

  // 🔹 List all principals
  list: async () => {
    const res = await axios.get(`${API_BASE}/principal/`, {
      headers: tokenHeader(),
    });
    return res.data;
  },

  // 🔹 ADMIN creates principal
  register: async (payload: PrincipalPayload) => {
    const res = await axios.post(
      `${API_BASE}/principal/create/`,
      payload,
      { headers: tokenHeader() }
    );
    return res.data;
  },

  // 🔹 Activate Principal
  activate: async (id: number) => {
    const res = await axios.put(
      `${API_BASE}/principal/activate/${id}/`,
      {},
      { headers: tokenHeader() }
    );
    return res.data;
  },

  // 🔹 Deactivate Principal
  deactivate: async (id: number) => {
    const res = await axios.put(
      `${API_BASE}/principal/deactivate/${id}/`,
      {},
      { headers: tokenHeader() }
    );
    return res.data;
  },

  // 🔹 Mark as Retired
  retire: async (id: number) => {
    const res = await axios.put(
      `${API_BASE}/principal/retire/${id}/`,
      {},
      { headers: tokenHeader() }
    );
    return res.data;
  },
};
