const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = process.env.DEVFOCUS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'devfocus.sqlite3');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

module.exports = sequelize;
