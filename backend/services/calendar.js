/* eslint-disable no-console */
const ical = require('node-ical');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');

// Expand recurring events into individual instances within a date range
function expandRecurring(events, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  const expanded = [];

  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== 'VEVENT') continue;

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

    // Clean up stale events in the synced range
    if (processedIds.length > 0) {
      await CachedEvent.destroy({
        where: {
          date: { [Op.between]: [startDate, endDate] },
          externalId: { [Op.notIn]: processedIds },
        },
      });
    }

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    });

    return { success: true, created, updated, total: processedIds.length };
  } catch (err) {
    console.error('Calendar sync error:', err.message);
    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
    });
    return { success: false, error: err.message };
  }
}

// Sync current week + next week
async function syncCurrentWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const nextFriday = new Date(monday);
  nextFriday.setDate(monday.getDate() + 11);

  const startDate = monday.toISOString().split('T')[0];
  const endDate = nextFriday.toISOString().split('T')[0];

  return syncCalendar(startDate, endDate);
}

module.exports = { syncCalendar, syncCurrentWeek };
