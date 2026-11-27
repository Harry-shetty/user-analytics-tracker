import { useEffect, useState } from 'react';
import { fetchSessions, fetchSessionEvents } from '../api.js';
import { SearchIcon, CopyIcon, CheckIcon, EyeIcon, CursorIcon, LaptopIcon, PhoneIcon } from './Icons.jsx';

const fmtTime = (d) =>
  new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function SessionsView({ refreshKey }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessions.length) setLoading(true);
    setError('');
    fetchSessions()
      .then((data) => {
        if (cancelled) return;
        setSessions(data);
        setSelected((cur) => (cur && data.some((s) => s.session_id === cur) ? cur : data[0]?.session_id || null));
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selected) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    if (!events.length) setLoadingEvents(true);
    fetchSessionEvents(selected)
      .then((data) => !cancelled && setEvents(data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingEvents(false));
    return () => {
      cancelled = true;
    };
  }, [selected, refreshKey]);

  const filteredSessions = query.trim()
    ? sessions.filter((s) => s.session_id.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const visibleEvents = typeFilter === 'all' ? events : events.filter((e) => e.event_type === typeFilter);

  function copySessionId() {
    if (!selected || !navigator.clipboard) return;
    navigator.clipboard.writeText(selected).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="split">
      <section className="panel list-panel">
        <div className="panel-head">
          <h2 className="panel-title">
            Sessions <span className="count-pill tabular">{filteredSessions.length}</span>
          </h2>
        </div>

        <div className="search-box">
          <SearchIcon className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by session ID…"
            aria-label="Filter sessions by ID"
          />
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading && <div className="empty-state">Loading sessions…</div>}
        {!loading && !filteredSessions.length && !error && (
          <div className="empty-state">
            {sessions.length ? 'No matching sessions.' : 'No sessions recorded yet. Visit the demo store and click around.'}
          </div>
        )}

        <ul className="session-list">
          {filteredSessions.map((s) => {
            const isMobile = s.device_type === 'mobile';
            return (
              <li key={s.session_id}>
                <button
                  type="button"
                  className={s.session_id === selected ? 'session-item active' : 'session-item'}
                  onClick={() => setSelected(s.session_id)}
                >
                  <div className="session-top">
                    <span className="mono sid" title={s.session_id}>{s.session_id}</span>
                    <span className="event-count tabular">{s.event_count}</span>
                  </div>
                  <div className="session-foot">
                    <span className="session-meta tabular">Last active {fmtTime(s.last_seen)}</span>
                    <span className={isMobile ? 'device-pill mobile' : 'device-pill desktop'}>
                      {isMobile ? <PhoneIcon width={11} height={11} /> : <LaptopIcon width={11} height={11} />}
                      <span>{isMobile ? 'Mobile' : 'Laptop'}</span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel timeline-panel">
        <div className="panel-head wrap-head">
          <div>
            <h2 className="panel-title">User journey</h2>
            {selected && (
              <div className="selected-id-row">
                <span className="mono small muted">{selected}</span>
                <button type="button" className="icon-btn" onClick={copySessionId} title="Copy session ID">
                  {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {selected && (
            <div className="filter-group" role="group" aria-label="Filter events by type">
              {[
                { id: 'all', label: `All (${events.length})` },
                { id: 'page_view', label: 'Views' },
                { id: 'click', label: 'Clicks' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={typeFilter === f.id ? 'filter-btn active' : 'filter-btn'}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selected && <div className="empty-state">Select a session from the list to inspect its timeline.</div>}
        {selected && loadingEvents && <div className="empty-state">Loading journey…</div>}
        {selected && !loadingEvents && !visibleEvents.length && (
          <div className="empty-state">No events match this filter.</div>
        )}

        <ol className="timeline">
          {visibleEvents.map((ev) => (
            <li key={ev._id} className="tl-item">
              <span className={`tl-node ${ev.event_type}`} aria-hidden="true">
                {ev.event_type === 'page_view' ? <EyeIcon width={12} height={12} /> : <CursorIcon width={12} height={12} />}
              </span>
              <div className="tl-body">
                <div className="tl-head">
                  <span className={`badge ${ev.event_type}`}>
                    {ev.event_type === 'page_view' ? 'Page view' : 'Click'}
                  </span>
                  <span className="muted small tabular">{fmtTime(ev.timestamp)}</span>
                </div>
                <div className="tl-url mono" title={ev.page_url}>{ev.page_url}</div>
                {ev.event_type === 'click' && ev.x != null && (
                  <div className="tl-coords mono tabular">
                    Click at ({ev.x}, {ev.y})
                    {ev.viewport_width && ev.viewport_height ? ` · viewport ${ev.viewport_width}×${ev.viewport_height}` : ''}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
