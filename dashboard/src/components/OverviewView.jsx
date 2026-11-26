import { useEffect, useState } from 'react';
import { fetchStats } from '../api.js';
import { ArrowRightIcon } from './Icons.jsx';

const COLORS = { page_view: '#9a3412', click: '#d97706' };

function StatCard({ label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value tabular">{value.toLocaleString()}</div>
      {detail && <div className="stat-detail tabular">{detail}</div>}
    </div>
  );
}

function DonutChart({ pageViews, clicks }) {
  const total = pageViews + clicks;
  const R = 52;
  const C = 2 * Math.PI * R;
  const viewLen = total ? (pageViews / total) * C : 0;
  const clickLen = total ? (clicks / total) * C : 0;
  const viewPct = total ? Math.round((pageViews / total) * 100) : 0;
  const clickPct = total ? 100 - viewPct : 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 144 144" className="donut" role="img" aria-label={`Page views ${viewPct}%, clicks ${clickPct}%`}>
        <circle cx="72" cy="72" r={R} fill="none" stroke="#eceee9" strokeWidth="14" />
        {total > 0 && (
          <>
            <circle
              cx="72"
              cy="72"
              r={R}
              fill="none"
              stroke={COLORS.page_view}
              strokeWidth="14"
              strokeDasharray={`${viewLen} ${C - viewLen}`}
              transform="rotate(-90 72 72)"
            />
            <circle
              cx="72"
              cy="72"
              r={R}
              fill="none"
              stroke={COLORS.click}
              strokeWidth="14"
              strokeDasharray={`${clickLen} ${C - clickLen}`}
              strokeDashoffset={-viewLen}
              transform="rotate(-90 72 72)"
            />
          </>
        )}
        <text x="72" y="69" textAnchor="middle" className="donut-total tabular">{total.toLocaleString()}</text>
        <text x="72" y="86" textAnchor="middle" className="donut-sub">total events</text>
      </svg>

      <ul className="legend">
        <li>
          <span className="legend-left">
            <span className="swatch" style={{ background: COLORS.page_view }} />
            <span>Page views</span>
          </span>
          <span className="legend-right tabular">
            <strong>{pageViews.toLocaleString()}</strong>
            <span className="muted">{viewPct}%</span>
          </span>
        </li>
        <li>
          <span className="legend-left">
            <span className="swatch" style={{ background: COLORS.click }} />
            <span>Clicks</span>
          </span>
          <span className="legend-right tabular">
            <strong>{clicks.toLocaleString()}</strong>
            <span className="muted">{clickPct}%</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

function BarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const H = 148;
  const W = 440;
  const padLeft = 28;
  const chartW = W - padLeft;
  const slot = chartW / data.length;
  const barW = Math.min(34, slot * 0.52);

  return (
    <div className="bar-wrap">
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="bar-chart" role="img" aria-label="Events over the last 7 days">
        {[0, 0.5, 1].map((f) => {
          const y = H - f * H;
          const label = Math.round(max * f);
          return (
            <g key={f}>
              <line x1={padLeft} x2={W} y1={y} y2={y} stroke="#eceee9" />
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
        Could not load overview metrics ({error}). Make sure the backend API is running on port 5001.
      </div>
    );
  }
  if (!stats) return <div className="empty-state">Loading metrics…</div>;

  const totalEvents = stats.page_views + stats.clicks;
  const avgPerSession = stats.total_sessions ? (totalEvents / stats.total_sessions).toFixed(1) : '0.0';
  const clicksPerView = stats.page_views ? (stats.clicks / stats.page_views).toFixed(1) : '0.0';

  return (
    <div className="overview">
      <div className="stat-grid">
        <StatCard label="Sessions" value={stats.total_sessions} detail={`${avgPerSession} events / session`} />
        <StatCard label="Total events" value={totalEvents} detail="All tracked interactions" />
        <StatCard label="Page views" value={stats.page_views} detail={`${stats.top_pages.length} tracked URLs`} />
        <StatCard label="Clicks" value={stats.clicks} detail={`${clicksPerView} clicks / view`} />
      </div>

      <div className="chart-grid">
        <section className="panel">
          <h2 className="panel-title">Event mix</h2>
          <DonutChart pageViews={stats.page_views} clicks={stats.clicks} />
        </section>
        <section className="panel">
          <h2 className="panel-title">Activity, last 7 days</h2>
          <BarChart data={stats.events_per_day} />
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Top pages</h2>
        <TopPages pages={stats.top_pages} onInspectHeatmap={onInspectHeatmap} />
      </section>
    </div>
  );
}
