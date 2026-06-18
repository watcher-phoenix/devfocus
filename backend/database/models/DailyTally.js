const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DailyTally = sequelize.define(
    'DailyTally',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      // JSON map of category key -> count, e.g. {"interrupted":3,"admin":2}.
      // Categories are defined client-side so the set can change without a migration.
      counts: { type: DataTypes.TEXT, allowNull: false, defaultValue: '{}' },
      // Optional free-text note for the day's non-task activity (the qualitative "what").
      note: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    { tableName: 'daily_tallies', timestamps: true }
  );

  return DailyTally;
};
