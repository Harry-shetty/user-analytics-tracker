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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close mobile menu on Escape or resize to desktop
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    const onResize = () => window.innerWidth > 768 && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  function selectTab(id) {
    setView(id);
    setMenuOpen(false);
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
    setSpinning(true);
    setTimeout(() => setSpinning(false), 420);
  }

  function openPageHeatmap(pageUrl) {
    setHeatmapTargetUrl(pageUrl);
    setView('heatmap');
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="wrap header-inner">
          <button type="button" className="logo" onClick={() => selectTab('overview')}>
            CausalFunnel
          </button>

          <nav className="top-nav" aria-label="Primary navigation">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'nav-link active' : 'nav-link'}
                onClick={() => selectTab(t.id)}
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
            <button type="button" className="btn-refresh" onClick={handleRefresh} aria-label="Refresh data">
              <RefreshIcon className={spinning ? 'spin' : ''} width={15} height={15} />
              <span className="refresh-label">Refresh</span>
            </button>
            <button
              type="button"
              className={menuOpen ? 'hamburger open' : 'hamburger'}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              <span className="ham-line" />
              <span className="ham-line" />
              <span className="ham-line" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile animated drawer menu */}
      <div
        className={menuOpen ? 'mobile-backdrop open' : 'mobile-backdrop'}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <nav
        id="mobile-nav"
        className={menuOpen ? 'mobile-menu open' : 'mobile-menu'}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-menu-list">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'mobile-nav-item active' : 'mobile-nav-item'}
                onClick={() => selectTab(t.id)}
                tabIndex={menuOpen ? 0 : -1}
              >
                <Icon width={18} height={18} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mobile-menu-foot">
          <span className="status-dot live" style={{ background: live ? '#16a34a' : '#f59e0b' }} aria-hidden="true" />
          <span>{live ? 'Connected to MongoDB Atlas (Live)' : 'Reconnecting to API…'}</span>
        </div>
      </nav>

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
