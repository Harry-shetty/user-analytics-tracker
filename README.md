# User Analytics Tracker

A lightweight full-stack web analytics app built for the CausalFunnel Full Stack Engineer assignment. It tracks page views and clicks on a storefront using a small vanilla JavaScript snippet, stores events in MongoDB, and displays live sessions, user journeys, and interactive full-page click heatmaps in a React dashboard.

## Project Structure

```text
├── backend/     Express + Mongoose REST API & real-time SSE stream
├── tracker/     Standalone tracker.js script + Lumen demo storefront
└── dashboard/   React + Vite analytics dashboard
```

## Tech Stack

- **Tracking Script (`/tracker`):** Dependency-free vanilla JavaScript wrapped in an IIFE so it never pollutes the host page. Includes a realistic home-goods demo storefront (`demo.html`, `demo.css`, `demo.js`) priced in INR to generate real session and click data.
- **Backend (`/backend`):** Node.js, Express, Mongoose, `cors`, `dotenv`, plus native Server-Sent Events (SSE) for live dashboard updates.
- **Database:** MongoDB (works with local MongoDB or MongoDB Atlas).
- **Dashboard (`/dashboard`):** React 19, Vite, and plain CSS with custom inline SVG charts (zero heavy charting or UI libraries).

## Key Features

- **Automatic Event Tracking:** Tracks `page_view` on load and `click` events with full-page coordinates (`x`, `y`), document dimensions, URL, and ISO timestamps. Persists a `session_id` in `localStorage`.
- **Overview Dashboard:** KPI cards (sessions, total events, page views, clicks), an event-mix donut chart, a 7-day activity bar chart, and a top-pages breakdown with one-click jumps to each page's heatmap.
- **Sessions & User Journey:** Lists all sessions ordered by most recent activity, with session ID search, copy-to-clipboard, event-type filters (`All`, `Views`, `Clicks`), and a chronological timeline for each visitor.
- **Interactive Full-Page Heatmap:** Overlays glowing click dots directly onto a live, scrollable preview of the tracked page with hover tooltips, a **Download PNG** export (compositing the page screenshot with the heatmap), and a **Clear data** button.
- **Real-Time Updates:** New events saved to MongoDB are pushed immediately to open dashboards via `GET /api/events/stream` (SSE).

## API Endpoints

| Method & Path | Description |
| --- | --- |
| `POST /api/events` | Validate and store an incoming `page_view` or `click` event |
| `GET /api/events/stream` | Server-Sent Events stream for real-time dashboard updates |
| `GET /api/stats` | Aggregated overview metrics (sessions, counts, top pages, 7-day volume) |
| `GET /api/sessions` | List all sessions with `event_count`, `first_seen`, and `last_seen` |
| `GET /api/sessions/:sessionId/events` | Chronological event timeline for a single session |
| `GET /api/pages` | Distinct tracked `page_url` values for the heatmap selector |
| `GET /api/heatmap?url=<url>` | All click coordinates and dimensions for a page |
| `DELETE /api/heatmap?url=<url>` | Clear stored click data for a page |
| `GET /api/heatmap/screenshot?url=<url>` | Capture a full-page PNG screenshot for heatmap export |
| `GET /health` | Health check |

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (either a local instance or a free MongoDB Atlas cluster)

### 1. Start the Backend
```bash
cd backend
cp .env.example .env
# Edit .env and set MONGO_URI (local MongoDB or your MongoDB Atlas URI)
npm install
npm start
```
The API runs on `http://localhost:5001` by default. *(Port 5001 is used instead of 5000 because macOS AirPlay Receiver occupies port 5000.)*

### 2. Start the Dashboard
In a second terminal:
```bash
cd dashboard
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

### 3. Serve the Demo Storefront
In a third terminal:
```bash
cd tracker
python3 -m http.server 8080
```
Open `http://localhost:8080/demo.html`, browse around, add items to the bag, and watch the dashboard at `http://localhost:5173` update in real time.

### Embedding on Any Other Site
Drop one script tag into any HTML page:
```html
<script src="path/to/tracker.js" data-endpoint="http://localhost:5001/api/events"></script>
```

## Deployment Guide

1. **Database:** Create a free MongoDB Atlas cluster, add a database user, allow network access, and copy your `mongodb+srv://...` connection string.
2. **Backend (Render / Railway):** Point the service root to `backend`, build with `npm install`, start with `npm start`, and set `MONGO_URI` in environment variables.
3. **Dashboard (Vercel / Netlify):** Point the project root to `dashboard` (Vite preset) and set `VITE_API_URL=https://<your-backend-url>/api`.
4. **Tracker:** Host `/tracker` on any static host or CDN and update `data-endpoint` to your deployed backend URL.

## Assumptions & Trade-offs

- **Single `events` collection vs. separate `sessions` collection:** All events live in one indexed `events` collection (`session_id`, `page_url`, `timestamp`, and compound `{ page_url: 1, event_type: 1 }`), and sessions are computed with a MongoDB `$group` aggregation. This keeps writes fast and the schema simple. At high traffic, sessions should be pre-aggregated or paginated.
- **Session expiration:** `session_id` is stored in `localStorage` without an expiry timer, so returning visits in the same browser reuse one session. In production, a 30-minute inactivity timeout would rotate session IDs.
- **Immediate event delivery vs. batching:** `tracker.js` sends each event immediately using `fetch(..., { keepalive: true })` so clicks on links aren't dropped during navigation. At higher scale, events would be queued and flushed in batches using `navigator.sendBeacon` on `pagehide`.
- **Heatmap coordinate normalization:** Clicks are stored as document-relative coordinates (`clientX + scrollX`, `clientY + scrollY`) against the full content width and height, with sticky/fixed elements (like the top navbar) kept viewport-relative so scrolling doesn't shift header clicks. Responsive layouts that reflow heavily between mobile and desktop are still approximate when viewed at a single reference width.
- **Screenshot export:** `GET /api/heatmap/screenshot` uses local headless Chrome to composite the actual storefront behind the heat dots in exported PNGs. If Chrome isn't installed in a cloud container, the dashboard automatically falls back to exporting the dark coordinate grid heatmap.
- **SPA routing:** `page_view` fires on full page loads. Tracking client-side route transitions in a single-page app would require hooking `history.pushState` and `popstate`.
- **Security & rate limiting:** CORS is open and event ingestion is unauthenticated to make local testing straightforward. A production deployment would restrict allowed origins, require a per-site write key, and add rate limiting.
