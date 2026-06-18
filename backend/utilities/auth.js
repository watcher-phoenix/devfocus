const crypto = require('crypto');

const PASS_HASH = process.env.DEVFOCUS_PASS_HASH;
// Optional static tokens for external read-only API access. Both grant GET-only
// access so a leaked token can't mutate data:
//   DEVFOCUS_API_TOKEN    — sent as `Authorization: Bearer <token>` (e.g. the
//                           browser dashboard embeds this).
//   DEVFOCUS_READER_TOKEN — sent as a `?token=<token>` query param (e.g. Glean's
//                           document reader, which can't add headers).
// Either token is accepted on either channel, so they can be rotated
// independently — rotating the URL token doesn't disturb the header token.
const API_TOKEN = process.env.DEVFOCUS_API_TOKEN;
const READER_TOKEN = process.env.DEVFOCUS_READER_TOKEN;
const READ_TOKENS = [API_TOKEN, READER_TOKEN].filter(Boolean);
const sessions = new Map();

// Constant-time string comparison (guards against length + timing leaks).
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// True if the request carries a valid read token via Bearer header or ?token=.
function readTokenAuthorized(req) {
  if (!READ_TOKENS.length) return false;
  const presented = [];
  const header = (req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (header) presented.push(header[1]);
  if (typeof req.query?.token === 'string' && req.query.token) presented.push(req.query.token);
  return presented.some((p) => READ_TOKENS.some((t) => safeEqual(p, t)));
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
  // Read-only access for external dashboards: a valid token (header or ?token=)
  // allows GETs only.
  if (req.method === 'GET' && readTokenAuthorized(req)) {
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

module.exports = { login, verify, logout, readTokenAuthorized };
