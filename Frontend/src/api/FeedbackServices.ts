// src/services/feedbackService.ts
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api/hods/management/feedback";

function getTokenHeader() {
  const auth = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}");
  const token = auth?.access_token || auth?.token || null;
  return token ? { Authorization: `Token ${token}` } : {};
}

export const feedbackService = {
  list: async () => {
    const headers = getTokenHeader();
    const res = await axios.get(`http://127.0.0.1:8000/api/feedback/department/`, { headers });
    return res.data;
  },

  analytics: async () => {
    const headers = getTokenHeader();
    const res = await axios.get(`${API_BASE}/analytics/`, { headers });
    return res.data;
  },

  allow: async () => {
    const headers = getTokenHeader();
    const res = await axios.post(`${API_BASE}/allow/`, {}, { headers });
    return res.data;
  },

  disable: async () => {
    const headers = getTokenHeader();
    const res = await axios.post(`${API_BASE}/disable/`, {}, { headers });
    return res.data;
  },

  status: async (departmentId?: number | null) => {
    const headers = getTokenHeader();
    const url = departmentId 
      ? `${API_BASE}/status/${departmentId}/`
      : `${API_BASE}/status/0/`;

    const res = await axios.get(url, { headers });
    return res.data;
  },

  markReviewed: async (feedbackId: number) => {
    const headers = getTokenHeader();
    const res = await axios.patch(
      `http://127.0.0.1:8000/api/feedback/${feedbackId}/reviewed/`,
      {},
      { headers }
    );
    return res.data;
  }
};
