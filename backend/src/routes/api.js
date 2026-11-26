const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const Event = require('../models/Event');

const CHROME_BIN =
  process.env.CHROME_PATH ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium'].find(
    (p) => p.includes('/') && fs.existsSync(p)
  ) ||
  'google-chrome';

const router = express.Router();
const streamClients = new Set();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const optNum = (v) => (v === undefined || v === null ? null : v);

function broadcastEvent(doc) {
  const payload = `data: ${JSON.stringify(doc)}\n\n`;
  for (const client of streamClients) {
    client.write(payload);
  }
}

router.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': connected\n\n');

  streamClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    streamClients.delete(res);
  });
});

router.post(
  '/events',
  wrap(async (req, res) => {
    const b = req.body || {};
    const errors = [];

    if (typeof b.session_id !== 'string' || !b.session_id.trim()) errors.push('session_id is required');
    if (!['page_view', 'click'].includes(b.event_type)) errors.push("event_type must be 'page_view' or 'click'");
    if (typeof b.page_url !== 'string' || !b.page_url.trim()) errors.push('page_url is required');

    for (const f of ['x', 'y', 'viewport_width', 'viewport_height']) {
      if (optNum(b[f]) !== null && !isNum(b[f])) errors.push(`${f} must be a number`);
    }
    if (b.event_type === 'click') {
      for (const f of ['x', 'y', 'viewport_width', 'viewport_height']) {
        if (!isNum(b[f])) errors.push(`${f} is required for click events`);
      }
    }

    let timestamp;
    if (b.timestamp !== undefined && b.timestamp !== null) {
      timestamp = new Date(b.timestamp);
      if (Number.isNaN(timestamp.getTime())) errors.push('timestamp must be a valid date');
    }

    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const doc = await Event.create({
      session_id: b.session_id.trim(),
      event_type: b.event_type,
      page_url: b.page_url.trim(),
      timestamp,
      x: optNum(b.x),
      y: optNum(b.y),
      viewport_width: optNum(b.viewport_width),
      viewport_height: optNum(b.viewport_height),
    });
    broadcastEvent(doc);
    res.status(201).json(doc);
  })
);

// Summary numbers for the dashboard overview
router.get(
  '/stats',
  wrap(async (_req, res) => {
    const DAY = 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - 6 * DAY);
    since.setUTCHours(0, 0, 0, 0);

    const [types, sessionCount, topPages, daily] = await Promise.all([
      Event.aggregate([{ $group: { _id: '$event_type', count: { $sum: 1 } } }]),
      Event.aggregate([{ $group: { _id: '$session_id' } }, { $count: 'n' }]),
      Event.aggregate([
        { $group: { _id: '$page_url', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Event.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
      ]),
    ]);

    const countOf = (type) => (types.find((t) => t._id === type) || { count: 0 }).count;
    const byDay = Object.fromEntries(daily.map((d) => [d._id, d.count]));
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(since.getTime() + (6 - i) * DAY).toISOString().slice(0, 10);
      last7Days.push({ date, count: byDay[date] || 0 });
    }

    res.json({
      total_sessions: sessionCount.length ? sessionCount[0].n : 0,
      page_views: countOf('page_view'),
      clicks: countOf('click'),
      top_pages: topPages.map((p) => ({ page_url: p._id, count: p.count })),
      events_per_day: last7Days,
    });
  })
);

router.get(
  '/sessions',
  wrap(async (_req, res) => {
    const sessions = await Event.aggregate([
      {
        $group: {
          _id: '$session_id',
          event_count: { $sum: 1 },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
        },
      },
      { $sort: { last_seen: -1 } },
      { $project: { _id: 0, session_id: '$_id', event_count: 1, first_seen: 1, last_seen: 1 } },
    ]);
    res.json(sessions);
  })
);

router.get(
  '/sessions/:sessionId/events',
  wrap(async (req, res) => {
    const events = await Event.find({ session_id: req.params.sessionId }).sort({ timestamp: 1 }).lean();
    res.json(events);
  })
);

router.get(
  '/pages',
  wrap(async (_req, res) => {
    const pages = await Event.distinct('page_url');
    res.json(pages.sort());
  })
);

router.get(
  '/heatmap',
  wrap(async (req, res) => {
    const { url } = req.query;
    if (typeof url !== 'string' || !url) return res.status(400).json({ error: 'url query param is required' });
    const clicks = await Event.find({ page_url: url, event_type: 'click' })
      .select('x y viewport_width viewport_height timestamp -_id')
      .lean();
    res.json(clicks);
  })
);

router.delete(
  '/heatmap',
  wrap(async (req, res) => {
    const { url } = req.query;
    const filter = typeof url === 'string' && url ? { page_url: url, event_type: 'click' } : { event_type: 'click' };
    const result = await Event.deleteMany(filter);
    broadcastEvent({ type: 'cleared', page_url: url || null });
    res.json({ deleted: result.deletedCount });
  })
);

// Captures a full-page PNG screenshot of the tracked URL so the dashboard can export heatmap + page together
router.get(
  '/heatmap/screenshot',
  wrap(async (req, res) => {
    const { url } = req.query;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid http(s) url query param is required' });
    }
    const width = Math.min(2000, Math.max(360, Number(req.query.width) || 1440));
    const height = Math.min(6000, Math.max(600, Number(req.query.height) || 1500));
    const outFile = path.join(os.tmpdir(), `ua-shot-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

    await new Promise((resolve, reject) => {
      execFile(
        CHROME_BIN,
        [
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          `--window-size=${width},${height}`,
          '--virtual-time-budget=2500',
          `--screenshot=${outFile}`,
          url,
        ],
        { timeout: 15000 },
        (err) => (err ? reject(err) : resolve())
      );
    });

    const png = await fs.promises.readFile(outFile);
    fs.promises.unlink(outFile).catch(() => {});
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
  })
);

module.exports = router;
