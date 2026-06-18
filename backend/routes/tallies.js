const { Router } = require('express');
const { DailyTally } = require('../database/models');
const { getTodayET } = require('../utilities/timezone');

const router = Router();

function parseCounts(raw) {
  try {
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

// Get the tally for a specific date ('today' resolves to the ET date)
router.get('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const tally = await DailyTally.findOne({ where: { date } });
    res.json({ date, counts: tally ? parseCounts(tally.counts) : {}, note: tally?.note || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert the full counts map for a date
router.put('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const counts = req.body?.counts && typeof req.body.counts === 'object' ? req.body.counts : {};
    const note = typeof req.body?.note === 'string' ? req.body.note : '';
    // Drop zero/negative entries so the map stays clean
    const clean = {};
    Object.entries(counts).forEach(([k, v]) => {
      const n = Math.max(0, Math.round(Number(v) || 0));
      if (n > 0) clean[k] = n;
    });
    await DailyTally.upsert({ date, counts: JSON.stringify(clean), note });
    res.json({ date, counts: clean, note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
