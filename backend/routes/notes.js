const { Router } = require('express');
const { DailyNote } = require('../database/models');
const { getTodayET } = require('../utilities/timezone');

const router = Router();

// Get note for a specific date
router.get('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const note = await DailyNote.findOne({ where: { date } });
    res.json(note || { date, content: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List recent notes (for the dedicated Notes page)
router.get('/', async (req, res) => {
  try {
    const notes = await DailyNote.findAll({
      where: { content: { [require('sequelize').Op.ne]: '' } },
      order: [['date', 'DESC']],
      limit: 30,
    });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert note for a date
router.put('/:date', async (req, res) => {
  try {
    const date = req.params.date === 'today' ? getTodayET() : req.params.date;
    const { content } = req.body;
    const [note] = await DailyNote.upsert({ date, content });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
