const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WeekPlan = sequelize.define(
    'WeekPlan',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      weekStart: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      dayTypes: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: JSON.stringify({
          mon: 'meetings',
          tue: 'meetings',
          wed: 'meetings',
          thu: 'focus',
          fri: 'focus',
        }),
        get() {
          const raw = this.getDataValue('dayTypes');
          return raw ? JSON.parse(raw) : {};
        },
        set(val) {
          this.setDataValue('dayTypes', JSON.stringify(val));
        },
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: 'week_plans', timestamps: true }
  );

  return WeekPlan;
};
