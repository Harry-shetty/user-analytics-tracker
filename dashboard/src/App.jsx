import { useEffect, useState } from 'react';
import OverviewView from './components/OverviewView.jsx';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';
import { OverviewIcon, SessionsIcon, HeatmapIcon, RefreshIcon } from './components/Icons.jsx';
import { BASE } from './api.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: OverviewIcon, title: 'Analytics overview', subtitle: 'Traffic volume, event mix, and top pages.' },
  { id: 'sessions', label: 'Sessions', icon: SessionsIcon, title: 'User sessions', subtitle: 'Inspect chronological journeys for every visitor.' },
  { id: 'heatmap', label: 'Heatmap', icon: HeatmapIcon, title: 'Click heatmap', subtitle: 'Normalized click density overlaid on tracked pages.' },
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
    <div className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-bar" />
            <span className="brand-bar short" />
          </span>
          <span className="brand-name">CausalFunnel</span>
        </div>

        <nav className="nav-list">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(t.id)}
                aria-current={view === t.id ? 'page' : undefined}
              >
                <Icon />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="status-pill">
            <span className={live ? 'status-dot live' : 'status-dot'} aria-hidden="true" />
            <span>{live ? 'Atlas Live' : 'Reconnecting…'}</span>
          </div>
          <div className="sidebar-meta mono">SSE</div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <h1 className="page-title">{activeTab.title}</h1>
            <p className="page-subtitle">{activeTab.subtitle}</p>
          </div>
          <button type="button" className="btn-refresh" onClick={handleRefresh}>
            <RefreshIcon className={spinning ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </header>

        <main className="content">
          {view === 'overview' && <OverviewView refreshKey={refreshKey} onInspectHeatmap={openPageHeatmap} />}
          {view === 'sessions' && <SessionsView refreshKey={refreshKey} />}
          {view === 'heatmap' && <HeatmapView refreshKey={refreshKey} initialUrl={heatmapTargetUrl} />}
        </main>
      </div>
    </div>
  );
}
