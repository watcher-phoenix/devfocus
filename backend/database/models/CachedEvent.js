const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CachedEvent = sequelize.define(
    'CachedEvent',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      externalId: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      startTime: { type: DataTypes.DATE, allowNull: false },
      endTime: { type: DataTypes.DATE, allowNull: false },
      allDay: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isOOO: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      location: { type: DataTypes.STRING(500), allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false },
    },
    { tableName: 'cached_events', timestamps: true }
  );

  return CachedEvent;
};
