import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api/`, // your Django DRF base URL
  // Removed default Content-Type to allow automatic setting for FormData
});

// Add a request interceptor to include auth token
api.interceptors.request.use(function (config) {
  // Get the token from localStorage
  const storedAuth = localStorage.getItem('auth');
  if (storedAuth) {
    try {
      const authData = JSON.parse(storedAuth);
      if (authData.access_token) {
        config.headers.Authorization = `Token ${authData.access_token}`;
        // Ensure the header is properly set
        console.log('Setting auth header:', `Token ${authData.access_token}`);
      } else {
        console.warn('No access token found in auth data');
      }
    } catch (err) {
      console.error('Error parsing stored auth data:', err);
      localStorage.removeItem('auth'); // Remove invalid auth data
    }
  } else {
    console.warn('No auth data found in localStorage');
  }
  return config;
});

// Add a response interceptor to handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Unauthorized request:', error.config.url);
        // Show a more user-friendly message
        error.message = 'Please login to access this feature';
      } else if (error.response.status === 403) {
        console.error('Forbidden request:', error.config.url);
        error.message = 'You do not have permission to perform this action';
      } else if (error.response.status === 400) {
        console.error('Bad request:', error.config.url, error.response.data);
        // Extract error message from response if available
        if (error.response.data && typeof error.response.data === 'object') {
          const firstErrorKey = Object.keys(error.response.data)[0];
          if (firstErrorKey) {
            error.message = `${firstErrorKey}: ${error.response.data[firstErrorKey]}`;
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (data: { username: string; password: string }) =>
    api.post("login/", data),
  register: (data: any) => api.post("register/", data),
  logout: () => {
    localStorage.removeItem('auth');
    delete api.defaults.headers.common['Authorization'];
  }
};

