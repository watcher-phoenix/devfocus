// Outlook "Focus time" blocks are protected focus work, not meetings. The ICS
// feed has no dedicated busy-status for them (they come through as Busy), so we
// detect them by title. Excluded from every meeting count; the time they cover
// falls back into the day's focus minutes automatically.
// Matches the phrase "focus time" anywhere, or a title that is exactly "focus"
// (case-insensitive). Exact equality on "focus" keeps real meetings like
// "Focus group" from being caught.
function isFocusTime(title) {
  const lower = (title || '').trim().toLowerCase();
  return lower.includes('focus time') || lower === 'focus';
}

// Build a predicate that returns true when an event should NOT count as a
// meeting: either it's a Focus time block (title contains the phrase "focus
// time" — so a real meeting like "Focus group" is NOT caught), or its title
// exactly matches one of the user's exclude keywords (comma-separated,
// case-insensitive). Exact match is deliberate: excluding "lunch" drops events
// titled exactly "Lunch", never a legit meeting that merely mentions the word.
function makeIsExcludedMeeting(keywordsCsv) {
  const keywords = (keywordsCsv || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  return (title) => {
    if (isFocusTime(title)) return true;
    const lower = (title || '').trim().toLowerCase();
    return keywords.some((kw) => lower === kw);
  };
}

module.exports = { isFocusTime, makeIsExcludedMeeting };
