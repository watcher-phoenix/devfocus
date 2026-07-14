const TZ = 'America/New_York';

// Get current date string in Eastern time (YYYY-MM-DD)
function getTodayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// Get yesterday's date string in Eastern time
function getYesterdayET() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

// Get the Eastern-time date string (YYYY-MM-DD) for a given Date/timestamp
function getDateET(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: TZ });
}

// Get day of week name for a date string
function getDayOfWeek(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// Get Sunday of the week for a date string
function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

// Get a date N days ago in Eastern time
function getDaysAgoET(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

// Get hours and minutes in Eastern time for a Date object
function getTimeInET(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour').value);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value);
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

// Check if a Date falls on a weekend (Saturday or Sunday) in Eastern time
function isWeekendET(date) {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(date);
  return dayStr === 'Sat' || dayStr === 'Sun';
}

module.exports = { getTodayET, getYesterdayET, getDateET, getDayOfWeek, getWeekStart, getDaysAgoET, getTimeInET, isWeekendET, TZ };
