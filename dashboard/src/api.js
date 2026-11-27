const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').trim().replace(/\/+$/, '');
export const BASE = raw.endsWith('/api') ? raw : `${raw}/api`;

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const fetchStats = () => get('/stats');
export const fetchSessions = () => get('/sessions');
export const fetchSessionEvents = (id) => get(`/sessions/${encodeURIComponent(id)}/events`);
export const fetchPages = () => get('/pages');
export const fetchHeatmap = (url, device) => {
  const params = new URLSearchParams({ url });
  if (device) params.set('device', device);
  return get(`/heatmap?${params.toString()}`);
};

export async function clearHeatmap(url, device) {
  const params = new URLSearchParams();
  if (url) params.set('url', url);
  if (device) params.set('device', device);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE}/heatmap${qs}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
