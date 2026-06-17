// Combine all-day OOO days with timed OOO hours, rolling timed hours over an
// 8-hour work day into whole days and showing the remainder as hours.
// e.g. 3 all-day blocks + 11 timed hours -> { days: 4, hours: 3 }.
const WORK_DAY_HOURS = 8;

export function rollupOOO(oooDays = 0, oooHours = 0) {
  const days = oooDays || 0;
  const hours = oooHours || 0;
  const extraDays = Math.floor(hours / WORK_DAY_HOURS);
  return {
    days: days + extraDays,
    hours: Math.round((hours - extraDays * WORK_DAY_HOURS) * 10) / 10,
  };
}
