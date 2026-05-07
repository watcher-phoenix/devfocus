const { Router } = require('express');
const { WorkItem } = require('../database/models');

const router = Router();

// Quick capture — title only, zero friction
router.post('/capture', async (req, res) => {
  const { title, type } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

  const item = await WorkItem.create({
    title: title.trim(),
    status: 'inbox',
    type: type || 'task',
    priority: 0,
  });
  return res.status(201).json(item);
});

module.exports = router;
