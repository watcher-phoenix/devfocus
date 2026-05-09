/* eslint-disable no-console */
const cron = require('node-cron');
const { syncAll } = require('./services/sync');

async function runSync() {
  console.log('[scheduler] Running sync...');
  try {
    const results = await syncAll();
    console.log('[scheduler] Sync complete:', JSON.stringify(results));
  } catch (err) {
    console.error('[scheduler] Sync failed:', err.message);
  }
}

function initScheduler() {
  // Sync every 30 minutes during extended hours (6am-10pm ET, every day)
  cron.schedule('*/30 6-22 * * *', runSync, { timezone: 'America/New_York' });

  // Run an initial sync shortly after startup
  setTimeout(runSync, 5000);

  console.log('Scheduler initialized — syncing every 30m (6am-10pm ET) + on startup.');
}

module.exports = { initScheduler };
