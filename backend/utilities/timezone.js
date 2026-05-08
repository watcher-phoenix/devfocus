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

// Get day of week name for a date string
function getDayOfWeek(dateStr) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// Get Monday of the week for a date string
function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

// Get a date N days ago in Eastern time
function getDaysAgoET(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

module.exports = { getTodayET, getYesterdayET, getDayOfWeek, getWeekStart, getDaysAgoET, TZ };
