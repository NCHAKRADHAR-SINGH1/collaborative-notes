import axios from 'axios';

export const getAuthToken = () => localStorage.getItem('authToken');

export const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
  window.dispatchEvent(new Event('auth-token-changed'));
};

export const clearAuthToken = () => {
  localStorage.removeItem('authToken');
  window.dispatchEvent(new Event('auth-token-changed'));
};

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload),
};

export const notesApi = {
  getMine: () => api.get('/notes/me'),
  create: (payload) => api.post('/notes', payload),
  update: (id, payload) => api.put(`/notes/${id}`, payload),
  remove: (id) => api.delete(`/notes/${id}`),
  createShare: (id, payload) => api.post(`/notes/${id}/share`, payload),
  revokeShare: (id) => api.delete(`/notes/${id}/share`),
  shareWithUser: (id, payload) => api.post(`/notes/${id}/share/user`, payload),
  revokeUserShare: (id, email) => api.delete(`/notes/${id}/share/user/${encodeURIComponent(email)}`),
  getShared: (shareCode) => api.get(`/notes/shared/${shareCode}`),
  getSharedWithMe: () => api.get('/notes/shared/me'),
  updateShared: (shareCode, payload) => api.put(`/notes/shared/${shareCode}`, payload),
  updateSharedWithMe: (id, payload) => api.put(`/notes/shared/me/${id}`, payload),
};

export default api;