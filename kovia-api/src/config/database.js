/* ========================================
   KOVIA API — Database Configuration
   Sequelize + MySQL connection
   ======================================== */
'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DIALECT = process.env.DB_DIALECT || 'postgres';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || (DIALECT === 'postgres' ? 5432 : 3306);

const sequelize = new Sequelize(
  process.env.DB_NAME || 'kovia_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: DB_PORT,
    dialect: DIALECT,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
    }
  }
);

module.exports = sequelize;
