const crypto = require('crypto');

const PASS_HASH = process.env.DEVFOCUS_PASS_HASH;
// Optional static token for external read-only API access (e.g. a live dashboard
// pulling /api/trends). Grants GET-only access so a leaked token can't mutate data.
const API_TOKEN = process.env.DEVFOCUS_API_TOKEN;
const sessions = new Map();

// Constant-time comparison of the request's Bearer token against API_TOKEN.
function bearerMatches(req) {
  if (!API_TOKEN) return false;
  const match = (req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(API_TOKEN);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function login(password) {
  if (!PASS_HASH) {
    console.error('DEVFOCUS_PASS_HASH is not set — authentication disabled.');
    return null;
  }
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== PASS_HASH) return null;
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { created: Date.now() });
  return token;
}

function verify(req, res, next) {
  // Skip auth in development if no password is configured
  if (!PASS_HASH && process.env.NODE_ENV !== 'production') {
    return next();
  }
  // Read-only access for external dashboards: a valid Bearer token allows GETs only.
  if (req.method === 'GET' && bearerMatches(req)) {
    return next();
  }
  const token = req.cookies?.devfocus_session;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function logout(token) {
  sessions.delete(token);
}

module.exports = { login, verify, logout };
