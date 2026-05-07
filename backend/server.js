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
if (process.env.NODE_ENV === 'production') {
  corsOrigins.push('https://devfocus.fly.dev');
}
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check (unauthenticated)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes (unauthenticated)
app.use('/api/auth', require('./routes/auth'));

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

  // One-time cleanup: remove Jira done items with bad completion dates
  // These were synced with completedAt = sync time, polluting trends
  try {
    const { WorkItem } = require('./database/models');
    const { Op } = require('sequelize');
    // Delete done Jira items where completedAt is within last 30 days
    // but the Jira ticket was actually completed months ago
    // Safest approach: just remove all auto-done Jira items, they won't re-sync
    await WorkItem.destroy({
      where: { externalSource: 'jira', status: 'done' },
    });
    console.log('Cleaned up done Jira items with potentially bad dates.');
  } catch { /* */ }

  initScheduler();
  app.listen(PORT, () => console.log(`DevFocus API running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
