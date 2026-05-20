import axios from 'axios';

const API_URL = 'http://localhost:8000/api/';


// ✅ CREATE INSTANCE
const axiosInstance = axios.create({
  baseURL: API_URL,
});

// ✅ REQUEST INTERCEPTOR
axiosInstance.interceptors.request.use(
  (config: any) => {
    const storedAuth = localStorage.getItem('auth');

    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);

        if (authData.access_token) {
          config.headers.Authorization = `Token ${authData.access_token}`;
        }
      } catch (err) {
        console.error('Error parsing auth:', err);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ❌ REMOVE refresh logic (IMPORTANT)

export default axiosInstance;