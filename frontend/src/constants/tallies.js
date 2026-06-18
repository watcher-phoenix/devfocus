// Tap-to-increment categories for non-taskable work — the stuff that eats your
// day but never becomes a discrete task. Keys are stored in daily_tallies.counts.
export const TALLY_CATEGORIES = [
  { key: 'interrupted', label: 'Interrupted', emoji: '✋' },
  { key: 'helped', label: 'Helped someone', emoji: '🤝' },
  { key: 'firefighting', label: 'Firefighting', emoji: '🔥' },
  { key: 'admin', label: 'Admin', emoji: '🗂️' },
  { key: 'reading', label: 'Reading / learning', emoji: '📖' },
  { key: 'adhoc_meeting', label: 'Ad-hoc meeting', emoji: '📞' },
  { key: 'context_switch', label: 'Context switch', emoji: '🔀' },
  { key: 'blocked', label: 'Blocked / waiting', emoji: '⏳' },
  { key: 'planning', label: 'Planning', emoji: '🗓️' },
  { key: 'docs', label: 'Documentation', emoji: '📝' },
];

export const TALLY_LABELS = Object.fromEntries(TALLY_CATEGORIES.map((c) => [c.key, c.label]));
