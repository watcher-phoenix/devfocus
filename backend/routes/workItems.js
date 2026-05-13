const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, UserSettings, StatusConfig } = require('../database/models');
const { getTimeInET, isWeekendET } = require('../utilities/timezone');

const router = Router();

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }

async function spawnNextRecurrence(item) {
  if (!item.recurrenceRule) return;
  const parentId = item.recurrenceParentId || item.id;

  // Don't spawn if there's already a pending instance
  const existing = await WorkItem.findOne({
    where: {
      [Op.or]: [{ recurrenceParentId: parentId }, { id: parentId }],
      status: { [Op.notIn]: ['done', 'cancelled'] },
      id: { [Op.ne]: item.id },
    },
  });
  if (existing) return;

  const base = item.scheduledDate ? new Date(item.scheduledDate + 'T12:00:00') : new Date();
  let next;
  switch (item.recurrenceRule) {
    case 'daily': next = addDays(base, 1); break;
    case 'weekly': next = addDays(base, 7); break;
    case 'biweekly': next = addDays(base, 14); break;
    case 'monthly': next = addMonths(base, 1); break;
    default: return;
  }

  await WorkItem.create({
    title: item.title,
    description: item.description,
    type: item.type,
    priority: item.priority,
    projectId: item.projectId,
    recurrenceRule: item.recurrenceRule,
    recurrenceParentId: parentId,
    scheduledDate: next.toLocaleDateString('en-CA'),
    status: 'scheduled',
    sortOrder: 0,
  });
}

async function isCompletionStatus(key) {
  const cfg = await StatusConfig.findOne({ where: { key } });
  return cfg?.isCompletion || false;
}

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
  // All weekend work is after hours
  if (isWeekendET(d)) return true;
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

  const wasCompletion = await isCompletionStatus(item.status);
  const willBeCompletion = req.body.status ? await isCompletionStatus(req.body.status) : wasCompletion;
  if (req.body.status && willBeCompletion && !wasCompletion) {
    req.body.completedAt = new Date();
  }

  await item.update(req.body);

  // Spawn next recurrence on completion or cancellation of a single instance
  if (req.body.status && (willBeCompletion || req.body.status === 'cancelled') && !wasCompletion && item.status !== 'cancelled') {
    await spawnNextRecurrence(item);
  }

  const full = await WorkItem.findByPk(item.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  return res.json(full);
});

router.patch('/:id/status', async (req, res) => {
  const item = await WorkItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const wasCompletion = await isCompletionStatus(item.status);
  const willBeCompletion = await isCompletionStatus(req.body.status);
  const update = { status: req.body.status };
  if (willBeCompletion && !wasCompletion) {
    update.completedAt = new Date();
  }

  await item.update(update);

  if ((willBeCompletion || req.body.status === 'cancelled') && !wasCompletion && item.status !== 'cancelled') {
    await spawnNextRecurrence(item);
  }

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

  // If deleting a recurrence template, stop recurrence on children
  if (item.recurrenceRule && !item.recurrenceParentId) {
    await WorkItem.update(
      { recurrenceRule: null, recurrenceParentId: null },
      { where: { recurrenceParentId: item.id } }
    );
  }

  await item.destroy();
  return res.json({ success: true });
});

module.exports = router;
