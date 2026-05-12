const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StatusConfig = sequelize.define(
    'StatusConfig',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      label: { type: DataTypes.STRING(50), allowNull: false },
      color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#9AA0A6' },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isCompletion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'status_configs', timestamps: true }
  );

  return StatusConfig;
};
