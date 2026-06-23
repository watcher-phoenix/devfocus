/* eslint-disable no-console */
// Microsoft delegated OAuth for the Outlook calendar integration.
//   GET /auth     — authenticated; starts consent, redirects to Microsoft.
//   GET /callback — open (validated by `state`); Microsoft redirects here.
// Mounted BEFORE the global API auth guard so the cross-site callback return
// doesn't need a session cookie; CSRF is covered by the one-time `state` token.
const crypto = require('crypto');
const { Router } = require('express');
const { verify } = require('../utilities/auth');
const graph = require('../services/msGraph');

const router = Router();

// Short-lived one-time states (state -> expiry ms). In-memory is fine: a single
// instance, and a lost state just means the user clicks Connect again.
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function settingsRedirect(res, params) {
  res.redirect(`/settings?${new URLSearchParams(params).toString()}`);
}

router.get('/auth', verify, async (req, res) => {
  if (!graph.isConfigured()) {
    return settingsRedirect(res, { calendar: 'error', msg: 'Graph env vars not set on the server' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  try {
    const url = await graph.getAuthCodeUrl(state);
    return res.redirect(url);
  } catch (err) {
    return settingsRedirect(res, { calendar: 'error', msg: err.message });
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return settingsRedirect(res, { calendar: 'error', msg: errorDescription || error });
  }

  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!expiry || expiry < Date.now()) {
    return settingsRedirect(res, { calendar: 'error', msg: 'Login expired or invalid — try again' });
  }

  try {
    const account = await graph.handleAuthCallback(code);
    return settingsRedirect(res, { calendar: 'connected', account: account.username || '' });
  } catch (err) {
    console.error('[calendar] OAuth callback failed:', err.message);
    return settingsRedirect(res, { calendar: 'error', msg: err.message });
  }
});

module.exports = router;
