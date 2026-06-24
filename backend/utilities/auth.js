const crypto = require('crypto');

const PASS_HASH = process.env.DEVFOCUS_PASS_HASH;
const sessions = new Map();

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
