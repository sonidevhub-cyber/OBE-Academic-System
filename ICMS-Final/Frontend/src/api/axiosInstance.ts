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
    console.log('[Axios Request]:', config.method?.toUpperCase(), config.baseURL + config.url, { params: config.params });
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => {
    console.log('[Axios Response]:', response.config.method?.toUpperCase(), response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('[Axios Error]:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// ❌ REMOVE refresh logic (IMPORTANT)

export default axiosInstance;