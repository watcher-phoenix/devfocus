const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkItem = sequelize.define(
    'WorkItem',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'inbox',
      },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'task',
        validate: { isIn: [['task', 'ticket', 'strategic', 'followup', 'review', 'pr-review', 'jira', 'pr', 'support', 'urgent']] },
      },
      projectId: { type: DataTypes.INTEGER, allowNull: true },
      externalId: { type: DataTypes.STRING(100), allowNull: true },
      externalUrl: { type: DataTypes.STRING(1000), allowNull: true },
      externalSource: { type: DataTypes.STRING(20), allowNull: true },
      scheduledDate: { type: DataTypes.DATEONLY, allowNull: true },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { tableName: 'work_items', timestamps: true }
  );

  return WorkItem;
};
