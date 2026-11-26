import { useEffect, useRef, useState } from 'react';
import { BASE, fetchPages, fetchHeatmap, clearHeatmap } from '../api.js';
import { DownloadIcon, TrashIcon } from './Icons.jsx';

function commonWidth(points) {
  const counts = {};
  points.forEach((p) => (counts[p.viewport_width] = (counts[p.viewport_width] || 0) + 1));
  let best = 1440;
  let bestCount = 0;
  Object.keys(counts).forEach((w) => {
    if (counts[w] > bestCount) {
      best = Number(w);
      bestCount = counts[w];
    }
  });
  return best;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function downloadHeatmapPNG({ url, points, pageWidth, pageHeight, includePage }) {
  const W = pageWidth;
  const headerH = 60;
  const H = pageHeight + headerH;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Capture the real page screenshot from the backend when live overlay is enabled
  let pageImg = null;
  if (includePage && url) {
    try {
      const shotUrl = `${BASE}/heatmap/screenshot?url=${encodeURIComponent(url)}&width=${pageWidth}&height=${pageHeight}`;
      pageImg = await loadImage(shotUrl);
    } catch {
      pageImg = null;
    }
  }

  // Header bar
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Click Heatmap — ${url || 'All pages'}`, 24, 36);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${points.length} clicks · ${pageWidth}×${pageHeight}px`, W - 24, 36);
  ctx.textAlign = 'left';

  if (pageImg) {
    ctx.drawImage(pageImg, 0, headerH, W, pageHeight);
    ctx.globalCompositeOperation = 'multiply';
  } else {
    ctx.fillStyle = '#11161b';
    ctx.fillRect(0, headerH, W, pageHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const gx = (W / 10) * i;
      const gy = headerH + (pageHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(gx, headerH);
      ctx.lineTo(gx, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'screen';
  }

  // Radial heat spots
  const radius = Math.max(36, Math.round(W * 0.032));
  points.forEach((c) => {
    const px = (c.x / c.viewport_width) * W;
    const py = headerH + (c.y / c.viewport_height) * pageHeight;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
    grad.addColorStop(0, pageImg ? 'rgba(220, 38, 38, 0.8)' : 'rgba(239, 68, 68, 0.85)');
    grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.48)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  const link = document.createElement('a');
  const slug = (url || 'heatmap').replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  link.download = `heatmap-${slug || 'export'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function HeatmapView({ refreshKey, initialUrl }) {
  const [pages, setPages] = useState([]);
  const [url, setUrl] = useState(initialUrl || '');
  const [clicks, setClicks] = useState([]);
  const [hover, setHover] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPage, setShowPage] = useState(true);
  const [canvasWidth, setCanvasWidth] = useState(960);
  const [measuredHeight, setMeasuredHeight] = useState(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    setMeasuredHeight(null);
  }, [url]);

  useEffect(() => {
    function onMessage(e) {
      if (e.data && e.data.type === 'ua_page_size' && e.data.height > 200) {
        setMeasuredHeight(e.data.height);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetchPages()
      .then((p) => {
        if (cancelled) return;
        setPages(p);
        setUrl((cur) => {
          if (cur && p.includes(cur)) return cur;
          if (initialUrl && p.includes(initialUrl)) return initialUrl;
          return p[0] || '';
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [refreshKey, initialUrl]);

  useEffect(() => {
    if (!url) {
      setClicks([]);
      return;
    }
    let cancelled = false;
    if (!clicks.length) setLoading(true);
    fetchHeatmap(url)
      .then((c) => !cancelled && setClicks(c))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey]);

  const points = clicks.filter((c) => c.x != null && c.y != null && c.viewport_width > 0 && c.viewport_height > 0);
  const pageWidth = commonWidth(points);
  const recordedHeight = points.reduce((m, p) => Math.max(m, p.viewport_height), 0);
  const pageHeight = showPage ? measuredHeight || recordedHeight || 1500 : Math.round((pageWidth * 10) / 16);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => setCanvasWidth(el.clientWidth || 960);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPage, url]);

  const scale = canvasWidth / pageWidth;
  const scaledHeight = Math.round(pageHeight * scale);

  async function handleClear() {
    if (!url || clearing) return;
    setClearing(true);
    setError('');
    try {
      await clearHeatmap(url);
      setClicks([]);
      setHover(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setClearing(false);
    }
  }

  async function handleDownload() {
    if (!points.length || exporting) return;
    setExporting(true);
    try {
      await downloadHeatmapPNG({ url, points, pageWidth, pageHeight, includePage: showPage });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="panel heatmap-panel">
      <div className="heatmap-toolbar">
        <label className="select-field">
          <span className="field-label">Tracked page</span>
          <select value={url} onChange={(e) => setUrl(e.target.value)}>
            {!pages.length && <option value="">No pages tracked</option>}
            {pages.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <div className="heatmap-controls">
          <label className="toggle-field">
            <input type="checkbox" checked={showPage} onChange={(e) => setShowPage(e.target.checked)} />
            <span>Overlay live page</span>
          </label>
          <div className="click-counter">
            <strong className="tabular">{clicks.length.toLocaleString()}</strong>
            <span className="muted">clicks</span>
          </div>
          <button
            type="button"
            className="btn-action"
            disabled={!points.length || exporting}
            onClick={handleDownload}
            title="Download heatmap with page screenshot as PNG"
          >
            <DownloadIcon width={15} height={15} />
            <span>{exporting ? 'Exporting…' : 'Download PNG'}</span>
          </button>
          <button
            type="button"
            className="btn-action danger"
            disabled={!clicks.length || clearing}
            onClick={handleClear}
            title="Clear all click data for this page"
          >
            <TrashIcon width={15} height={15} />
            <span>{clearing ? 'Clearing…' : 'Clear data'}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div ref={scrollerRef} className={showPage ? 'heat-scroller with-page' : 'heat-scroller'}>
        <div
          className={showPage ? 'heat-stage with-page' : 'heat-stage'}
          style={{ height: showPage ? scaledHeight : undefined }}
        >
          {showPage && url && (
            <iframe
              key={url}
              title="Page preview"
              src={url}
              className="page-frame"
              scrolling="no"
              style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})` }}
              tabIndex={-1}
            />
          )}

          {loading && <div className="canvas-msg">Loading clicks…</div>}
          {!loading && !points.length && <div className="canvas-msg">No click data recorded for this URL yet.</div>}

          {points.map((c, i) => {
            const left = Math.min(100, Math.max(0, (c.x / c.viewport_width) * 100));
            const top = Math.min(100, Math.max(0, (c.y / c.viewport_height) * 100));
            return (
              <span
                key={i}
                className={showPage ? 'heat-dot on-light' : 'heat-dot'}
                style={{ left: `${left}%`, top: `${top}%` }}
                onMouseEnter={() => setHover({ ...c, left, top })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {hover && (
            <div
              className="tooltip"
              style={{
                left: `${hover.left}%`,
                top: `${hover.top}%`,
                transform: hover.left > 72 ? 'translate(-106%, -118%)' : 'translate(12px, -118%)',
              }}
            >
              <div className="mono tabular">({hover.x}, {hover.y})</div>
              <div className="small muted tabular">
                {hover.viewport_width}×{hover.viewport_height} · {new Date(hover.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="heatmap-foot">
        <span className="muted small">
          {showPage
            ? `Scroll inside the preview to inspect the full page (${pageWidth}×${pageHeight}px).`
            : 'Normalized 16:10 coordinate grid based on each visitor document size.'}
        </span>
        <div className="heat-scale" aria-hidden="true">
          <span className="small muted">Low</span>
          <span className="heat-bar" />
          <span className="small muted">High</span>
        </div>
      </div>
    </div>
  );
}
