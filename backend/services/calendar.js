/* eslint-disable no-console */
const msal = require('@azure/msal-node');
const axios = require('axios');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['Calendars.Read'];

// MSAL confidential client (public client for device code flow)
let msalApp = null;
let tokenCache = null;

function getMsalApp(config) {
  if (msalApp) return msalApp;
  msalApp = new msal.PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority || `https://login.microsoftonline.com/${config.tenantId || 'common'}`,
    },
  });
  return msalApp;
}

// Step 1: Start device code flow — returns the user code + verification URL
async function startDeviceCodeFlow(config) {
  const app = getMsalApp(config);

  return new Promise((resolve, reject) => {
    app
      .acquireTokenByDeviceCode({
        scopes: SCOPES,
        deviceCodeCallback: (response) => {
          // Return the device code info to the caller so UI can display it
          resolve({
            status: 'pending',
            userCode: response.userCode,
            verificationUri: response.verificationUri,
            message: response.message,
            // We'll store a reference to complete the flow
            _tokenPromise: null,
          });
        },
      })
      .then((tokenResponse) => {
        // This resolves after user completes auth
        tokenCache = tokenResponse;
      })
      .catch(reject);
  });
}

// Get a valid access token (from cache or refresh)
async function getAccessToken(config) {
  const app = getMsalApp(config);

  if (tokenCache) {
    // Try silent acquisition first (uses refresh token)
    try {
      const accounts = await app.getTokenCache().getAllAccounts();
      if (accounts.length > 0) {
        const result = await app.acquireTokenSilent({
          account: accounts[0],
          scopes: SCOPES,
        });
        return result.accessToken;
      }
    } catch {
      // Silent failed, need re-auth
    }

    if (tokenCache.accessToken) {
      return tokenCache.accessToken;
    }
  }

  return null;
}

// Fetch calendar events from Microsoft Graph
async function fetchEvents(accessToken, startDate, endDate) {
  const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
  const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

  const response = await axios.get(`${GRAPH_BASE}/me/calendarView`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      startDateTime,
      endDateTime,
      $top: 100,
      $select: 'id,subject,start,end,isAllDay,location',
      $orderby: 'start/dateTime',
    },
  });

  return response.data.value || [];
}

// Sync calendar events for a date range
async function syncCalendar(startDate, endDate) {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'calendar', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Calendar integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const accessToken = await getAccessToken(config);

  if (!accessToken) {
    return { success: false, error: 'No valid access token — re-authenticate in Settings' };
  }

  try {
    const events = await fetchEvents(accessToken, startDate, endDate);

    let created = 0;
    let updated = 0;

    for (const event of events) {
      const startTime = new Date(event.start.dateTime + 'Z');
      const endTime = new Date(event.end.dateTime + 'Z');
      const date = startTime.toISOString().split('T')[0];

      const [cachedEvent, wasCreated] = await CachedEvent.upsert({
        externalId: event.id,
        title: event.subject || '(No title)',
        startTime,
        endTime,
        allDay: event.isAllDay || false,
        location: event.location?.displayName || null,
        date,
      });

      if (wasCreated) created++;
      else updated++;
    }

    // Clean up events that no longer exist in the range
    const graphIds = events.map((e) => e.id);
    if (graphIds.length > 0) {
      await CachedEvent.destroy({
        where: {
          date: { [Op.between]: [startDate, endDate] },
          externalId: { [Op.notIn]: graphIds },
        },
      });
    }

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    });

    return { success: true, created, updated, total: events.length };
  } catch (err) {
    console.error('Calendar sync error:', err.response?.data || err.message);
    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
    });
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

// Sync current week + next week
async function syncCurrentWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const nextFriday = new Date(monday);
  nextFriday.setDate(monday.getDate() + 11); // This week + next week

  const startDate = monday.toISOString().split('T')[0];
  const endDate = nextFriday.toISOString().split('T')[0];

  return syncCalendar(startDate, endDate);
}

module.exports = {
  startDeviceCodeFlow,
  getAccessToken,
  syncCalendar,
  syncCurrentWeek,
};
