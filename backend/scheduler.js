/* eslint-disable no-console */
const cron = require('node-cron');
const { syncAll } = require('./services/sync');

function initScheduler() {
  // Sync every 30 minutes during work hours (7am-6pm ET, Mon-Fri)
  cron.schedule('*/30 7-18 * * 1-5', async () => {
    console.log('[scheduler] Running sync...');
    try {
      const results = await syncAll();
      console.log('[scheduler] Sync complete:', JSON.stringify(results));
    } catch (err) {
      console.error('[scheduler] Sync failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('Scheduler initialized — syncing every 30m during work hours (ET).');
}

module.exports = { initScheduler };
