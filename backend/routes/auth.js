const { Router } = require('express');
const { login, logout, verify } = require('../utilities/auth');

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const token = login(password);
  if (!token) return res.status(401).json({ error: 'Invalid password' });

  res.cookie('devfocus_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({ success: true });
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.devfocus_session;
  if (token) logout(token);
  res.clearCookie('devfocus_session');
  res.json({ success: true });
});

// Auth check — uses verify middleware, returns 401 if not authenticated
router.get('/check', verify, (req, res) => {
  res.json({ authenticated: true });
});

module.exports = router;
