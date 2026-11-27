import { useEffect, useState } from 'react';
import { fetchStats } from '../api.js';
import { ArrowRightIcon } from './Icons.jsx';

const COLORS = { page_view: '#9a3412', click: '#d97706' };

function MetricCell({ label, value, detail, tone }) {
  return (
    <div className="metric-cell">
      <div className="metric-head">
        {tone && <span className="metric-dot" style={{ background: tone }} aria-hidden="true" />}
        <span className="stat-label">{label}</span>
      </div>
      <div className="metric-value tabular">{value.toLocaleString()}</div>
      <div className="stat-detail tabular">{detail}</div>
    </div>
  );
}

function BarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const H = 180;
  const W = 760;
  const padLeft = 32;
  const chartW = W - padLeft;
  const slot = chartW / data.length;
  const barW = Math.min(48, slot * 0.42);

  return (
    <div className="bar-wrap">
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="bar-chart" role="img" aria-label="Events over the last 7 days">
        {[0, 0.5, 1].map((f) => {
          const y = H - f * H;
          const label = Math.round(max * f);
          return (
            <g key={f}>
              <line x1={padLeft} x2={W} y1={y} y2={y} stroke="#ece6dc" />
              <text x={padLeft - 6} y={y + 4} textAnchor="end" className="axis tabular">{label}</text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const h = d.count ? Math.max(4, (d.count / max) * H) : 3;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const isHover = hovered === i;
          return (
            <g
              key={d.date}
              className="bar-group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x={padLeft + i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                rx="4"
                fill={isHover ? '#7c2d12' : '#9a3412'}
                opacity={d.count ? 1 : 0.16}
                className="bar-rect"
              />
              <text x={x + barW / 2} y={H + 19} textAnchor="middle" className={isHover ? 'axis active' : 'axis'}>
                {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="bar-caption tabular">
        {hovered !== null ? (
          <span>
            <strong>{data[hovered].date}</strong> — {data[hovered].count.toLocaleString()} events
          </span>
        ) : (
          <span className="muted">Hover a day to inspect daily volume</span>
        )}
      </div>
    </div>
  );
}

function TopPages({ pages, onInspectHeatmap }) {
  if (!pages.length) return <div className="empty-state">No tracked pages yet. Open the demo store to start collecting events.</div>;
  const max = pages[0].count || 1;
  return (
    <ul className="top-pages">
      {pages.map((p) => (
        <li key={p.page_url} className="top-page-item">
          <div className="top-row">
            <span className="url mono" title={p.page_url}>{p.page_url}</span>
            <div className="top-actions">
              <strong className="tabular">{p.count.toLocaleString()}</strong>
              <button
                type="button"
                className="link-btn"
                onClick={() => onInspectHeatmap(p.page_url)}
                title="Open click heatmap for this page"
              >
                <span>Heatmap</span>
                <ArrowRightIcon width={13} height={13} />
              </button>
            </div>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(p.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function OverviewView({ refreshKey, onInspectHeatmap }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetchStats()
      .then((s) => !cancelled && setStats(s))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) {
    return (
      <div className="error-banner" role="alert">
        Could not load overview metrics ({error}). Check that the backend API is reachable.
      </div>
    );
  }
  if (!stats) return <div className="empty-state">Loading metrics…</div>;

  const totalEvents = stats.page_views + stats.clicks;
  const avgPerSession = stats.total_sessions ? (totalEvents / stats.total_sessions).toFixed(1) : '0.0';
  const clicksPerView = stats.page_views ? (stats.clicks / stats.page_views).toFixed(1) : '0.0';
  const viewShare = totalEvents ? Math.round((stats.page_views / totalEvents) * 100) : 50;
  const desktopCount = stats.desktop_sessions ?? stats.total_sessions;
  const mobileCount = stats.mobile_sessions ?? 0;

  return (
    <div className="overview">
      <section className="metrics-bento" aria-label="Key metrics">
        <div className="metric-hero">
          <div className="metric-hero-top">
            <span className="metric-hero-label">Total events</span>
            <span className="metric-hero-tag">Event mix</span>
          </div>
          <div className="metric-hero-value tabular">{totalEvents.toLocaleString()}</div>
          <div className="metric-hero-foot">
            <div className="ratio-track" aria-hidden="true">
              <div className="ratio-views" style={{ width: `${viewShare}%` }} />
            </div>
            <div className="ratio-labels tabular">
              <span>{viewShare}% page views</span>
              <span>{100 - viewShare}% clicks</span>
            </div>
          </div>
        </div>

        <div className="metric-strip">
          <MetricCell
            label="Sessions"
            value={stats.total_sessions}
            detail={`${desktopCount} laptop · ${mobileCount} mobile (${avgPerSession}/session)`}
            tone="#1c1917"
          />
          <MetricCell label="Page views" value={stats.page_views} detail={`${stats.top_pages.length} tracked URLs`} tone={COLORS.page_view} />
          <MetricCell label="Clicks" value={stats.clicks} detail={`${clicksPerView} clicks / view`} tone={COLORS.click} />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Activity, last 7 days</h2>
        <BarChart data={stats.events_per_day} />
      </section>

      <section className="panel">
        <h2 className="panel-title">Top pages</h2>
        <TopPages pages={stats.top_pages} onInspectHeatmap={onInspectHeatmap} />
      </section>
    </div>
  );
}
