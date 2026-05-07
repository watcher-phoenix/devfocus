const { Router } = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { WorkItem, CachedEvent, Project } = require('../database/models');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    const sinceDate = since.toISOString().split('T')[0];

    // Completed work items
    const completedItems = await WorkItem.findAll({
      where: { status: 'done', completedAt: { [Op.gte]: since } },
      include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'color'] }],
      order: [['completedAt', 'DESC']],
    });

    // Meetings
    const meetings = await CachedEvent.findAll({
      where: { date: { [Op.gte]: sinceDate }, allDay: false },
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
    const prsReviewed = completedItems.filter((i) => i.type === 'review').length;
    const prsMerged = completedItems.filter((i) => i.type === 'pr').length;
    const jiraTickets = completedItems.filter((i) => i.type === 'jira').length;
    const strategicItems = completedItems.filter((i) => i.type === 'strategic').length;

    // After-hours work: items completed outside work hours
    let workStart = 7.5 * 60; // 7:30 default
    let workEnd = 16 * 60; // 4:00 default
    try {
      const { UserSettings } = require('../database/models');
      const settings = await UserSettings.findOne();
      if (settings) {
        const [sh, sm] = settings.workStartTime.split(':').map(Number);
        const [eh, em] = settings.workEndTime.split(':').map(Number);
        workStart = sh * 60 + sm;
        workEnd = eh * 60 + em;
      }
    } catch { /* use defaults */ }

    const afterHoursItems = completedItems.filter((item) => {
      if (!item.completedAt) return false;
      const d = new Date(item.completedAt);
      const mins = d.getHours() * 60 + d.getMinutes();
      return mins < workStart || mins > workEnd;
    });

    const afterHoursMeetings = meetings.filter((event) => {
      const d = new Date(event.startTime);
      const mins = d.getHours() * 60 + d.getMinutes();
      return mins < workStart || mins > workEnd;
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
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

module.exports = router;
