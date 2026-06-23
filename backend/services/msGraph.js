/* eslint-disable no-console */
// Microsoft Graph (Outlook calendar) integration via delegated OAuth.
//
// Flow: the user consents once (GET /api/integrations/calendar/auth → Microsoft
// login → /callback). MSAL exchanges the auth code for an access token + refresh
// token and persists its token cache into the `calendar` IntegrationConfig row.
// Background syncs then call acquireTokenSilent(), which transparently uses the
// refresh token to mint fresh access tokens with no user present.
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { IntegrationConfig } = require('../database/models');
const { TZ } = require('../utilities/timezone');

const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const TENANT_ID = process.env.GRAPH_TENANT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
// Where Microsoft redirects after consent. Must EXACTLY match a redirect URI
// registered on the Azure app. Defaults to the Fly.io prod URL.
const REDIRECT_URI =
  process.env.GRAPH_REDIRECT_URI ||
  'https://devfocus.fly.dev/api/integrations/calendar/callback';

// Delegated permission. openid/profile/offline_access are added by MSAL
// automatically and must NOT be listed here (MSAL throws if they are).
const SCOPES = ['Calendars.Read'];

function isConfigured() {
  return Boolean(CLIENT_ID && TENANT_ID && CLIENT_SECRET);
}

// Load/save the MSAL token cache from the `calendar` IntegrationConfig.config
// JSON blob, so tokens survive restarts on Fly.io.
async function loadConfig() {
  const rec = await IntegrationConfig.findOne({ where: { provider: 'calendar' } });
  const cfg = rec && rec.config ? JSON.parse(rec.config) : {};
  return { rec, cfg };
}

const cachePlugin = {
  beforeCacheAccess: async (ctx) => {
    const { cfg } = await loadConfig();
    if (cfg.msalCache) ctx.tokenCache.deserialize(cfg.msalCache);
  },
  afterCacheAccess: async (ctx) => {
    if (!ctx.cacheHasChanged) return;
    const { rec, cfg } = await loadConfig();
    if (!rec) return; // callback creates the row before any token is acquired
    cfg.msalCache = ctx.tokenCache.serialize();
    await rec.update({ config: JSON.stringify(cfg) });
  },
};

function getClient() {
  if (!isConfigured()) {
    throw new Error('Graph not configured — set GRAPH_CLIENT_ID, GRAPH_TENANT_ID, GRAPH_CLIENT_SECRET');
  }
  return new ConfidentialClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET,
    },
    cache: { cachePlugin },
  });
}

// Build the Microsoft consent/login URL to redirect the user to.
function getAuthCodeUrl(state) {
  return getClient().getAuthCodeUrl({ scopes: SCOPES, redirectUri: REDIRECT_URI, state });
}

// Exchange the auth code for tokens. Creates the `calendar` config row first so
// the cache plugin has somewhere to persist the token cache.
async function handleAuthCallback(code) {
  const client = getClient();
  let rec = await IntegrationConfig.findOne({ where: { provider: 'calendar' } });
  if (!rec) rec = await IntegrationConfig.create({ provider: 'calendar' });

  const result = await client.acquireTokenByCode({ code, scopes: SCOPES, redirectUri: REDIRECT_URI });

  // Re-read: acquireTokenByCode's afterCacheAccess just wrote msalCache to the row.
  const { cfg } = await loadConfig();
  cfg.authMethod = 'graph';
  cfg.homeAccountId = result.account.homeAccountId;
  cfg.account = result.account.username;
  delete cfg.icsUrl; // migrating off the old ICS feed
  await rec.update({ config: JSON.stringify(cfg), enabled: true });
  return result.account;
}

// Get a valid access token, refreshing silently via the stored refresh token.
async function getAccessToken() {
  const client = getClient();
  const { cfg } = await loadConfig();
  if (!cfg.homeAccountId) throw new Error('Calendar is not connected to Microsoft — click Connect in Settings');

  const account = await client.getTokenCache().getAccountByHomeId(cfg.homeAccountId);
  if (!account) throw new Error('No cached Microsoft account — reconnect the calendar in Settings');

  const result = await client.acquireTokenSilent({ account, scopes: SCOPES });
  return result.accessToken;
}

// ── Calendar fetch ─────────────────────────────────────────────────────────

// YYYY-MM-DD for a real instant, in the app timezone (matches the ICS path).
function toDateInTZ(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

// Graph emits up to 7 fractional-second digits; trim to milliseconds so
// `new Date()` parses reliably across engines. Values come back as UTC
// (no Prefer header sent), so append 'Z' to pin the instant.
function toInstant(dateTime) {
  const ms = dateTime.replace(/(\.\d{3})\d*$/, '$1');
  return new Date(ms.endsWith('Z') ? ms : `${ms}Z`);
}

function addDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Skip events the user declined or hasn't accepted (mirrors the ICS busy-status
// filtering). 'none' = no attendees (personal blocks) → keep.
function shouldExclude(ev) {
  const response = (ev.responseStatus && ev.responseStatus.response) || 'none';
  return response === 'declined' || response === 'notResponded' || response === 'tentativelyAccepted';
}

// Map one Graph event into zero or more CachedEvent-shaped records. Multi-day
// all-day events are split into one record per calendar day (end is exclusive).
function mapEvent(ev, startDate, endDate, out) {
  if (shouldExclude(ev)) return;

  const title = ev.subject || '(No title)';
  const isOOO = ev.showAs === 'oof';
  const location = (ev.location && ev.location.displayName) || null;

  if (ev.isAllDay) {
    const startStr = ev.start.dateTime.slice(0, 10);
    const endStr = ev.end.dateTime.slice(0, 10); // exclusive
    if (endStr <= startStr) {
      if (startStr >= startDate && startStr <= endDate) {
        out.push({
          uid: ev.id, title, start: toInstant(ev.start.dateTime), end: toInstant(ev.end.dateTime),
          allDay: true, isOOO, location, date: startStr,
        });
      }
      return;
    }
    for (let cur = startStr; cur < endStr; cur = addDay(cur)) {
      if (cur < startDate || cur > endDate) continue;
      out.push({
        uid: `${ev.id}_${cur}`, title,
        start: new Date(`${cur}T00:00:00Z`), end: new Date(`${addDay(cur)}T00:00:00Z`),
        allDay: true, isOOO, location, date: cur,
      });
    }
    return;
  }

  const start = toInstant(ev.start.dateTime);
  const end = toInstant(ev.end.dateTime);
  const date = toDateInTZ(start);
  if (date < startDate || date > endDate) return;
  out.push({ uid: ev.id, title, start, end, allDay: false, isOOO, location, date });
}

// Fetch calendar events between two YYYY-MM-DD dates via Graph calendarView,
// which expands recurring series into individual instances server-side.
async function fetchCalendarView(startDate, endDate) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    startDateTime: `${startDate}T00:00:00`,
    endDateTime: `${endDate}T23:59:59`,
    $select: 'id,subject,start,end,isAllDay,showAs,responseStatus,location',
    $top: '200',
  });
  let url = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;

  const out = [];
  // Follow @odata.nextLink pagination until exhausted.
  while (url) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Graph calendarView ${resp.status}: ${body.slice(0, 300)}`);
    }
    // eslint-disable-next-line no-await-in-loop
    const data = await resp.json();
    for (const ev of data.value || []) mapEvent(ev, startDate, endDate, out);
    url = data['@odata.nextLink'] || null;
  }
  return out;
}

module.exports = { isConfigured, getAuthCodeUrl, handleAuthCallback, getAccessToken, fetchCalendarView };
