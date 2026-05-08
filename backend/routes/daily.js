const { Router } = require('express');
const { Op } = require('sequelize');
const { WorkItem, Project, ContextSnapshot, CachedEvent, IntegrationConfig, UserSettings } = require('../database/models');
const { getTodayET, getYesterdayET, getDayOfWeek, getWeekStart } = require('../utilities/timezone');

const router = Router();

router.get('/:date', async (req, res) => {
  try {
  const { date } = req.params;
  const targetDate = date === 'today' ? getTodayET() : date;

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
  const yesterdayStr = (() => {
    const d = new Date(targetDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  })();

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

  // Dynamic work hours + meeting exclude keywords from user settings
  let workdayMinutes = 8.5 * 60;
  let excludeKeywords = ['lunch'];
  try {
    const settings = await UserSettings.findOne();
    if (settings) {
      const [startH, startM] = settings.workStartTime.split(':').map(Number);
      const [endH, endM] = settings.workEndTime.split(':').map(Number);
      workdayMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (settings.meetingExcludeKeywords) {
        excludeKeywords = settings.meetingExcludeKeywords.split(',').map((k) => k.trim().toLowerCase());
      }
    }
  } catch { /* use default */ }

  const isExcluded = (title) => {
    const lower = (title || '').trim().toLowerCase();
    return excludeKeywords.some((kw) => kw && lower === kw.toLowerCase());
  };

  const meetingEvents = events.filter((e) => !e.allDay && !isExcluded(e.title));
  const meetingMinutes = meetingEvents.reduce((sum, e) => {
    return sum + (new Date(e.endTime) - new Date(e.startTime)) / 60000;
  }, 0);
  const focusMinutes = Math.max(0, workdayMinutes - meetingMinutes);

  res.json({
    date: targetDate,
    dayOfWeek: getDayOfWeek(targetDate),
    weekStart: getWeekStart(targetDate),
    meetings: {
      count: meetingEvents.length,
      totalMinutes: Math.round(meetingMinutes),
      events,
      excludedCount: events.filter((e) => !e.allDay && isExcluded(e.title)).length,
    },
    focusMinutes: Math.round(focusMinutes),
    priorities,
    snapshot,
    inbox: { count: inboxCount, recent: inboxRecent },
    done: { today: doneToday, yesterday: doneYesterday },
    staleItems: await getStaleItems(),
    alerts: await getAlerts(),
  });
  } catch (err) {
    console.error('Daily endpoint error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Meeting data per day for a week — used by Plan page
router.get('/week-meetings/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;

    // Get exclude keywords from settings
    let excludeKw = ['lunch'];
    try {
      const s = await UserSettings.findOne();
      if (s?.meetingExcludeKeywords) {
        excludeKw = s.meetingExcludeKeywords.split(',').map((k) => k.trim().toLowerCase());
      }
    } catch { /* use defaults */ }
    const isExcl = (title) => excludeKw.some((kw) => kw && (title || '').trim().toLowerCase() === kw.toLowerCase());

    const days = {};
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart + 'T12:00:00');
      d.setDate(d.getDate() + i);
      const date = d.toISOString().split('T')[0];

      const events = await CachedEvent.findAll({
        where: { date, allDay: false },
        order: [['startTime', 'ASC']],
      });

      const realMeetings = events.filter((e) => !isExcl(e.title));
      const meetingMinutes = realMeetings.reduce((sum, e) => {
        return sum + (new Date(e.endTime) - new Date(e.startTime)) / 60000;
      }, 0);

      // Detect overlapping meetings
      let overlapCount = 0;
      const sortedMeetings = [...realMeetings].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      for (let mi = 1; mi < sortedMeetings.length; mi++) {
        if (new Date(sortedMeetings[mi].startTime) < new Date(sortedMeetings[mi - 1].endTime)) {
          overlapCount++;
        }
      }

      days[date] = {
        meetingCount: realMeetings.length,
        meetingMinutes: Math.round(meetingMinutes),
        overbooked: overlapCount > 0,
        overlapCount,
        events: events.map((e) => ({
          title: e.title,
          startTime: e.startTime,
          endTime: e.endTime,
          excluded: isExcl(e.title),
        })),
      };
    }
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getStaleItems() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stale = await WorkItem.findAll({
      where: {
        status: { [Op.in]: ['active', 'waiting', 'scheduled'] },
        updatedAt: { [Op.lte]: sevenDaysAgo },
      },
      include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
      order: [['updatedAt', 'ASC']],
      limit: 5,
    });

    return stale.map((item) => ({
      ...item.toJSON(),
      daysSinceUpdate: Math.floor((Date.now() - new Date(item.updatedAt)) / (24 * 60 * 60 * 1000)),
    }));
  } catch {
    return [];
  }
}

async function getAlerts() {
  try {
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
  } catch (err) {
    console.error('getAlerts error:', err.message);
    return [];
  }
}

module.exports = router;
