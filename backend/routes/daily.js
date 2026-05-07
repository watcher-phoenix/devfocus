const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, ContextSnapshot, CachedEvent } = require('../database/models');

const router = Router();

function getDayOfWeek(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

router.get('/:date', async (req, res) => {
  const { date } = req.params;
  const targetDate = date === 'today' ? new Date().toISOString().split('T')[0] : date;

  // Priorities: items scheduled for today with priority >= 2, or status 'active'
  const priorities = await WorkItem.findAll({
    where: {
      [Op.or]: [
        { scheduledDate: targetDate, priority: { [Op.gte]: 2 } },
        { scheduledDate: targetDate, status: 'active' },
      ],
    },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['priority', 'DESC'], ['sortOrder', 'ASC']],
    limit: 5,
  });

  // Most recently touched active context snapshot
  const snapshot = await ContextSnapshot.findOne({
    where: { active: true },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['lastTouchedAt', 'DESC']],
  });

  // Inbox count and recent items
  const inboxCount = await WorkItem.count({ where: { status: 'inbox' } });
  const inboxRecent = await WorkItem.findAll({
    where: { status: 'inbox' },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  // Calendar events for today
  const events = await CachedEvent.findAll({
    where: { date: targetDate },
    order: [['startTime', 'ASC']],
  });

  const meetingMinutes = events.reduce((sum, e) => {
    if (e.allDay) return sum;
    return sum + (new Date(e.endTime) - new Date(e.startTime)) / 60000;
  }, 0);

  const workdayMinutes = 8 * 60;
  const focusMinutes = Math.max(0, workdayMinutes - meetingMinutes);

  res.json({
    date: targetDate,
    dayOfWeek: getDayOfWeek(targetDate),
    weekStart: getWeekStart(targetDate),
    meetings: {
      count: events.filter((e) => !e.allDay).length,
      totalMinutes: Math.round(meetingMinutes),
      events,
    },
    focusMinutes: Math.round(focusMinutes),
    priorities,
    snapshot,
    inbox: { count: inboxCount, recent: inboxRecent },
  });
});

module.exports = router;
