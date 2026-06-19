const { Router } = require('express');
const { DailyTally } = require('../database/models');
const { getTodayET } = require('../utilities/timezone');

const router = Router();

function parseJSON(raw) {
  try {
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

// Normalize an entries map: keep only valid {id, ts, note} entries per category,
// drop empty categories. Returns { entries, counts } with counts derived from
// entry lengths so Trends can keep summing the counts map.
function normalizeEntries(raw) {
  const entries = {};
  const counts = {};
  Object.entries(raw || {}).forEach(([key, list]) => {
    if (!Array.isArray(list)) return;
    const clean = list
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        id: String(e.id || ''),
        ts: typeof e.ts === 'string' ? e.ts : '',
        note: typeof e.note === 'string' ? e.note : '',
      }))
      .filter((e) => e.id);
    if (clean.length > 0) {
      entries[key] = clean;
      counts[key] = clean.length;
    }
  });
  return { entries, counts };
}

// Build an entries map from a legacy counts map (one note-less entry per count)
// so days logged before per-entry notes still render and stay editable.
function entriesFromCounts(counts) {
  const entries = {};
  Object.entries(counts || {}).forEach(([key, n]) => {
    const total = Math.max(0, Math.round(Number(n) || 0));
    if (total > 0) {
      entries[key] = Array.from({ length: total }, (_, i) => ({
        id: `legacy-${key}-${i}`,
        ts: '',
        note: '',
      }));
    }
  });
  return entries;
}

// Get the tally for a specific date ('today' resolves to the ET date)
router.get('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const tally = await DailyTally.findOne({ where: { date } });
    if (!tally) {
      res.json({ date, entries: {}, counts: {}, note: '' });
      return;
    }
    const stored = parseJSON(tally.entries);
    // Back-compat: older rows have counts but no entries — derive entries from them.
    const raw = Object.keys(stored).length > 0 ? stored : entriesFromCounts(parseJSON(tally.counts));
    const { entries, counts } = normalizeEntries(raw);
    res.json({ date, entries, counts, note: tally.note || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert the full entries map for a date (counts are derived server-side)
router.put('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const { entries, counts } = normalizeEntries(
      req.body?.entries && typeof req.body.entries === 'object' ? req.body.entries : {}
    );
    await DailyTally.upsert({
      date,
      entries: JSON.stringify(entries),
      counts: JSON.stringify(counts),
    });
    res.json({ date, entries, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
