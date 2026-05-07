const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define(
    'Project',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      repoSlug: { type: DataTypes.STRING(200), allowNull: true },
      color: { type: DataTypes.STRING(7), allowNull: true, defaultValue: '#1976d2' },
      archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'projects', timestamps: true }
  );

  return Project;
};
