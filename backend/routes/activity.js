const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, sequelize } = require('../database/models');

const router = Router();

// Get completed items grouped by date
router.get('/', async (req, res) => {
  const { days = 14 } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const items = await WorkItem.findAll({
    where: {
      status: 'done',
      completedAt: { [Op.gte]: since },
    },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['completedAt', 'DESC']],
  });

  // Group by date
  const grouped = {};
  items.forEach((item) => {
    const date = item.completedAt
      ? new Date(item.completedAt).toISOString().split('T')[0]
      : 'unknown';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });

  res.json({ items, grouped, totalCount: items.length });
});

// Quick log — record something you already finished
router.post('/log', async (req, res) => {
  const { title, type, projectId, ticketId, ticketUrl, date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

  const completedAt = date ? new Date(date + 'T17:00:00') : new Date();

  const item = await WorkItem.create({
    title: title.trim(),
    status: 'done',
    type: type || 'task',
    priority: 0,
    projectId: projectId || null,
    externalId: ticketId || null,
    externalUrl: ticketUrl || null,
    externalSource: ticketId ? 'jira' : null,
    completedAt,
    scheduledDate: completedAt.toISOString().split('T')[0],
  });

  const full = await WorkItem.findByPk(item.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  return res.status(201).json(full);
});

module.exports = router;
