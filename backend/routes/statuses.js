const { Router } = require('express');
const { StatusConfig } = require('../database/models');

const router = Router();

const DEFAULT_STATUSES = [
  { key: 'inbox', label: 'Brain Dump', color: '#9AA0A6', sortOrder: 0, isSystem: true, isCompletion: false },
  { key: 'active', label: 'Active', color: '#7C4DFF', sortOrder: 1, isSystem: true, isCompletion: false },
  { key: 'waiting', label: 'Waiting', color: '#FFD600', sortOrder: 2, isSystem: true, isCompletion: false },
  { key: 'later', label: 'Later', color: '#03A9F4', sortOrder: 3, isSystem: true, isCompletion: false },
  { key: 'scheduled', label: 'Scheduled', color: '#AB47BC', sortOrder: 4, isSystem: true, isCompletion: false },
  { key: 'done', label: 'Done', color: '#00C853', sortOrder: 5, isSystem: true, isCompletion: true },
];

async function ensureSeeded() {
  const count = await StatusConfig.count();
  if (count === 0) {
    await StatusConfig.bulkCreate(DEFAULT_STATUSES);
  }
}

// GET all statuses (seeds on first call)
router.get('/', async (req, res) => {
  await ensureSeeded();
  const statuses = await StatusConfig.findAll({ order: [['sortOrder', 'ASC']] });
  res.json(statuses);
});

// POST — add a custom status
router.post('/', async (req, res) => {
  const { key, label, color, sortOrder } = req.body;
  if (!key || !label) return res.status(400).json({ error: 'key and label are required' });

  const existing = await StatusConfig.findOne({ where: { key } });
  if (existing) return res.status(409).json({ error: `Status "${key}" already exists` });

  // Auto-assign sortOrder if not provided
  const maxOrder = await StatusConfig.max('sortOrder') || 0;
  const status = await StatusConfig.create({
    key: key.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    label,
    color: color || '#9AA0A6',
    sortOrder: sortOrder != null ? sortOrder : maxOrder + 1,
    isSystem: false,
    isCompletion: false,
  });
  res.status(201).json(status);
});

// PUT /:id — update a status (label, color, sortOrder)
router.put('/:id', async (req, res) => {
  const status = await StatusConfig.findByPk(req.params.id);
  if (!status) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  if (req.body.label != null) updates.label = req.body.label;
  if (req.body.color != null) updates.color = req.body.color;
  if (req.body.sortOrder != null) updates.sortOrder = req.body.sortOrder;

  await status.update(updates);
  res.json(status);
});

// PUT /reorder — bulk update sortOrder
router.put('/reorder/bulk', async (req, res) => {
  const { order } = req.body; // [{ id, sortOrder }]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });

  await Promise.all(order.map(({ id, sortOrder }) =>
    StatusConfig.update({ sortOrder }, { where: { id } })
  ));
  const statuses = await StatusConfig.findAll({ order: [['sortOrder', 'ASC']] });
  res.json(statuses);
});

// DELETE /:id — only non-system statuses
router.delete('/:id', async (req, res) => {
  const status = await StatusConfig.findByPk(req.params.id);
  if (!status) return res.status(404).json({ error: 'Not found' });
  if (status.isSystem) return res.status(403).json({ error: 'Cannot delete system statuses' });

  await status.destroy();
  res.json({ success: true });
});

module.exports = router;
