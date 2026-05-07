/* eslint-disable no-console */
const ical = require('node-ical');
const { CachedEvent, IntegrationConfig } = require('../database/models');
const { Op } = require('sequelize');

// Sync calendar events from an ICS URL (Outlook published calendar)
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
    const events = await ical.async.fromURL(icsUrl);
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    let created = 0;
    let updated = 0;
    const processedIds = [];

    for (const [uid, event] of Object.entries(events)) {
      if (event.type !== 'VEVENT') continue;

      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Skip events outside our date range
      if (eventEnd < start || eventStart > end) continue;

      // Handle recurring events — node-ical expands them
      const externalId = event.recurrenceid
        ? `${uid}_${eventStart.toISOString()}`
        : uid;

      const date = eventStart.toISOString().split('T')[0];
      const allDay = event.datetype === 'date';

      processedIds.push(externalId);

      const [, wasCreated] = await CachedEvent.upsert({
        externalId,
        title: event.summary || '(No title)',
        startTime: eventStart,
        endTime: eventEnd,
        allDay,
        location: event.location || null,
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
