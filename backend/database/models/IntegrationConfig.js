const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const IntegrationConfig = sequelize.define(
    'IntegrationConfig',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      provider: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      config: { type: DataTypes.TEXT, allowNull: true },
      lastSyncAt: { type: DataTypes.DATE, allowNull: true },
      lastSyncStatus: { type: DataTypes.STRING(20), allowNull: true },
      syncIntervalMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      tokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
      tokenLabel: { type: DataTypes.STRING(100), allowNull: true },
    },
    { tableName: 'integration_configs', timestamps: true }
  );

  return IntegrationConfig;
};
