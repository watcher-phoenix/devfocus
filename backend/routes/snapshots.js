const { Router } = require('express');
const { ContextSnapshot, Project } = require('../database/models');

const router = Router();

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.projectId) where.projectId = req.query.projectId;
  if (req.query.active !== undefined) where.active = req.query.active === 'true';

  const snapshots = await ContextSnapshot.findAll({
    where,
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['lastTouchedAt', 'DESC']],
  });
  res.json(snapshots);
});

router.post('/', async (req, res) => {
  const snapshot = await ContextSnapshot.create({
    ...req.body,
    active: true,
    lastTouchedAt: new Date(),
  });
  const full = await ContextSnapshot.findByPk(snapshot.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  res.status(201).json(full);
});

router.put('/:id', async (req, res) => {
  const snapshot = await ContextSnapshot.findByPk(req.params.id);
  if (!snapshot) return res.status(404).json({ error: 'Not found' });

  await snapshot.update({ ...req.body, lastTouchedAt: new Date() });
  const full = await ContextSnapshot.findByPk(snapshot.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  return res.json(full);
});

router.post('/:id/reactivate', async (req, res) => {
  const snapshot = await ContextSnapshot.findByPk(req.params.id);
  if (!snapshot) return res.status(404).json({ error: 'Not found' });
  await snapshot.update({ active: true });
  const full = await ContextSnapshot.findByPk(snapshot.id, {
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
  });
  return res.json(full);
});

router.post('/:id/deactivate', async (req, res) => {
  const snapshot = await ContextSnapshot.findByPk(req.params.id);
  if (!snapshot) return res.status(404).json({ error: 'Not found' });
  await snapshot.update({ active: false });
  return res.json(snapshot);
});

module.exports = router;
