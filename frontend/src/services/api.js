import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        if (window.location.pathname !== '/login') window.location.href = '/login';
      } catch (e) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  workerLogin: (credentials) => api.post('/auth/worker/login', credentials),
  clientSession: (token) => api.post('/auth/client/session', { supabase_access_token: token }),
  me: () => api.get('/auth/me'),
};

export const profileAPI = {
  get: () => api.get('/profile'),
  save: (data) => api.put('/profile', data),
};

export const servicesAPI = {
  list: () => api.get('/services'),
};

export const demandsAPI = {
  submit:  (formData) => api.post('/demands', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // page: 1-based, limit: items per page
  list:    (page = 1, limit = 20) => api.get('/demands', { params: { page, limit } }),
  get:     (id) => api.get(`/demands/${id}`),
  process: (id, data) => api.put(`/demands/${id}/process`, data),
};

export const nurseAPI = {
  request:      (data) => api.post('/nurse', data),
  // page: 1-based, limit: items per page
  list:         (page = 1, limit = 20) => api.get('/nurse', { params: { page, limit } }),
  updateStatus: (id, status) => api.put(`/nurse/${id}/status`, { status }),
};

export default api;