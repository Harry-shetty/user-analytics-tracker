import { useEffect, useRef, useState } from 'react';
import { BASE, fetchPages, fetchHeatmap, clearHeatmap } from '../api.js';
import { DownloadIcon, TrashIcon, LaptopIcon, PhoneIcon } from './Icons.jsx';

function commonWidth(points, fallback) {
  const counts = {};
  points.forEach((p) => (counts[p.viewport_width] = (counts[p.viewport_width] || 0) + 1));
  let best = fallback;
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

function captureIframeScreenshot(iframeEl) {
  return new Promise((resolve) => {
    if (!iframeEl || !iframeEl.contentWindow) return resolve(null);
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(val);
    };
    const onMsg = (e) => {
      if (e.data && e.data.type === 'ua_capture_result') finish(e.data.dataUrl || null);
    };
    const timer = setTimeout(() => finish(null), 8000);
    window.addEventListener('message', onMsg);
    iframeEl.contentWindow.postMessage({ type: 'ua_capture' }, '*');
  });
}

async function downloadHeatmapPNG({ url, device, points, pageWidth, pageHeight, includePage, iframeEl }) {
  const W = pageWidth;
  const headerH = 60;
  const H = pageHeight + headerH;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let pageImg = null;
  if (includePage && url) {
    try {
      const dataUrl = await captureIframeScreenshot(iframeEl);
      if (dataUrl) {
        pageImg = await loadImage(dataUrl);
      } else {
        const shotUrl = `${BASE}/heatmap/screenshot?url=${encodeURIComponent(url)}&width=${pageWidth}&height=${pageHeight}`;
        pageImg = await loadImage(shotUrl);
      }
    } catch {
      pageImg = null;
    }
  }

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 15px system-ui, -apple-system, sans-serif';
  const label = device === 'mobile' ? 'Mobile Heatmap' : 'Laptop Heatmap';
  ctx.fillText(`${label} — ${points.length} clicks`, 16, 36);

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

  const radius = Math.max(24, Math.round(W * 0.036));
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
  link.download = `heatmap-${device}-${slug || 'export'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function HeatmapView({ refreshKey, initialUrl }) {
  const [pages, setPages] = useState([]);
  const [url, setUrl] = useState(initialUrl || '');
  const [device, setDevice] = useState('desktop');
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
  const iframeRef = useRef(null);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    setMeasuredHeight(null);
    setHover(null);
  }, [url, device]);

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
    setLoading(true);
    fetchHeatmap(url, device)
      .then((c) => !cancelled && setClicks(c))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url, device, refreshKey]);

  const isMobile = device === 'mobile';
  const points = clicks.filter((c) => c.x != null && c.y != null && c.viewport_width > 0 && c.viewport_height > 0);
  const pageWidth = isMobile ? commonWidth(points, 390) : commonWidth(points, 1440);
  const recordedHeight = points.reduce((m, p) => Math.max(m, p.viewport_height), 0);
  const pageHeight = showPage
    ? measuredHeight || recordedHeight || (isMobile ? 2200 : 1500)
    : isMobile
      ? Math.round((pageWidth * 16) / 9)
      : Math.round((pageWidth * 10) / 16);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => setCanvasWidth(el.clientWidth || (isMobile ? 390 : 960));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showPage, url, isMobile]);

  const scale = canvasWidth / pageWidth;
  const scaledHeight = Math.round(pageHeight * scale);

  async function handleClear() {
    if (!url || clearing) return;
    setClearing(true);
    setError('');
    try {
      await clearHeatmap(url, device);
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
      await downloadHeatmapPNG({ url, device, points, pageWidth, pageHeight, includePage: showPage, iframeEl: iframeRef.current });
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

        <div className="device-switch" role="group" aria-label="Select device heatmap">
          <button
            type="button"
            className={device === 'desktop' ? 'device-btn active' : 'device-btn'}
            onClick={() => setDevice('desktop')}
          >
            <LaptopIcon width={15} height={15} />
            <span>Laptop</span>
          </button>
          <button
            type="button"
            className={device === 'mobile' ? 'device-btn active' : 'device-btn'}
            onClick={() => setDevice('mobile')}
          >
            <PhoneIcon width={15} height={15} />
            <span>Mobile</span>
          </button>
        </div>

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
            title={`Clear ${device} click data for this page`}
          >
            <TrashIcon width={15} height={15} />
            <span>{clearing ? 'Clearing…' : 'Clear data'}</span>
          </button>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div
        ref={scrollerRef}
        className={`heat-scroller${showPage ? ' with-page' : ''}${isMobile ? ' mobile-frame' : ''}`}
      >
        <div
          className={`heat-stage${showPage ? ' with-page' : ''}${isMobile ? ' mobile-stage' : ''}`}
          style={{ height: showPage ? scaledHeight : undefined }}
        >
          {showPage && url && (
            <iframe
              ref={iframeRef}
              key={`${url}-${device}`}
              title={`${device} page preview`}
              src={url}
              className="page-frame"
              scrolling="no"
              style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})` }}
              tabIndex={-1}
            />
          )}

          {loading && <div className="canvas-msg">Loading {device} clicks…</div>}
          {!loading && !points.length && (
            <div className="canvas-msg">
              No {isMobile ? 'mobile' : 'laptop'} clicks recorded for this page yet.
            </div>
          )}

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
                transform: hover.left > 65 ? 'translate(-106%, -118%)' : 'translate(12px, -118%)',
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
            ? `${isMobile ? 'Mobile' : 'Laptop'} preview (${pageWidth}×${pageHeight}px) — scroll inside to inspect full page.`
            : `Normalized ${isMobile ? 'mobile' : 'laptop'} coordinate grid.`}
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
