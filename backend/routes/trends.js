const { Router } = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { WorkItem, CachedEvent, Project, UserSettings, DailyTally } = require('../database/models');
const { getDaysAgoET, getTodayET, getTimeInET, isWeekendET } = require('../utilities/timezone');
const { makeIsExcludedMeeting } = require('../utilities/meetings');

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

    // Shared date filter for cached calendar events. Calendar events are synced
    // ~28 days into the future, so without an upper bound, future meetings and OOO
    // would leak into the totals. Cap at today (or the explicit `to`) so Trends
    // only reflects events that have actually happened.
    const eventDateWhere = untilDate
      ? { [Op.gte]: sinceDate, [Op.lte]: untilDate }
      : { [Op.gte]: sinceDate, [Op.lte]: getTodayET() };

    // User's meeting exclude keywords (also drops Focus time blocks)
    const userSettings = await UserSettings.findOne();
    const isExcludedMeeting = makeIsExcludedMeeting(userSettings?.meetingExcludeKeywords ?? 'lunch');

    // Out-of-office events (vacation / OOO blocks)
    const oooEvents = await CachedEvent.findAll({
      where: { date: eventDateWhere, isOOO: true },
      order: [['startTime', 'ASC']],
    });

    // Dates with an all-day OOO block — drop every meeting on these days so OOO days don't skew meeting hours
    const oooAllDayDates = new Set(oooEvents.filter((e) => e.allDay).map((e) => e.date));

    // Timed OOO blocks grouped by date — meeting time overlapping these is subtracted (prorated) from meeting hours
    const oooTimedIntervalsByDate = {};
    oooEvents.filter((e) => !e.allDay).forEach((e) => {
      if (!oooTimedIntervalsByDate[e.date]) oooTimedIntervalsByDate[e.date] = [];
      oooTimedIntervalsByDate[e.date].push({
        start: new Date(e.startTime).getTime(),
        end: new Date(e.endTime).getTime(),
      });
    });
    // A meeting fully covered by OOO (all-day date, or entirely inside timed OOO blocks) is dropped outright;
    // partially-overlapping meetings stay and have the overlap prorated out of their minutes below.
    const fullyOOO = (event) => {
      if (oooAllDayDates.has(event.date)) return true;
      const intervals = oooTimedIntervalsByDate[event.date];
      if (!intervals) return false;
      const remaining = subtractIntervals(
        { start: new Date(event.startTime).getTime(), end: new Date(event.endTime).getTime() },
        intervals
      );
      return remaining.reduce((sum, iv) => sum + (iv.end - iv.start), 0) === 0;
    };

    // Meetings (timed, non-OOO events; Focus time + excluded titles dropped; meetings fully covered by OOO dropped)
    const meetings = (await CachedEvent.findAll({
      where: { date: eventDateWhere, allDay: false, isOOO: false },
      order: [['startTime', 'ASC']],
    })).filter((e) => !isExcludedMeeting(e.title) && !fullyOOO(e));

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
    const projectColors = {};
    const projectDetails = {};
    completedItems.forEach((item) => {
      const name = item.project?.name || 'Unassigned';
      projectBreakdown[name] = (projectBreakdown[name] || 0) + 1;
      if (item.project?.color) projectColors[name] = item.project.color;
      if (!projectDetails[name]) projectDetails[name] = [];
      projectDetails[name].push({
        id: item.id,
        title: item.title,
        type: item.type,
        externalId: item.externalId,
        externalUrl: item.externalUrl,
        completedAt: item.completedAt,
        afterHours: false, // will be set below after isAfterHours is defined
      });
    });

    // Get work hours for after-hours detection (reuse settings loaded above)
    let workStartMins = 450; // 7:30
    let workEndMins = 960; // 16:00
    if (userSettings) {
      const [sh, sm] = userSettings.workStartTime.split(':').map(Number);
      const [eh, em] = userSettings.workEndTime.split(':').map(Number);
      workStartMins = sh * 60 + sm;
      workEndMins = eh * 60 + em;
    }

    const isAfterHours = (completedAt) => {
      if (!completedAt) return false;
      const d = new Date(completedAt);
      if (isWeekendET(d)) return true;
      const { hour, minute, totalMinutes } = getTimeInET(d);
      if (hour === 12 && minute === 0) return false;
      return totalMinutes < workStartMins || totalMinutes > workEndMins;
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

    // Set afterHours on projectDetails now that isAfterHours is defined
    Object.values(projectDetails).forEach((items) => {
      items.forEach((item) => { item.afterHours = isAfterHours(item.completedAt); });
    });

    // Group meetings by date for overlap-aware calculations
    const meetingsByDate = {};
    meetings.forEach((event) => {
      if (!meetingsByDate[event.date]) meetingsByDate[event.date] = [];
      meetingsByDate[event.date].push(event);
    });

    // Meeting hours per week (merged overlaps, OOO time prorated out)
    const weeklyMeetingMinutes = {};
    Object.entries(meetingsByDate).forEach(([date, dayMeetings]) => {
      const weekStart = getWeekStart(new Date(date + 'T12:00:00'));
      if (!weeklyMeetingMinutes[weekStart]) weeklyMeetingMinutes[weekStart] = 0;
      weeklyMeetingMinutes[weekStart] += getMergedMinutes(dayMeetings, oooTimedIntervalsByDate[date]);
    });

    // Daily meeting vs focus breakdown (merged overlaps, OOO time prorated out)
    const dailyBreakdown = {};
    Object.entries(meetingsByDate).forEach(([date, dayMeetings]) => {
      dailyBreakdown[date] = {
        meetingMinutes: getMergedMinutes(dayMeetings, oooTimedIntervalsByDate[date]),
        meetingCount: dayMeetings.length,
      };
    });

    // --- Non-task tally totals (Interrupted / Helped / Firefighting / etc.) ---
    // Parsed before context switches because every tally is itself a context
    // switch (a "yank" off whatever you were doing), so they feed the count below.
    const tallyRows = await DailyTally.findAll({ where: { date: eventDateWhere } });
    const tallyTotals = {};
    // Per-entry detail (timestamp + note) so the dashboard can surface the
    // qualitative "why" behind each category, not just the count.
    const tallyDetails = {};
    // Per-day total tally count — each tally is one distinct switch (no dedup).
    const tallyCountByDate = {};
    tallyRows.forEach((row) => {
      let counts = {};
      try { counts = JSON.parse(row.counts || '{}'); } catch { counts = {}; }
      Object.entries(counts).forEach(([k, v]) => {
        const n = Number(v) || 0;
        tallyTotals[k] = (tallyTotals[k] || 0) + n;
        tallyCountByDate[row.date] = (tallyCountByDate[row.date] || 0) + n;
      });
      let entries = {};
      try { entries = JSON.parse(row.entries || '{}'); } catch { entries = {}; }
      Object.entries(entries).forEach(([k, list]) => {
        if (!Array.isArray(list)) return;
        list.forEach((e) => {
          if (e && typeof e === 'object' && (e.note || e.ts)) {
            if (!tallyDetails[k]) tallyDetails[k] = [];
            tallyDetails[k].push({ date: row.date, ts: e.ts || '', note: e.note || '' });
          }
        });
      });
    });

    // --- Context switches (derived, zero-overhead) ---
    // Build a per-day timeline of "contexts" from completed work (labeled by project)
    // and meetings, ordered by time, then count how many times the context changes.
    // Consecutive items in the same context don't count as a switch. On top of that,
    // every non-task tally counts as one switch — each is a distinct "yank" off task
    // (no dedup) — so a day's total = work/meeting context changes + tally count.
    const dateStrET = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const ctxEventsByDate = {};
    const pushCtx = (date, time, label) => {
      if (!ctxEventsByDate[date]) ctxEventsByDate[date] = [];
      ctxEventsByDate[date].push({ time: new Date(time).getTime(), label });
    };
    completedItems.forEach((item) => {
      if (!item.completedAt) return;
      pushCtx(dateStrET(item.completedAt), item.completedAt, item.project?.name || 'Unassigned');
    });
    meetings.forEach((event) => pushCtx(event.date, event.startTime, 'Meeting'));

    const contextTimeline = {};
    let totalSwitches = 0;
    // Union of every date with work/meeting activity or tallies, so tally-only
    // days still register their switches.
    const switchDates = new Set([...Object.keys(ctxEventsByDate), ...Object.keys(tallyCountByDate)]);
    switchDates.forEach((date) => {
      const evs = ctxEventsByDate[date] || [];
      evs.sort((a, b) => a.time - b.time);
      const sequence = [];
      evs.forEach((e) => {
        if (sequence.length === 0 || sequence[sequence.length - 1] !== e.label) sequence.push(e.label);
      });
      const tallySwitches = tallyCountByDate[date] || 0;
      const switches = Math.max(0, sequence.length - 1) + tallySwitches;
      totalSwitches += switches;
      contextTimeline[date] = { sequence, switches, tallySwitches };
    });
    const switchDays = switchDates.size || 1;
    const avgSwitchesPerDay = Math.round((totalSwitches / switchDays) * 10) / 10;

    // Flat item-level rows for external dashboards (live drill-down, charts).
    // releaseWeek/releaseDay are intentionally omitted — they're a client-side
    // construct (a fixed release cadence), so consumers derive them from completedISO.
    const items = completedItems.map((i) => ({
      type: i.type,
      title: i.title,
      project: i.project?.name || 'Unassigned',
      completedISO: i.completedAt ? dateStrET(i.completedAt) : null,
      completedAt: i.completedAt,
      externalId: i.externalId || '',
      externalUrl: i.externalUrl || null,
      afterHours: isAfterHours(i.completedAt),
    }));

    // Summary stats
    const totalCompleted = completedItems.length;
    const totalMeetings = meetings.length;
    const totalMergedMinutes = Object.entries(meetingsByDate).reduce(
      (sum, [date, dayMeetings]) => sum + getMergedMinutes(dayMeetings, oooTimedIntervalsByDate[date]), 0
    );
    const totalMeetingHours = Math.round(totalMergedMinutes / 6) / 10;

    // Out-of-office: all-day blocks count as days, timed blocks count as hours
    const oooDayDates = new Set();
    const oooTimedByDate = {};
    oooEvents.forEach((event) => {
      if (event.allDay) {
        oooDayDates.add(event.date);
      } else {
        if (!oooTimedByDate[event.date]) oooTimedByDate[event.date] = [];
        oooTimedByDate[event.date].push(event);
      }
    });
    const oooDays = oooDayDates.size;
    const oooTimedMinutes = Object.values(oooTimedByDate).reduce(
      (sum, dayEvents) => sum + getMergedMinutes(dayEvents), 0
    );
    const oooHours = Math.round(oooTimedMinutes / 6) / 10;
    const prsReviewed = completedItems.filter((i) => i.type === 'pr-review').length;
    const prsMerged = completedItems.filter((i) => i.type === 'pr').length;
    const jiraTickets = completedItems.filter((i) => i.type === 'jira').length;
    const strategicItems = completedItems.filter((i) => i.type === 'strategic').length;

    // After-hours counts using the same function defined above
    const afterHoursItems = completedItems.filter((item) => isAfterHours(item.completedAt));

    const afterHoursMeetings = meetings.filter((event) => {
      const { totalMinutes } = getTimeInET(new Date(event.startTime));
      return totalMinutes < workStartMins || totalMinutes > workEndMins;
    });

    // Avg items per week
    const weeks = Object.keys(weeklyCompletions).length || 1;
    const avgPerWeek = Math.round((totalCompleted / weeks) * 10) / 10;

    // Avg meeting hours per week
    const meetingWeeks = Object.keys(weeklyMeetingMinutes).length || 1;
    const avgMeetingHoursPerWeek = Math.round(
      (Object.values(weeklyMeetingMinutes).reduce((s, m) => s + m, 0) / meetingWeeks / 60) * 10
    ) / 10;

    // --- Focus time ---
    // Per workday, focus minutes = the work-hours window minus meeting time and
    // timed OOO that lands in it (clipped at 0). Weekends and all-day-OOO days
    // contribute no workday. Aggregated by week alongside meeting load so the
    // dashboard can show a meetings-vs-focus split.
    const workdayMinutes = Math.max(0, workEndMins - workStartMins);
    const weeklyFocusMinutes = {};
    let totalFocusMinutes = 0;
    // Never credit focus for days that haven't happened yet — cap at today, the
    // same way meetings/items are bounded.
    const todayET = getTodayET();
    const focusRangeEnd = untilDate && untilDate < todayET ? untilDate : todayET;
    for (
      let cur = new Date(sinceDate + 'T12:00:00Z'), end = new Date(focusRangeEnd + 'T12:00:00Z');
      cur <= end;
      cur.setUTCDate(cur.getUTCDate() + 1)
    ) {
      const dateStr = cur.toISOString().slice(0, 10);
      if (isWeekendET(new Date(dateStr + 'T12:00:00'))) continue;
      if (oooAllDayDates.has(dateStr)) continue;
      const meetingMin = dailyBreakdown[dateStr]?.meetingMinutes || 0;
      const oooTimedMin = getMergedMinutes(oooTimedByDate[dateStr] || []);
      const used = Math.min(workdayMinutes, meetingMin + oooTimedMin);
      const focusMin = Math.max(0, workdayMinutes - used);
      const weekStart = getWeekStart(dateStr);
      weeklyFocusMinutes[weekStart] = (weeklyFocusMinutes[weekStart] || 0) + focusMin;
      totalFocusMinutes += focusMin;
    }
    const focusWeeks = Object.keys(weeklyFocusMinutes).length || 1;
    const totalFocusHours = Math.round(totalFocusMinutes / 6) / 10;
    const avgFocusHoursPerWeek = Math.round((totalFocusMinutes / focusWeeks / 60) * 10) / 10;

    // Earliest data point (ET) — when you actually started tracking work here.
    // Used as a hard floor so the range picker / presets don't reach before
    // data exists. Based on item *creation* and tally dates only. Calendar
    // events are intentionally excluded: the calendar sync backfills historical
    // meetings (well before you began using the app), so including them would
    // push the floor back to dates with no real work history.
    const [earliestItem, earliestTally] = await Promise.all([
      WorkItem.min('createdAt'),
      DailyTally.min('date'),
    ]);
    const startCandidates = [
      earliestItem ? dateStrET(new Date(earliestItem)) : null,
      earliestTally || null, // DailyTally.date is already a YYYY-MM-DD (ET) string
    ].filter(Boolean);
    const dataStart = startCandidates.length ? startCandidates.sort()[0] : null;

    res.json({
      dataStart,
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
        oooDays,
        oooHours,
        contextSwitches: totalSwitches,
        avgSwitchesPerDay,
        totalFocusHours,
        avgFocusHoursPerWeek,
      },
      contextTimeline,
      tallyTotals,
      tallyDetails,
      items,
      weeklyCompletions,
      weeklyMeetingMinutes,
      weeklyFocusMinutes,
      typeBreakdown,
      projectBreakdown,
      projectColors,
      projectDetails,
      typeDetails,
      dailyBreakdown,
      oooDates: [...oooAllDayDates].sort(),
    });
  } catch (err) {
    console.error('Trends error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Remove the portions of `interval` that overlap any interval in `subtract`, returning the leftover pieces.
function subtractIntervals(interval, subtract = []) {
  let remaining = [interval];
  subtract.forEach((sub) => {
    remaining = remaining.flatMap((iv) => {
      if (sub.end <= iv.start || sub.start >= iv.end) return [iv]; // no overlap
      const parts = [];
      if (sub.start > iv.start) parts.push({ start: iv.start, end: sub.start });
      if (sub.end < iv.end) parts.push({ start: sub.end, end: iv.end });
      return parts;
    });
  });
  return remaining;
}

// Merge overlapping meeting intervals and return total minutes, prorating out any overlapping OOO time.
function getMergedMinutes(events, oooIntervals = []) {
  if (events.length === 0) return 0;
  const intervals = events
    .map((e) => ({ start: new Date(e.startTime).getTime(), end: new Date(e.endTime).getTime() }))
    .sort((a, b) => a.start - b.start);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1];
    if (intervals[i].start < prev.end) {
      prev.end = Math.max(prev.end, intervals[i].end);
    } else {
      merged.push(intervals[i]);
    }
  }
  return merged.reduce(
    (sum, iv) => sum + subtractIntervals(iv, oooIntervals).reduce((s, p) => s + (p.end - p.start) / 60000, 0),
    0
  );
}

function getWeekStart(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

module.exports = router;
