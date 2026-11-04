// config/database.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Create connection pool with fallback defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'my_app_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database schema and default seeds with connection retry
async function initializeDatabase(maxRetries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let adminConn;
    try {
      console.log(`[DB] Attempting database connection (Attempt ${attempt}/${maxRetries})...`);

      // 1. Ensure target database exists
      adminConn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '12345',
        charset: 'utf8mb4'
      });

      const dbName = process.env.DB_NAME || 'my_app_db';
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await adminConn.end();

      // 2. Create tables with updated schema
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          citizen_id VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          prefix VARCHAR(20) DEFAULT 'นาย',
          name VARCHAR(100) NOT NULL,
          role ENUM('admin', 'hr', 'teacher', 'judge') NOT NULL,
          role_title VARCHAR(100) NOT NULL,
          department VARCHAR(150) DEFAULT NULL,
          position VARCHAR(100) DEFAULT NULL,
          email VARCHAR(120) DEFAULT NULL,
          phone VARCHAR(50) DEFAULT NULL,
          employee_id VARCHAR(50) DEFAULT NULL,
          signature_url LONGTEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_role (role)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Ensure columns exist and have compatible types
      try { await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(120) DEFAULT NULL;'); } catch (e) {}
      try { await pool.query('ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT NULL;'); } catch (e) {}
      try { await pool.query('ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) DEFAULT NULL;'); } catch (e) {}
      try { await pool.query('ALTER TABLE users MODIFY signature_url LONGTEXT DEFAULT NULL;'); } catch (e) {}
      try { await pool.query('ALTER TABLE users MODIFY citizen_id VARCHAR(50) NOT NULL;'); } catch (e) {}

      await pool.query(`
        CREATE TABLE IF NOT EXISTS evaluation_periods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_open TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS metrics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          period_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT DEFAULT NULL,
          weight INT NOT NULL DEFAULT 25,
          eval_type ENUM('SCALE', 'BOOLEAN') NOT NULL DEFAULT 'SCALE',
          evidence_type ENUM('PDF', 'IMAGE', 'URL') NOT NULL DEFAULT 'PDF',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          period_id INT NOT NULL,
          teacher_citizen_id VARCHAR(50) NOT NULL,
          judge_citizen_id VARCHAR(50) NOT NULL,
          role_in_board VARCHAR(50) NOT NULL DEFAULT 'ประธานกรรมการ',
          status ENUM('PENDING', 'SUBMITTED', 'EVALUATED') NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
          FOREIGN KEY (teacher_citizen_id) REFERENCES users(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (judge_citizen_id) REFERENCES users(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
          UNIQUE KEY uq_assignment (period_id, teacher_citizen_id, judge_citizen_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Ensure assignments columns & FKs are updated
      try {
        await pool.query('ALTER TABLE assignments MODIFY teacher_citizen_id VARCHAR(50) NOT NULL;');
        await pool.query('ALTER TABLE assignments MODIFY judge_citizen_id VARCHAR(50) NOT NULL;');
      } catch (e) {}

      await pool.query(`
        CREATE TABLE IF NOT EXISTS self_evaluations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          period_id INT NOT NULL,
          teacher_citizen_id VARCHAR(50) NOT NULL,
          metric_id INT NOT NULL,
          self_score VARCHAR(20) NOT NULL,
          evidence_url TEXT DEFAULT NULL,
          evidence_original_name VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
          FOREIGN KEY (teacher_citizen_id) REFERENCES users(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
          UNIQUE KEY uq_teacher_metric (period_id, teacher_citizen_id, metric_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await pool.query('ALTER TABLE self_evaluations MODIFY teacher_citizen_id VARCHAR(50) NOT NULL;');
      } catch (e) {}

      await pool.query(`
        CREATE TABLE IF NOT EXISTS judge_evaluations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          assignment_id INT NOT NULL,
          metric_id INT NOT NULL,
          judge_score DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
          FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE,
          UNIQUE KEY uq_assign_metric (assignment_id, metric_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await pool.query('ALTER TABLE judge_evaluations MODIFY judge_score DECIMAL(5,2) NOT NULL;');
      } catch (e) {}

      await pool.query(`
        CREATE TABLE IF NOT EXISTS evaluation_summaries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          assignment_id INT NOT NULL UNIQUE,
          total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          overall_feedback TEXT DEFAULT NULL,
          judge_signature VARCHAR(255) DEFAULT NULL,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Seed initial evaluation period
      await pool.query(`
        INSERT INTO evaluation_periods (id, name, start_date, end_date, is_open)
        VALUES (1, 'รอบประเมินประจำปี 2568', '2026-10-01', '2026-11-30', 1)
        ON DUPLICATE KEY UPDATE name = VALUES(name);
      `);

      // 4. Seed initial metrics
      await pool.query(`
        INSERT INTO metrics (id, period_id, title, description, weight, eval_type, evidence_type)
        VALUES
          (1, 1, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
          (2, 1, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
          (3, 1, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE')
        ON DUPLICATE KEY UPDATE 
          title = VALUES(title),
          description = VALUES(description);
      `);

      // 5. Seed default test accounts
      const defaultUsers = [
        {
          citizen_id: '1100000000000',
          password: 'admin1234',
          prefix: 'นาย',
          name: 'นายพัฒนพงษ์ เทคโนแอดมิน',
          role: 'admin',
          role_title: 'ผู้ดูแลระบบ (Admin)',
          department: 'ศูนย์เทคโนโลยีสารสนเทศ',
          position: 'ผู้ดูแลระบบ'
        },
        {
          citizen_id: '1100100000001',
          password: 'hr1234',
          prefix: 'นางสาว',
          name: 'นางสาวดวงใจ รัตนพร',
          role: 'hr',
          role_title: 'ฝ่ายบุคลากร (HR)',
          department: 'งานบุคลากร',
          position: 'เจ้าหน้าที่งานบุคลากร'
        },
        {
          citizen_id: '1100200000002',
          password: 'pass1234',
          prefix: 'นาย',
          name: 'นายสมชาย ใจดี',
          role: 'teacher',
          role_title: 'ผู้รับการประเมิน',
          department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
          position: 'ครู คศ.1'
        },
        {
          citizen_id: '1100300000003',
          password: 'judge1234',
          prefix: 'ดร.',
          name: 'ดร.สมศักดิ์ ทรงธรรม',
          role: 'judge',
          role_title: 'กรรมการผู้ประเมิน',
          department: 'คณะกรรมการประเมินภายนอก',
          position: 'ประธานกรรมการประเมิน'
        }
      ];

      for (const u of defaultUsers) {
        const [existing] = await pool.query('SELECT id, password FROM users WHERE citizen_id = ?', [u.citizen_id]);
        if (existing.length === 0) {
          const hashedPassword = await bcrypt.hash(u.password, 10);
          await pool.query(`
            INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [u.citizen_id, hashedPassword, u.prefix, u.name, u.role, u.role_title, u.department, u.position]);
        } else {
          // If password doesn't match default password, update it so default seed accounts always work
          const isMatch = await bcrypt.compare(u.password, existing[0].password).catch(() => false);
          const hashedPassword = isMatch ? existing[0].password : await bcrypt.hash(u.password, 10);
          await pool.query(`
            UPDATE users 
            SET password = ?, prefix = ?, name = ?, role = ?, role_title = ?, department = ?, position = ?
            WHERE citizen_id = ?
          `, [hashedPassword, u.prefix, u.name, u.role, u.role_title, u.department, u.position, u.citizen_id]);
        }
      }

      // 6. Seed initial assignment
      await pool.query(`
        INSERT INTO assignments (id, period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status)
        VALUES (1, 1, '1100200000002', '1100300000003', 'ประธานกรรมการ', 'PENDING')
        ON DUPLICATE KEY UPDATE role_in_board = VALUES(role_in_board);
      `);

      console.log('[DB] Database tables and initial seed initialized successfully.');
      return true; // Successfully initialized
    } catch (error) {
      console.warn(`[DB] Connection attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`[DB] Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error('[DB] All database connection attempts exhausted.');
      }
    }
  }
  return false;
}

module.exports = {
  pool,
  initializeDatabase
};
