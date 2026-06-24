/* eslint-disable no-console */
const ical = require('node-ical');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');
const { TZ } = require('../utilities/timezone');
const { fetchCalendarView } = require('./msGraph');

// Convert a Date to YYYY-MM-DD in the app's timezone (America/New_York)
function toDateInTZ(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

// YYYY-MM-DD from a Date's local components. All-day (VALUE=DATE) events are
// parsed by node-ical at the *server's* local midnight, so reading them back
// in local time recovers the intended calendar date on any server timezone.
// (toDateInTZ would shift them to the previous day on a UTC server.)
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Push an event into the expanded list, computing its `date`. All-day events
// that span multiple calendar days (e.g. a 3-day OOO block, where DTEND is
// exclusive) are split into one instance per day so each day is counted.
function pushExpanded(expanded, base) {
  if (!base.allDay) {
    expanded.push({ ...base, date: toDateInTZ(base.start) });
    return;
  }

  const startStr = toLocalDateStr(base.start);
  const endStr = toLocalDateStr(base.end);

  // Single-day or malformed (end <= start) all-day event: emit just the start day.
  if (endStr <= startStr) {
    expanded.push({ ...base, date: startStr });
    return;
  }

  // Walk each calendar day in [start, end) and emit a per-day instance.
  const cursor = new Date(base.start.getFullYear(), base.start.getMonth(), base.start.getDate());
  const endDate = new Date(base.end.getFullYear(), base.end.getMonth(), base.end.getDate());
  while (cursor < endDate) {
    const dateStr = toLocalDateStr(cursor);
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setDate(dayEnd.getDate() + 1);
    expanded.push({
      ...base,
      uid: `${base.uid}_${dateStr}`,
      start: dayStart,
      end: dayEnd,
      date: dateStr,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
}

// Check if the user declined or hasn't accepted this event
// Outlook ICS uses X-MICROSOFT-CDO-BUSYSTATUS:
//   BUSY = accepted, TENTATIVE = not accepted, FREE = declined, OOF = out of office
function shouldExclude(event) {
  // node-ical strips the X- prefix from Microsoft fields
  const busyStatus = (event['MICROSOFT-CDO-BUSYSTATUS'] || event['X-MICROSOFT-CDO-BUSYSTATUS'] || '').toUpperCase();
  if (busyStatus === 'TENTATIVE' || busyStatus === 'FREE') return true;

  // Fallback: check PARTSTAT on attendees
  const attendees = event.attendee;
  if (attendees) {
    const attendeeList = Array.isArray(attendees) ? attendees : [attendees];
    for (const attendee of attendeeList) {
      const partstat = (attendee?.params?.PARTSTAT || '').toUpperCase();
      if (partstat === 'DECLINED') return true;
    }
  }

  return false;
}

// Check if an event is marked Out of Office (Show as → Out of Office in Outlook)
function isOutOfOffice(event) {
  const busyStatus = (event['MICROSOFT-CDO-BUSYSTATUS'] || event['X-MICROSOFT-CDO-BUSYSTATUS'] || '').toUpperCase();
  return busyStatus === 'OOF';
}

// Expand recurring events into individual instances within a date range
function expandRecurring(events, startDate, endDate) {
  // Pad the rrule search range by 1 day on each side to handle timezone offsets
  // (rrule.between() can miss boundary instances when DTSTART timezone differs from server)
  const padStart = new Date(startDate + 'T00:00:00Z');
  padStart.setDate(padStart.getDate() - 1);
  const padEnd = new Date(endDate + 'T23:59:59Z');
  padEnd.setDate(padEnd.getDate() + 1);
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  const expanded = [];

  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;

    // Skip cancelled events (removed from calendar)
    if ((event.status || '').toUpperCase() === 'CANCELLED') continue;

    // Skip events the user declined or hasn't accepted
    if (shouldExclude(event)) continue;

    // If it has a recurrence rule, expand it
    if (event.rrule) {
      try {
        // Use padded range for rrule.between() to avoid timezone boundary misses
        const instances = event.rrule.between(padStart, padEnd, true);
        const duration = new Date(event.end) - new Date(event.start);

        // Build set of excluded dates (cancelled occurrences) using app timezone
        const exdates = new Set();
        if (event.exdate) {
          for (const ex of Object.values(event.exdate)) {
            const d = ex instanceof Date ? ex : new Date(ex);
            if (!isNaN(d)) exdates.add(toDateInTZ(d));
          }
        }

        const allDay = event.datetype === 'date';
        for (const instanceStart of instances) {
          // All-day instances are dated from local components (see toLocalDateStr);
          // timed instances use the app timezone.
          const instanceDate = allDay ? toLocalDateStr(instanceStart) : toDateInTZ(instanceStart);

          // Filter by date — rrule can generate wrong-day instances due to
          // UTC/local timezone mismatch
          if (instanceDate < startDate || instanceDate > endDate) continue;

          // Skip cancelled occurrences (compare in app timezone)
          if (exdates.has(instanceDate)) continue;

          const instanceEnd = new Date(instanceStart.getTime() + duration);
          pushExpanded(expanded, {
            uid: `${uid}_${instanceStart.toISOString()}`,
            title: event.summary || '(No title)',
            start: instanceStart,
            end: instanceEnd,
            allDay,
            isOOO: isOutOfOffice(event),
            location: event.location || null,
          });
        }
      } catch (err) {
        console.error(`[calendar] Failed to expand rrule for ${uid}:`, err.message);
      }
    } else {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Skip events outside our date range
      if (eventEnd < start || eventStart > end) continue;

      pushExpanded(expanded, {
        uid: event.recurrenceid ? `${uid}_${eventStart.toISOString()}` : uid,
        title: event.summary || '(No title)',
        start: eventStart,
        end: eventEnd,
        allDay: event.datetype === 'date',
        isOOO: isOutOfOffice(event),
        location: event.location || null,
      });
    }
  }

  return expanded;
}

// Sync calendar events from an ICS URL
async function syncCalendar(startDate, endDate) {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'calendar', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Calendar integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const useGraph = config.authMethod === 'graph' || Boolean(config.homeAccountId);

  if (!useGraph && !config.icsUrl) {
    return { success: false, error: 'No calendar source configured' };
  }

  // Graph calendarView expands recurrence server-side; the ICS path expands it
  // locally with expandRecurring(). Both return the same event shape.
  const fetchIcs = async () => {
    const raw = await ical.async.fromURL(config.icsUrl, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    return expandRecurring(raw, startDate, endDate);
  };

  try {
    let events;
    let source = useGraph ? 'graph' : 'ics';
    if (useGraph) {
      try {
        events = await fetchCalendarView(startDate, endDate);
      } catch (graphErr) {
        // Graph failed (e.g. refresh token revoked by Conditional Access). Fall
        // back to the stored ICS feed if one exists, so the calendar doesn't go
        // stale; otherwise surface the Graph error.
        if (!config.icsUrl) throw graphErr;
        console.warn('[calendar] Graph sync failed, falling back to ICS:', graphErr.message);
        events = await fetchIcs();
        source = 'ics-fallback';
      }
    } else {
      events = await fetchIcs();
    }

    let created = 0;
    let updated = 0;
    const processedIds = [];

    for (const event of events) {
      processedIds.push(event.uid);

      const [, wasCreated] = await CachedEvent.upsert({
        externalId: event.uid,
        title: event.title,
        startTime: event.start,
        endTime: event.end,
        allDay: event.allDay,
        isOOO: event.isOOO,
        location: event.location,
        date: event.date,
      });

      if (wasCreated) created++;
      else updated++;
    }

    // Clean up events in the synced range that aren't in the accepted list
    // This removes previously synced tentative/declined events
    const deleted = await CachedEvent.destroy({
      where: {
        date: { [Op.between]: [startDate, endDate] },
        ...(processedIds.length > 0
          ? { externalId: { [Op.notIn]: processedIds } }
          : {}),
      },
    });

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: source === 'ics-fallback' ? 'fallback' : 'success',
    });

    return { success: true, created, updated, deleted, total: processedIds.length, source };
  } catch (err) {
    console.error('Calendar sync error:', err.message);
    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
    });
    return { success: false, error: err.message };
  }
}

// Sync 4 weeks back + 4 weeks forward
async function syncCurrentWeek() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 28);
  const end = new Date(today);
  end.setDate(today.getDate() + 28);

  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  return syncCalendar(startDate, endDate);
}

module.exports = { syncCalendar, syncCurrentWeek };
