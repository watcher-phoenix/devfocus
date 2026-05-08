/* eslint-disable no-console */
const ical = require('node-ical');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');

// Check if the user declined or hasn't accepted this event
// Outlook ICS uses X-MICROSOFT-CDO-BUSYSTATUS:
//   BUSY = accepted, TENTATIVE = not accepted, FREE = declined, OOF = out of office
function isDeclinedOrTentative(event) {
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

// Expand recurring events into individual instances within a date range
function expandRecurring(events, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  const expanded = [];

  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;

    // Skip events the user declined or hasn't accepted
    if (isDeclinedOrTentative(event)) continue;

    // If it has a recurrence rule, expand it
    if (event.rrule) {
      try {
        const instances = event.rrule.between(start, end, true);
        const duration = new Date(event.end) - new Date(event.start);

        for (const instanceStart of instances) {
          const instanceEnd = new Date(instanceStart.getTime() + duration);
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
    const rawEvents = await ical.async.fromURL(icsUrl);
    const events = expandRecurring(rawEvents, startDate, endDate);

    let created = 0;
    let updated = 0;
    const processedIds = [];

    for (const event of events) {
      const date = event.start.toISOString().split('T')[0];
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
