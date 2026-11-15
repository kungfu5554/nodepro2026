const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();
const { seedInitialData } = require('../database/seed');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'my_app_db',
  charset: 'utf8mb4'
};

const pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0, multipleStatements: true });

async function runSchemaAndMigrations() {
  const rawSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8')
    .replace(/^\s*CREATE DATABASE[\s\S]*?;\s*$/im, '')
    .replace(/^\s*USE\s+[^;]+;\s*$/im, '');
  await pool.query(rawSql);

  const migrations = [
    'ALTER TABLE users ADD COLUMN required_judges INT NOT NULL DEFAULT 3;',
    "ALTER TABLE assignments MODIFY COLUMN status ENUM('PENDING', 'CLAIMED', 'SUBMITTED', 'EVALUATED') NOT NULL DEFAULT 'CLAIMED';",
    'ALTER TABLE assignments ADD COLUMN claimed_at TIMESTAMP NULL DEFAULT NULL;',
    'ALTER TABLE assignments ADD INDEX idx_assign_period_teacher_status (period_id, teacher_citizen_id, status);',
    'ALTER TABLE metrics ADD COLUMN category_id INT DEFAULT NULL;',
    'ALTER TABLE metrics ADD CONSTRAINT fk_metrics_category FOREIGN KEY (category_id) REFERENCES metric_categories(id) ON DELETE SET NULL;',
    'ALTER TABLE evaluation_summaries MODIFY COLUMN judge_signature LONGTEXT DEFAULT NULL;'
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch {}
  }
}

async function initializeDatabase(maxRetries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let adminConn;
    try {
      adminConn = await mysql.createConnection({ host: dbConfig.host, port: dbConfig.port, user: dbConfig.user, password: dbConfig.password, charset: 'utf8mb4' });
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await adminConn.end();
      await runSchemaAndMigrations();
      await seedInitialData(pool);
      return true;
    } catch (error) {
      if (adminConn) await adminConn.end().catch(() => {});
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

module.exports = { pool, initializeDatabase };
