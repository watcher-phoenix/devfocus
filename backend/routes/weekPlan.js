const { Router } = require('express');
const { WeekPlan, WorkItem, Project } = require('../database/models');

const router = Router();

router.get('/:weekStart', async (req, res) => {
  let plan = await WeekPlan.findOne({ where: { weekStart: req.params.weekStart } });
  if (!plan) {
    plan = await WeekPlan.create({ weekStart: req.params.weekStart });
  }
  res.json(plan);
});

router.put('/:weekStart', async (req, res) => {
  let plan = await WeekPlan.findOne({ where: { weekStart: req.params.weekStart } });
  if (!plan) {
    plan = await WeekPlan.create({ weekStart: req.params.weekStart, ...req.body });
  } else {
    await plan.update(req.body);
  }
  res.json(plan);
});

router.get('/:weekStart/items', async (req, res) => {
  const start = new Date(req.params.weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 4); // Mon-Fri

  const items = await WorkItem.findAll({
    where: {
      scheduledDate: {
        [require('sequelize').Op.between]: [
          req.params.weekStart,
          end.toISOString().split('T')[0],
        ],
      },
    },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['sortOrder', 'ASC'], ['priority', 'DESC']],
  });
  res.json(items);
});

module.exports = router;
