require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const api = require('./routes/api');

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/user_analytics';

const app = express();
app.use(cors());
// tracker may send text/plain bodies to avoid CORS preflight; accept both
app.use(express.json({ limit: '100kb', type: ['application/json', 'text/plain'] }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
