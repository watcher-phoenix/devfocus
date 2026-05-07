const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, ContextSnapshot, CachedEvent, IntegrationConfig } = require('../database/models');

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

  // Recently completed items (today + yesterday for context)
  const yesterday = new Date(targetDate + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const recentlyDone = await WorkItem.findAll({
    where: {
      status: 'done',
      completedAt: {
        [Op.gte]: new Date(yesterdayStr + 'T00:00:00'),
        [Op.lte]: new Date(targetDate + 'T23:59:59'),
      },
    },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
    order: [['completedAt', 'DESC']],
    limit: 10,
  });

  const doneToday = recentlyDone.filter(
    (i) => i.completedAt && new Date(i.completedAt).toISOString().split('T')[0] === targetDate
  );
  const doneYesterday = recentlyDone.filter(
    (i) => i.completedAt && new Date(i.completedAt).toISOString().split('T')[0] === yesterdayStr
  );

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
    done: { today: doneToday, yesterday: doneYesterday },
    alerts: await getAlerts(),
  });
});

async function getAlerts() {
  const alerts = [];
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const configs = await IntegrationConfig.findAll({
    where: { enabled: true, tokenExpiresAt: { [Op.ne]: null } },
  });

  for (const config of configs) {
    const expires = new Date(config.tokenExpiresAt);
    if (expires <= now) {
      alerts.push({
        type: 'error',
        provider: config.provider,
        label: config.tokenLabel || config.provider,
        message: `${config.tokenLabel || config.provider} token has expired. Renew it in Settings.`,
      });
    } else if (expires <= sevenDays) {
      const days = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        type: 'warning',
        provider: config.provider,
        label: config.tokenLabel || config.provider,
        message: `${config.tokenLabel || config.provider} token expires in ${days} day${days !== 1 ? 's' : ''}. Renew it in Settings.`,
      });
    } else if (expires <= fourteenDays) {
      const days = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        type: 'info',
        provider: config.provider,
        label: config.tokenLabel || config.provider,
        message: `${config.tokenLabel || config.provider} token expires in ${days} days.`,
      });
    }
  }

  return alerts;
}

module.exports = router;
