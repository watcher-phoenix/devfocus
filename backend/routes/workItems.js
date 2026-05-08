const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, UserSettings } = require('../database/models');
const { getTimeInET } = require('../utilities/timezone');

const router = Router();

async function getWorkHourBounds() {
  let workStartMins = 450; // 7:30
  let workEndMins = 960; // 16:00
  try {
    const settings = await UserSettings.findOne();
    if (settings) {
      const [sh, sm] = settings.workStartTime.split(':').map(Number);
      const [eh, em] = settings.workEndTime.split(':').map(Number);
      workStartMins = sh * 60 + sm;
      workEndMins = eh * 60 + em;
    }
  } catch { /* use defaults */ }
  return { workStartMins, workEndMins };
}

function isAfterHours(completedAt, workStartMins, workEndMins) {
  if (!completedAt) return false;
  const d = new Date(completedAt);
  const { hour, minute, totalMinutes } = getTimeInET(d);
  // Skip items logged at exactly noon ET (default for past-date logging)
  if (hour === 12 && minute === 0) return false;
  return totalMinutes < workStartMins || totalMinutes > workEndMins;
}

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.type) where.type = req.query.type;
  if (req.query.scheduledDate) where.scheduledDate = req.query.scheduledDate;
  if (req.query.statuses) where.status = { [Op.in]: req.query.statuses.split(',') };

  const items = await WorkItem.findAll({
    where,
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [
      ['sortOrder', 'ASC'],
      ['priority', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  const { workStartMins, workEndMins } = await getWorkHourBounds();
  const result = items.map((item) => {
    const json = item.toJSON();
    json.afterHours = isAfterHours(item.completedAt, workStartMins, workEndMins);
    return json;
  });
  res.json(result);
});

router.post('/', async (req, res) => {
  const item = await WorkItem.create(req.body);
  const full = await WorkItem.findByPk(item.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  res.status(201).json(full);
});

router.put('/:id', async (req, res) => {
  const item = await WorkItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  if (req.body.status === 'done' && item.status !== 'done') {
    req.body.completedAt = new Date();
  }

  await item.update(req.body);
  const full = await WorkItem.findByPk(item.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  return res.json(full);
});

router.patch('/:id/status', async (req, res) => {
  const item = await WorkItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const update = { status: req.body.status };
  if (req.body.status === 'done' && item.status !== 'done') {
    update.completedAt = new Date();
  }

  await item.update(update);
  return res.json(item);
});

router.patch('/:id/sort', async (req, res) => {
  const item = await WorkItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  await item.update({
    sortOrder: req.body.sortOrder,
    status: req.body.status || item.status,
    scheduledDate: req.body.scheduledDate !== undefined ? req.body.scheduledDate : item.scheduledDate,
  });
  return res.json(item);
});

router.delete('/:id', async (req, res) => {
  const item = await WorkItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  await item.destroy();
  return res.json({ success: true });
});

module.exports = router;
