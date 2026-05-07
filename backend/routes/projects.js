const { Router } = require('express');
const { Project } = require('../database/models');

const router = Router();

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.archived !== 'true') where.archived = false;
  const projects = await Project.findAll({ where, order: [['name', 'ASC']] });
  res.json(projects);
});

router.post('/', async (req, res) => {
  const project = await Project.create(req.body);
  res.status(201).json(project);
});

router.put('/:id', async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  await project.update(req.body);
  return res.json(project);
});

module.exports = router;
