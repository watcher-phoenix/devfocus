/* eslint-disable no-console */
const { IntegrationConfig } = require('../database/models');
const { syncCurrentWeek } = require('./calendar');
const { syncJira } = require('./jira');
const { syncBitbucket } = require('./bitbucket');

async function syncAll() {
  const results = {};

  const configs = await IntegrationConfig.findAll({ where: { enabled: true } });
  const enabledProviders = configs.map((c) => c.provider);

  if (enabledProviders.includes('calendar')) {
    console.log('[sync] Syncing calendar...');
    results.calendar = await syncCurrentWeek();
    console.log('[sync] Calendar:', results.calendar.success ? 'ok' : results.calendar.error);
  }

  if (enabledProviders.includes('jira')) {
    console.log('[sync] Syncing Jira...');
    results.jira = await syncJira();
    console.log('[sync] Jira:', results.jira.success ? 'ok' : results.jira.error);
  }

  if (enabledProviders.includes('bitbucket')) {
    console.log('[sync] Syncing Bitbucket...');
    results.bitbucket = await syncBitbucket();
    console.log('[sync] Bitbucket:', results.bitbucket.success ? 'ok' : results.bitbucket.error);
  }

  return results;
}

async function syncProvider(provider) {
  switch (provider) {
    case 'calendar':
      return syncCurrentWeek();
    case 'jira':
      return syncJira();
    case 'bitbucket':
      return syncBitbucket();
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

module.exports = { syncAll, syncProvider };
