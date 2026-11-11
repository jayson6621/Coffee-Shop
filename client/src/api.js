// All backend calls use the Fetch API. The backend URL comes from an environment variable.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const money = (n) => `M${Number(n).toFixed(2)}`;
export const getToken = () => localStorage.getItem('staffToken');
export const setToken = (t) => (t ? localStorage.setItem('staffToken', t) : localStorage.removeItem('staffToken'));

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${getToken()}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) { setToken(null); window.dispatchEvent(new Event('staff-logout')); }
    const detail = Array.isArray(data.details) ? `: ${data.details.join('; ')}` : '';
    throw new Error((data.error || `Request failed (${res.status})`) + detail);
  }
  return data;
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  menu: () => request('/api/menu'),
  addMenu: (item) => request('/api/menu', { method: 'POST', body: item, auth: true }),
  updateMenu: (id, item) => request(`/api/menu/${id}`, { method: 'PUT', body: item, auth: true }),
  deleteMenu: (id) => request(`/api/menu/${id}`, { method: 'DELETE', auth: true }),
  placeOrder: (order) => request('/api/orders', { method: 'POST', body: order }),
  orders: () => request('/api/orders', { auth: true }),
  setStatus: (id, status) => request(`/api/orders/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),
  summary: () => request('/api/orders/summary', { auth: true }),
};
