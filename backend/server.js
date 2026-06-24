/* eslint-disable no-console */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./database/models');
const { verify } = require('./utilities/auth');
const { initScheduler } = require('./scheduler');

const app = express();

// Trust proxy (Fly.io terminates SSL) so secure cookies work
app.set('trust proxy', 1);

const frontendUrl = process.env.DEVFOCUS_FRONTEND_URL || 'http://localhost:5173';
const corsOrigins = [frontendUrl];
// Optionally trust an extra public origin for credentialed CORS. Only needed if
// the SPA is served from a different host than the API — a standard same-origin
// production deploy (SPA + API on one host) doesn't need this, since same-origin
// requests aren't subject to CORS.
if (process.env.DEVFOCUS_PUBLIC_URL) {
  corsOrigins.push(process.env.DEVFOCUS_PUBLIC_URL);
}
// Trusted origins (the app itself + dev frontend) get credentialed CORS so the
// cookie-based login works. Any other origin — e.g. an external read-only
// dashboard like a Glean artifact — is allowed WITHOUT credentials: the bearer
// token (GET-only) still works, but cookies are never shared cross-origin, so a
// random site can't ride a logged-in session. Sandboxed iframes send
// `Origin: null`, which is reflected fine for the token path.
app.use(cors((req, callback) => {
  const origin = req.header('Origin');
  if (!origin || corsOrigins.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(null, { origin: true, credentials: false });
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check (unauthenticated)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Standalone read-only Trends dashboard (self-contained HTML). `verify` lets it
// in three ways: a logged-in session cookie (the in-app "Live Dashboard" link),
// a `?token=<DEVFOCUS_READER_TOKEN>` query param (for sharing into Glean), or the
// dev auth bypass. The page fetches /api/trends same-origin — carrying whichever
// of the cookie/token it has — so it pulls live straight from the database.
app.get('/report', verify, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

// Auth routes (unauthenticated)
app.use('/api/auth', require('./routes/auth'));

// Microsoft calendar OAuth. Mounted before the global guard: /auth is
// authenticated per-route, /callback is open (validated by its `state` token)
// so Microsoft's cross-site redirect back doesn't depend on a session cookie.
app.use('/api/integrations/calendar', require('./routes/calendarAuth'));

// All other API routes require authentication
app.use('/api', verify);
app.use('/api/daily', require('./routes/daily'));
app.use('/api/work-items', require('./routes/workItems'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/snapshots', require('./routes/snapshots'));
app.use('/api/inbox', require('./routes/inbox'));
app.use('/api/week-plan', require('./routes/weekPlan'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/settings', require('./routes/userSettings'));
app.use('/api/trends', require('./routes/trends'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/tallies', require('./routes/tallies'));
app.use('/api/statuses', require('./routes/statuses'));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ error: isProd ? 'Internal server error' : err.message || 'Internal server error' });
});

const PORT = process.env.DEVFOCUS_PORT || 3001;

async function start() {
  // Disable FK constraints during sync so alter can drop/recreate tables
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    // Drop stale backup tables from previous alter attempts
    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    for (const table of tables) {
      if (table.endsWith('_backup')) {
        await qi.dropTable(table);
      }
    }
    await sequelize.sync({ alter: true });
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }
  console.log('Database synced.');


  initScheduler();
  app.listen(PORT, () => console.log(`DevFocus API running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
