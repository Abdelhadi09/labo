import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

// ─── Storage keys ─────────────────────────────────────────────────────────────
// Centralised so AuthContext and the interceptor use identical keys.
export const TOKEN_KEY         = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
/** @deprecated legacy key — removed on first successful refresh */
const LEGACY_TOKEN_KEY         = 'token';

// ─── Request interceptor — attach access token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
    ?? localStorage.getItem(LEGACY_TOKEN_KEY); // backwards-compat during rollout
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Silent refresh state ─────────────────────────────────────────────────────
// A single in-flight refresh promise shared across all concurrent 401 retries.
// Without this, three simultaneous expired-token requests would each try to
// refresh independently — causing two of them to receive a "token already used"
// error and log the user out.
let refreshPromise = null;

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem('user');
};

const redirectToLogin = () => {
  try {
    if (window.location.pathname !== '/login') window.location.href = '/login';
  } catch {
    window.location.href = '/login';
  }
};

/**
 * Attempt a silent token refresh.
 * Returns the new access token on success, throws on failure.
 */
const doRefresh = async () => {
  const rawRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!rawRefreshToken) throw new Error('No refresh token');

  // Use a plain fetch (not the axios instance) to avoid the response interceptor
  // wrapping this refresh call in an infinite retry loop.
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rawRefreshToken }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.code ?? 'REFRESH_FAILED');
  }

  const { accessToken, refreshToken: newRefreshToken } = await response.json();
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(newRefreshToken ? REFRESH_TOKEN_KEY : REFRESH_TOKEN_KEY, newRefreshToken);
  // Remove legacy key once rotated
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  return accessToken;
};

// ─── Response interceptor — handle 401s ───────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Only attempt a refresh for TOKEN_EXPIRED, and only once per request
    // (_retry flag prevents an infinite loop if the refresh itself 401s).
    if (
      err.response?.status === 401 &&
      err.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;

      try {
        // Coalesce concurrent refreshes into one network call
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
        }
        const newAccessToken = await refreshPromise;

        // Retry the original request with the new token
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear everything and force re-login
        clearSession();
        redirectToLogin();
        return Promise.reject(err);
      }
    }

    // Any other 401 (invalid token, reuse detected, etc.) — hard logout
    if (err.response?.status === 401 && !original._retry) {
      clearSession();
      redirectToLogin();
    }

    return Promise.reject(err);
  }
);

// ─── API surface ──────────────────────────────────────────────────────────────

export const authAPI = {
  workerLogin:   (credentials) => api.post('/auth/worker/login', credentials),
  clientSession: (token)       => api.post('/auth/client/session', { supabase_access_token: token }),
  refresh:       (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me:            ()             => api.get('/auth/me'),
  /**
   * Revoke current device's refresh token.
   * Pass { allDevices: true } to log out every session for this user.
   */
  logout: (refreshToken, allDevices = false) =>
    api.post('/auth/logout', { refreshToken, allDevices }),
};

export const profileAPI = {
  get:  ()     => api.get('/profile'),
  save: (data) => api.put('/profile', data),
};

export const servicesAPI = {
  list: () => api.get('/services'),
};

export const demandsAPI = {
  submit:  (formData) => api.post('/demands', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list:    (page = 1, limit = 20) => api.get('/demands', { params: { page, limit } }),
  get:     (id)       => api.get(`/demands/${id}`),
  process: (id, data) => api.put(`/demands/${id}/process`, data),
};

export const nurseAPI = {
  request:      (data)         => api.post('/nurse', data),
  list:         (page = 1, limit = 20) => api.get('/nurse', { params: { page, limit } }),
  updateStatus: (id, status)   => api.put(`/nurse/${id}/status`, { status }),
};

export default api;