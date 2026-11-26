export const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const fetchStats = () => get('/stats');
export const fetchSessions = () => get('/sessions');
export const fetchSessionEvents = (id) => get(`/sessions/${encodeURIComponent(id)}/events`);
export const fetchPages = () => get('/pages');
export const fetchHeatmap = (url) => get(`/heatmap?url=${encodeURIComponent(url)}`);

export async function clearHeatmap(url) {
  const qs = url ? `?url=${encodeURIComponent(url)}` : '';
  const res = await fetch(`${BASE}/heatmap${qs}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}
