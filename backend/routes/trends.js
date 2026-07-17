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
    // Meeting *count* per week (fragmentation — how chopped-up the weeks are,
    // independent of total hours: 4h in one block vs eight 30-min meetings).
    const weeklyMeetingCounts = {};
    Object.entries(meetingsByDate).forEach(([date, dayMeetings]) => {
      const weekStart = getWeekStart(new Date(date + 'T12:00:00'));
      if (!weeklyMeetingMinutes[weekStart]) weeklyMeetingMinutes[weekStart] = 0;
      weeklyMeetingMinutes[weekStart] += getMergedMinutes(dayMeetings, oooTimedIntervalsByDate[date]);
      weeklyMeetingCounts[weekStart] = (weeklyMeetingCounts[weekStart] || 0) + dayMeetings.length;
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
    // Per-day category breakdown (key -> { count, entries: [{ts, note}] }) so a
    // day's context-switch drill-down can show WHICH yanks happened and when.
    const tallyByDate = {};
    tallyRows.forEach((row) => {
      let counts = {};
      try { counts = JSON.parse(row.counts || '{}'); } catch { counts = {}; }
      let entries = {};
      try { entries = JSON.parse(row.entries || '{}'); } catch { entries = {}; }
      const dayBreakdown = {};
      Object.entries(counts).forEach(([k, v]) => {
        const n = Number(v) || 0;
        if (n <= 0) return;
        tallyTotals[k] = (tallyTotals[k] || 0) + n;
        tallyCountByDate[row.date] = (tallyCountByDate[row.date] || 0) + n;
        const list = Array.isArray(entries[k])
          ? entries[k].map((e) => ({ ts: (e && e.ts) || '', note: (e && e.note) || '' }))
          : [];
        dayBreakdown[k] = { count: n, entries: list };
      });
      if (Object.keys(dayBreakdown).length) tallyByDate[row.date] = dayBreakdown;
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
    const pushCtx = (date, time, label, title) => {
      if (!ctxEventsByDate[date]) ctxEventsByDate[date] = [];
      ctxEventsByDate[date].push({ time: new Date(time).getTime(), label, title });
    };
    completedItems.forEach((item) => {
      if (!item.completedAt) return;
      pushCtx(dateStrET(item.completedAt), item.completedAt, item.project?.name || 'Unassigned', item.title);
    });
    meetings.forEach((event) => pushCtx(event.date, event.startTime, 'Meeting', event.title));

    const contextTimeline = {};
    let totalSwitches = 0;
    // Decompose switches into self-directed (you changed what you were working
    // on — work/meeting context changes) vs interruptions (non-task yanks logged
    // as tallies). Same total, but tells you how much churn was your own choice
    // vs imposed on you. Also tracked per week for a calmer/noisier trend.
    let selfDirectedSwitches = 0;
    let interruptionSwitches = 0;
    const weeklySwitchSplit = {};
    // Union of every date with work/meeting activity or tallies, so tally-only
    // days still register their switches.
    const switchDates = new Set([...Object.keys(ctxEventsByDate), ...Object.keys(tallyCountByDate)]);
    switchDates.forEach((date) => {
      const evs = ctxEventsByDate[date] || [];
      evs.sort((a, b) => a.time - b.time);
      const sequence = [];
      // Unified, chronological timeline of every switch this day: each work/meeting
      // context change and each non-task yank, interleaved by timestamp so the
      // drill-down can present them in time order regardless of kind.
      const timeline = [];
      evs.forEach((e) => {
        if (sequence.length === 0 || sequence[sequence.length - 1] !== e.label) {
          sequence.push(e.label);
          timeline.push({
            ts: new Date(e.time).toISOString(),
            kind: e.label === 'Meeting' ? 'meeting' : 'work',
            label: e.label,
            // The task that opened this context (project run), so the drill-down
            // can show the task name alongside its project.
            title: e.title || null,
          });
        }
      });
      const dayBreakdown = tallyByDate[date] || {};
      Object.entries(dayBreakdown).forEach(([key, b]) => {
        (b.entries || []).forEach((entry) => {
          timeline.push({ ts: entry.ts || '', kind: 'yank', key, note: entry.note || '' });
        });
      });
      // Sort by timestamp; tallies logged without a time sort to the end.
      timeline.sort((a, b) => {
        if (!a.ts) return 1;
        if (!b.ts) return -1;
        return a.ts.localeCompare(b.ts);
      });
      const tallySwitches = tallyCountByDate[date] || 0;
      const selfSwitches = Math.max(0, sequence.length - 1);
      const switches = selfSwitches + tallySwitches;
      totalSwitches += switches;
      selfDirectedSwitches += selfSwitches;
      interruptionSwitches += tallySwitches;
      const wk = getWeekStart(date);
      if (!weeklySwitchSplit[wk]) weeklySwitchSplit[wk] = { self: 0, interruptions: 0 };
      weeklySwitchSplit[wk].self += selfSwitches;
      weeklySwitchSplit[wk].interruptions += tallySwitches;
      contextTimeline[date] = { sequence, timeline, switches, tallySwitches, tallyBreakdown: dayBreakdown };
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
      // Turnaround from creation to completion, in days (null when it can't be
      // computed — e.g. backfilled items whose logged completion predates their
      // creation timestamp). See avgCycleDays/medianCycleDays in summary.
      cycleDays: (i.completedAt && i.createdAt && new Date(i.completedAt) >= new Date(i.createdAt))
        ? Math.round(((new Date(i.completedAt) - new Date(i.createdAt)) / 86400000) * 10) / 10
        : null,
    }));

    // --- Cycle time (created → done) ---
    // Median is the headline (robust to the odd months-old task that finally got
    // closed); average is provided alongside. Only positive cycles count, so
    // backfilled work logged with an earlier completion date doesn't skew it.
    const cycleSamples = items.map((i) => i.cycleDays).filter((d) => d !== null);
    const avgCycleDays = cycleSamples.length
      ? Math.round((cycleSamples.reduce((a, b) => a + b, 0) / cycleSamples.length) * 10) / 10
      : null;
    const medianCycleDays = cycleSamples.length ? Math.round(median(cycleSamples) * 10) / 10 : null;

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
    // Protected-time counters (workdays only, weekends/all-day-OOO excluded):
    //  - workdays: denominator for "X of N workdays"
    //  - meetingFreeDays: zero meetings — true deep-work days
    //  - heavyMeetingDays: 4+ meetings — chopped-up days
    let workdays = 0;
    let meetingFreeDays = 0;
    let heavyMeetingDays = 0;
    // Longest uninterrupted focus block: the biggest stretch of the work-hours
    // window with no meeting on the calendar, across all workdays in range.
    let longestFocusBlock = null; // { date, minutes, fromMin, toMin }
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

      // Protected-time tallies for this workday.
      workdays += 1;
      const dayMeetingCount = dailyBreakdown[dateStr]?.meetingCount || 0;
      if (dayMeetingCount === 0) meetingFreeDays += 1;
      if (dayMeetingCount >= 4) heavyMeetingDays += 1;

      // Largest meeting-free gap inside the work window — clip each meeting to
      // [workStart, workEnd], sweep left→right, and take the widest uncovered
      // stretch. Kept as the period-wide best.
      const busy = (meetingsByDate[dateStr] || [])
        .map((e) => ({
          start: Math.max(workStartMins, Math.min(getTimeInET(new Date(e.startTime)).totalMinutes, workEndMins)),
          end: Math.max(workStartMins, Math.min(getTimeInET(new Date(e.endTime)).totalMinutes, workEndMins)),
        }))
        .filter((iv) => iv.end > iv.start)
        .sort((a, b) => a.start - b.start);
      let cursor = workStartMins;
      let dayGap = 0;
      let dayFrom = workStartMins;
      let dayTo = workEndMins;
      const considerGap = (from, to) => {
        if (to - from > dayGap) { dayGap = to - from; dayFrom = from; dayTo = to; }
      };
      busy.forEach((iv) => {
        if (iv.start > cursor) considerGap(cursor, iv.start);
        cursor = Math.max(cursor, iv.end);
      });
      if (workEndMins > cursor) considerGap(cursor, workEndMins);
      if (!longestFocusBlock || dayGap > longestFocusBlock.minutes) {
        longestFocusBlock = { date: dateStr, minutes: dayGap, fromMin: dayFrom, toMin: dayTo };
      }
    }
    const focusWeeks = Object.keys(weeklyFocusMinutes).length || 1;
    const totalFocusHours = Math.round(totalFocusMinutes / 6) / 10;
    const avgFocusHoursPerWeek = Math.round((totalFocusMinutes / focusWeeks / 60) * 10) / 10;

    // --- Consistency / streaks ---
    // Days with at least one completed item, and the longest run of consecutive
    // calendar days. currentStreak is the run ending on the most recent active
    // day, but only counts as "current" if that day is today or yesterday.
    const activeDates = [...new Set(items.map((i) => i.completedISO).filter(Boolean))].sort();
    const activeDays = activeDates.length;
    let longestStreak = 0;
    let runLen = 0;
    let prevDate = null;
    activeDates.forEach((d) => {
      runLen = prevDate && isoDayDiff(prevDate, d) === 1 ? runLen + 1 : 1;
      if (runLen > longestStreak) longestStreak = runLen;
      prevDate = d;
    });
    let currentStreak = 0;
    if (activeDates.length) {
      currentStreak = 1;
      for (let i = activeDates.length - 1; i > 0; i--) {
        if (isoDayDiff(activeDates[i - 1], activeDates[i]) === 1) currentStreak += 1;
        else break;
      }
      if (isoDayDiff(activeDates[activeDates.length - 1], getTodayET()) > 1) currentStreak = 0;
    }

    // --- Work in progress / carryover (current snapshot, not range-bound) ---
    // Everything not done or cancelled, with age since creation. Answers "what's
    // piling up," the half of the picture completions alone never show.
    const openItems = await WorkItem.findAll({
      where: { status: { [Op.notIn]: ['done', 'cancelled'] } },
      include: [{ model: Project, as: 'project', attributes: ['name', 'color'] }],
      order: [['createdAt', 'ASC']],
    });
    const nowMs = new Date(getTodayET() + 'T23:59:59').getTime();
    const wipByStatus = {};
    const wipItems = openItems.map((i) => {
      wipByStatus[i.status] = (wipByStatus[i.status] || 0) + 1;
      return {
        id: i.id,
        title: i.title,
        status: i.status,
        type: i.type,
        project: i.project?.name || 'Unassigned',
        ageDays: Math.max(0, Math.floor((nowMs - new Date(i.createdAt).getTime()) / 86400000)),
        externalUrl: i.externalUrl || null,
      };
    });
    const wipAges = wipItems.map((i) => i.ageDays);
    const wip = {
      count: wipItems.length,
      byStatus: wipByStatus,
      oldestDays: wipAges.length ? Math.max(...wipAges) : 0,
      avgAgeDays: wipAges.length ? Math.round(wipAges.reduce((a, b) => a + b, 0) / wipAges.length) : 0,
      items: [...wipItems].sort((a, b) => b.ageDays - a.ageDays).slice(0, 20),
    };

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
        selfDirectedSwitches,
        interruptionSwitches,
        totalFocusHours,
        avgFocusHoursPerWeek,
        workdays,
        meetingFreeDays,
        heavyMeetingDays,
        longestFocusBlock: longestFocusBlock && longestFocusBlock.minutes > 0
          ? {
            date: longestFocusBlock.date,
            hours: Math.round((longestFocusBlock.minutes / 60) * 10) / 10,
            fromMin: longestFocusBlock.fromMin,
            toMin: longestFocusBlock.toMin,
          }
          : null,
        avgCycleDays,
        medianCycleDays,
        cycleSampleSize: cycleSamples.length,
        activeDays,
        longestStreak,
        currentStreak,
      },
      wip,
      weeklySwitchSplit,
      weeklyMeetingCounts,
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

// Whole-day difference between two YYYY-MM-DD strings (b - a), noon-anchored to
// dodge DST edges.
function isoDayDiff(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

// Median of a numeric array (unsorted input is fine).
function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function getWeekStart(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

module.exports = router;
