const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DailyTally = sequelize.define(
    'DailyTally',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      // JSON map of category key -> count, e.g. {"interrupted":3,"admin":2}.
      // Derived from `entries` (count = number of entries) and kept in sync so
      // Trends can sum totals without parsing the entry log. Categories are
      // defined client-side so the set can change without a migration.
      counts: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
      // JSON map of category key -> array of per-tap entries, each
      // { id, ts, note } — one entry per increment, with its own optional note
      // and timestamp, e.g. {"firefighting":[{"id":"..","ts":"..","note":"prod 500s"}]}.
      entries: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
      // Legacy free-text day note (pre-per-entry notes). Retained for back-compat;
      // no longer written by the UI.
      note: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    { tableName: 'daily_tallies', timestamps: true }
  );

  return DailyTally;
};
