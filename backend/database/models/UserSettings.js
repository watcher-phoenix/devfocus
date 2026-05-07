const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserSettings = sequelize.define(
    'UserSettings',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      workStartTime: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '07:30' },
      workEndTime: { type: DataTypes.STRING(5), allowNull: false, defaultValue: '16:00' },
      anthropicApiKey: { type: DataTypes.STRING(200), allowNull: true },
      meetingExcludeKeywords: {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: 'lunch',
      },
      dismissedHints: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]',
        get() {
          const raw = this.getDataValue('dismissedHints');
          return raw ? JSON.parse(raw) : [];
        },
        set(val) {
          this.setDataValue('dismissedHints', JSON.stringify(val));
        },
      },
    },
    { tableName: 'user_settings', timestamps: true }
  );

  return UserSettings;
};
