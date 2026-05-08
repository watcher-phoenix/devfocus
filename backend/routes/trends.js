const { Router } = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { WorkItem, CachedEvent, Project } = require('../database/models');
const { getDaysAgoET } = require('../utilities/timezone');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { days = 30, from, to } = req.query;
    let sinceDate;
    let untilDate;
    if (from && to) {
      sinceDate = from;
      untilDate = to;
    } else {
      sinceDate = getDaysAgoET(parseInt(days));
      untilDate = null; // no upper bound — through today
    }
    const since = new Date(sinceDate + 'T00:00:00');
    const until = untilDate ? new Date(untilDate + 'T23:59:59') : null;

    // Completed work items
    const completedWhere = { status: 'done', completedAt: { [Op.gte]: since } };
    if (until) completedWhere.completedAt = { [Op.gte]: since, [Op.lte]: until };
    const completedItems = await WorkItem.findAll({
      where: completedWhere,
      include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
      order: [['completedAt', 'DESC']],
    });

    // Meetings
    const meetingWhere = { date: { [Op.gte]: sinceDate }, allDay: false };
    if (untilDate) meetingWhere.date = { [Op.gte]: sinceDate, [Op.lte]: untilDate };
    const meetings = await CachedEvent.findAll({
      where: meetingWhere,
      order: [['startTime', 'ASC']],
    });

    // --- Metrics ---

    // Items completed per week
    const weeklyCompletions = {};
    completedItems.forEach((item) => {
      const d = new Date(item.completedAt);
      const weekStart = getWeekStart(d);
      if (!weeklyCompletions[weekStart]) weeklyCompletions[weekStart] = 0;
      weeklyCompletions[weekStart]++;
    });

    // Work type breakdown
    const typeBreakdown = {};
    completedItems.forEach((item) => {
      typeBreakdown[item.type] = (typeBreakdown[item.type] || 0) + 1;
    });

    // Project breakdown
    const projectBreakdown = {};
    completedItems.forEach((item) => {
      const name = item.project?.name || 'Unassigned';
      projectBreakdown[name] = (projectBreakdown[name] || 0) + 1;
    });

    // Get work hours for after-hours detection
    let workStartMins = 450; // 7:30
    let workEndMins = 960; // 16:00
    try {
      const { UserSettings } = require('../database/models');
      const settings = await UserSettings.findOne();
      if (settings) {
        const [sh, sm] = settings.workStartTime.split(':').map(Number);
        const [eh, em] = settings.workEndTime.split(':').map(Number);
        workStartMins = sh * 60 + sm;
        workEndMins = eh * 60 + em;
      }
    } catch { /* use defaults */ }

    const isAfterHours = (completedAt) => {
      if (!completedAt) return false;
      const d = new Date(completedAt);
      if (d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0) return false;
      const mins = d.getHours() * 60 + d.getMinutes();
      return mins < workStartMins || mins > workEndMins;
    };

    // Items grouped by type with details
    const typeDetails = {};
    completedItems.forEach((item) => {
      if (!typeDetails[item.type]) typeDetails[item.type] = [];
      typeDetails[item.type].push({
        id: item.id,
        title: item.title,
        externalId: item.externalId,
        externalUrl: item.externalUrl,
        project: item.project?.name || null,
        completedAt: item.completedAt,
        afterHours: isAfterHours(item.completedAt),
      });
    });

    // Meeting hours per week
    const weeklyMeetingMinutes = {};
    meetings.forEach((event) => {
      const weekStart = getWeekStart(new Date(event.date + 'T12:00:00'));
      const duration = (new Date(event.endTime) - new Date(event.startTime)) / 60000;
      if (!weeklyMeetingMinutes[weekStart]) weeklyMeetingMinutes[weekStart] = 0;
      weeklyMeetingMinutes[weekStart] += duration;
    });

    // Daily meeting vs focus breakdown
    const dailyBreakdown = {};
    meetings.forEach((event) => {
      if (!dailyBreakdown[event.date]) dailyBreakdown[event.date] = { meetingMinutes: 0, meetingCount: 0 };
      dailyBreakdown[event.date].meetingMinutes += (new Date(event.endTime) - new Date(event.startTime)) / 60000;
      dailyBreakdown[event.date].meetingCount++;
    });

    // Summary stats
    const totalCompleted = completedItems.length;
    const totalMeetings = meetings.length;
    const totalMeetingHours = Math.round(meetings.reduce((sum, e) => {
      return sum + (new Date(e.endTime) - new Date(e.startTime)) / 3600000;
    }, 0) * 10) / 10;
    const prsReviewed = completedItems.filter((i) => i.type === 'pr-review').length;
    const prsMerged = completedItems.filter((i) => i.type === 'pr').length;
    const jiraTickets = completedItems.filter((i) => i.type === 'jira').length;
    const strategicItems = completedItems.filter((i) => i.type === 'strategic').length;

    // After-hours counts using the same function defined above
    const afterHoursItems = completedItems.filter((item) => isAfterHours(item.completedAt));

    const afterHoursMeetings = meetings.filter((event) => {
      const d = new Date(event.startTime);
      const mins = d.getHours() * 60 + d.getMinutes();
      return mins < workStartMins || mins > workEndMins;
    });

    // Avg items per week
    const weeks = Object.keys(weeklyCompletions).length || 1;
    const avgPerWeek = Math.round((totalCompleted / weeks) * 10) / 10;

    // Avg meeting hours per week
    const meetingWeeks = Object.keys(weeklyMeetingMinutes).length || 1;
    const avgMeetingHoursPerWeek = Math.round(
      (Object.values(weeklyMeetingMinutes).reduce((s, m) => s + m, 0) / meetingWeeks / 60) * 10
    ) / 10;

    res.json({
      period: { days: parseInt(days), since: sinceDate },
      summary: {
        totalCompleted,
        totalMeetings,
        totalMeetingHours,
        prsReviewed,
        prsMerged,
        jiraTickets,
        strategicItems,
        avgItemsPerWeek: avgPerWeek,
        avgMeetingHoursPerWeek,
        afterHoursItems: afterHoursItems.length,
        afterHoursMeetings: afterHoursMeetings.length,
      },
      weeklyCompletions,
      weeklyMeetingMinutes,
      typeBreakdown,
      projectBreakdown,
      typeDetails,
      dailyBreakdown,
    });
  } catch (err) {
    console.error('Trends error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function getWeekStart(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toLocaleDateString('en-CA');
}

module.exports = router;
