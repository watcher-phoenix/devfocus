/* eslint-disable no-console */
const ical = require('node-ical');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');
const { TZ } = require('../utilities/timezone');

// Convert a Date to YYYY-MM-DD in the app's timezone (America/New_York)
function toDateInTZ(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

// Check if the event should be excluded from sync
// Outlook ICS uses X-MICROSOFT-CDO-BUSYSTATUS:
//   BUSY = accepted, TENTATIVE = not yet responded, FREE = declined, OOF = out of office
// For recurring events, Outlook marks instances as TENTATIVE even when the series was
// accepted, so we only filter tentative on non-recurring events (intentionally tentative).
function shouldExclude(event) {
  // node-ical strips the X- prefix from Microsoft fields
  const busyStatus = (event['MICROSOFT-CDO-BUSYSTATUS'] || event['X-MICROSOFT-CDO-BUSYSTATUS'] || '').toUpperCase();

  // Always exclude explicitly declined
  if (busyStatus === 'FREE') return true;

  // For non-recurring events, also exclude tentative (intentionally not accepted)
  if (busyStatus === 'TENTATIVE' && !event.rrule && !event.recurrenceid) return true;

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

        for (const instanceStart of instances) {
          const instanceEnd = new Date(instanceStart.getTime() + duration);

          // Filter to actual requested range after expansion
          if (instanceEnd < start || instanceStart > end) continue;

          // Skip cancelled occurrences (compare in app timezone)
          if (exdates.has(toDateInTZ(instanceStart))) continue;

          expanded.push({
            uid: `${uid}_${instanceStart.toISOString()}`,
            title: event.summary || '(No title)',
            start: instanceStart,
            end: instanceEnd,
            allDay: event.datetype === 'date',
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

      expanded.push({
        uid: event.recurrenceid ? `${uid}_${eventStart.toISOString()}` : uid,
        title: event.summary || '(No title)',
        start: eventStart,
        end: eventEnd,
        allDay: event.datetype === 'date',
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
  const { icsUrl } = config;

  if (!icsUrl) {
    return { success: false, error: 'No ICS URL configured' };
  }

  try {
    const rawEvents = await ical.async.fromURL(icsUrl, {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    const events = expandRecurring(rawEvents, startDate, endDate);

    let created = 0;
    let updated = 0;
    const processedIds = [];

    for (const event of events) {
      const date = toDateInTZ(event.start);
      processedIds.push(event.uid);

      const [, wasCreated] = await CachedEvent.upsert({
        externalId: event.uid,
        title: event.title,
        startTime: event.start,
        endTime: event.end,
        allDay: event.allDay,
        location: event.location,
        date,
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
      lastSyncStatus: 'success',
    });

    return { success: true, created, updated, deleted, total: processedIds.length };
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
