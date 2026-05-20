import axiosInstance from './axiosInstance';

export const api = axiosInstance;

export const authService = {
  login: (data: { identifier: string; password: string }) =>
    api.post("login/", data),
  register: (data: any) => api.post("register/", data),
  logout: () => {
    localStorage.removeItem('auth');
    delete api.defaults.headers.common['Authorization'];
  }
};