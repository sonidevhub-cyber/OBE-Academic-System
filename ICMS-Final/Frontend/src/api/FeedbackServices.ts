import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/feedback";

// ==============================
// 🔐 AUTH HEADER
// ==============================
function getTokenHeader() {
  const auth = JSON.parse(
    sessionStorage.getItem("auth") ||
    localStorage.getItem("auth") ||
    "{}"
  );

  const token = auth?.access_token || auth?.token || null;

  return token ? { Authorization: `Token ${token}` } : {};
}

// ==============================
// 🚀 FEEDBACK SERVICE (SMART FINAL)
// ==============================
export const feedbackService = {

  // 🔴 ENABLE (HOD)
  enable: async (batch: string) => {
    const res = await axios.post(
      `${BASE_URL}/enable/`,
      { batch },
      { headers: getTokenHeader() }
    );
    return res.data;
  },

  // 🔴 DISABLE (HOD)
  disable: async (batch: string) => {
    const res = await axios.post(
      `${BASE_URL}/disable/`,
      { batch },
      { headers: getTokenHeader() }
    );
    return res.data;
  },

  // 🔵 STATUS (HOD + STUDENT BOTH)
  status: async (batch?: string) => {
    const url = batch
      ? `${BASE_URL}/status/?batch=${batch}`   // HOD
      : `${BASE_URL}/status/`;                // Student

    const res = await axios.get(url, {
      headers: getTokenHeader()
    });

    return res.data;
  },

  // 🟢 QUESTIONS (Student)
  getQuestions: async () => {
    const res = await axios.get(
      `${BASE_URL}/questions/`,
      { headers: getTokenHeader() }
    );
    return res.data;
  },

  // 🟢 SUBMIT
  submitFeedback: async (responses: any[]) => {
    const res = await axios.post(
      `${BASE_URL}/submit/`,
      responses,   // ✅ FIX (no wrapper)
      { headers: getTokenHeader() }
    );
    return res.data;
  },

  // 🟡 COMPARISON
// 🟡 COMPARISON
getComparison: async (batchId: string) => {
  const res = await axios.get(
    `${BASE_URL}/compare/?batch=${batchId}`,
    {
      headers: getTokenHeader(),
    }
  );

  return res.data;
},

compare: async (batchId: string) => {
  return await feedbackService.getComparison(batchId);
},

// 🟢 INDIRECT REPORT
getIndirectReport: async (batchId: string) => {
  const res = await axios.get(
    `${BASE_URL}/indirect-report/?batch=${batchId}`,
    {
      headers: getTokenHeader(),
    }
  );

  return res.data;
},
 
};