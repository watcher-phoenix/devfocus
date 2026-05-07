const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContextSnapshot = sequelize.define(
    'ContextSnapshot',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      projectId: { type: DataTypes.INTEGER, allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: false },
      nextSteps: { type: DataTypes.TEXT, allowNull: true },
      branch: { type: DataTypes.STRING(200), allowNull: true },
      files: { type: DataTypes.TEXT, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lastTouchedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: 'context_snapshots', timestamps: true }
  );

  return ContextSnapshot;
};
