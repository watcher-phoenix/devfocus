const sequelize = require('../connection');

const Project = require('./Project')(sequelize);
const WorkItem = require('./WorkItem')(sequelize);
const ContextSnapshot = require('./ContextSnapshot')(sequelize);
const WeekPlan = require('./WeekPlan')(sequelize);
const IntegrationConfig = require('./IntegrationConfig')(sequelize);
const CachedEvent = require('./CachedEvent')(sequelize);
const UserSettings = require('./UserSettings')(sequelize);
const DailyNote = require('./DailyNote')(sequelize);

// Associations
Project.hasMany(WorkItem, { foreignKey: 'projectId', as: 'workItems' });
WorkItem.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Project.hasMany(ContextSnapshot, { foreignKey: 'projectId', as: 'snapshots' });
ContextSnapshot.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

module.exports = {
  sequelize,
  Project,
  WorkItem,
  ContextSnapshot,
  WeekPlan,
  IntegrationConfig,
  CachedEvent,
  UserSettings,
  DailyNote,
};
