const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DailyNote = sequelize.define(
    'DailyNote',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    { tableName: 'daily_notes', timestamps: true }
  );

  return DailyNote;
};
