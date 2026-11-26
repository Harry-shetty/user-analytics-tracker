import { useEffect, useState } from 'react';
import OverviewView from './components/OverviewView.jsx';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';
import { RefreshIcon } from './components/Icons.jsx';
import { BASE } from './api.js';

const TABS = [
  { id: 'overview', label: 'Overview', title: 'Analytics overview', subtitle: 'Traffic volume, event mix, and top pages.' },
  { id: 'sessions', label: 'Sessions', title: 'User sessions', subtitle: 'Inspect chronological journeys for every visitor.' },
  { id: 'heatmap', label: 'Heatmap', title: 'Click heatmap', subtitle: 'Normalized click density overlaid on tracked pages.' },
];

export default function App() {
  const [view, setView] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [heatmapTargetUrl, setHeatmapTargetUrl] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [live, setLive] = useState(false);

  const activeTab = TABS.find((t) => t.id === view) || TABS[0];

  // Subscribe to real-time SSE updates whenever an event is saved to MongoDB Atlas
  useEffect(() => {
    const source = new EventSource(`${BASE}/events/stream`);
    let timer = null;

    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = () => {
      setLive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setRefreshKey((k) => k + 1), 150);
    };

    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, []);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
    setSpinning(true);
    setTimeout(() => setSpinning(false), 420);
  }

  function openPageHeatmap(pageUrl) {
    setHeatmapTargetUrl(pageUrl);
    setView('heatmap');
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="wrap header-inner">
          <button type="button" className="logo" onClick={() => setView('overview')}>
            CausalFunnel
          </button>

          <nav className="top-nav" aria-label="Primary navigation">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'nav-link active' : 'nav-link'}
                onClick={() => setView(t.id)}
                aria-current={view === t.id ? 'page' : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <span className="status-pill" title="Real-time SSE connection to MongoDB Atlas">
              <span className={live ? 'status-dot live' : 'status-dot'} aria-hidden="true" />
              <span>{live ? 'Atlas Live' : 'Reconnecting'}</span>
            </span>
            <button type="button" className="btn-refresh" onClick={handleRefresh}>
              <RefreshIcon className={spinning ? 'spin' : ''} width={15} height={15} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="wrap content">
        <div className="page-head">
          <h1 className="page-title">{activeTab.title}</h1>
          <p className="page-subtitle">{activeTab.subtitle}</p>
        </div>

        {view === 'overview' && <OverviewView refreshKey={refreshKey} onInspectHeatmap={openPageHeatmap} />}
        {view === 'sessions' && <SessionsView refreshKey={refreshKey} />}
        {view === 'heatmap' && <HeatmapView refreshKey={refreshKey} initialUrl={heatmapTargetUrl} />}
      </main>
    </div>
  );
}
