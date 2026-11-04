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
          dept_status ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
          requested_department VARCHAR(150) DEFAULT NULL,
          dept_reject_reason TEXT DEFAULT NULL,
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
      try { await pool.query("ALTER TABLE users ADD COLUMN dept_status ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'APPROVED';"); } catch (e) {}
      try { await pool.query('ALTER TABLE users ADD COLUMN requested_department VARCHAR(150) DEFAULT NULL;'); } catch (e) {}
      try { await pool.query('ALTER TABLE users ADD COLUMN dept_reject_reason TEXT DEFAULT NULL;'); } catch (e) {}
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
          teacher_comment TEXT DEFAULT NULL,
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
      try {
        await pool.query('ALTER TABLE self_evaluations ADD COLUMN teacher_comment TEXT DEFAULT NULL;');
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

      // 2.1 Departments table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL UNIQUE,
          code VARCHAR(50) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2.2 Department judges table (Judges assigned to departments)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS department_judges (
          id INT AUTO_INCREMENT PRIMARY KEY,
          department_name VARCHAR(150) NOT NULL,
          judge_citizen_id VARCHAR(50) NOT NULL,
          period_id INT NOT NULL DEFAULT 1,
          role_in_board VARCHAR(50) NOT NULL DEFAULT 'กรรมการ',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_dept_judge (department_name, judge_citizen_id, period_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2.3 Teacher submissions tracking table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS teacher_submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          period_id INT NOT NULL,
          teacher_citizen_id VARCHAR(50) NOT NULL,
          status ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'SUBMITTED',
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_teacher_submission (period_id, teacher_citizen_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Seed initial evaluation periods (preserve live Admin changes)
      await pool.query(`
        INSERT IGNORE INTO evaluation_periods (id, name, start_date, end_date, is_open)
        VALUES 
          (1, 'รอบการประเมินที่ 1 ประจำปีการศึกษา 2568', '2026-10-01', '2026-11-30', 1),
          (2, 'รอบการประเมินที่ 2 ประจำปีการศึกษา 2567', '2026-04-01', '2026-05-31', 0);
      `);

      // 4. Seed initial metrics for Period 1 and Period 2
      await pool.query(`
        INSERT IGNORE INTO metrics (id, period_id, title, description, weight, eval_type, evidence_type)
        VALUES
          (1, 1, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
          (2, 1, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
          (3, 1, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE'),
          (4, 2, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
          (5, 2, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
          (6, 2, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE');
      `);

      // 5. Seed default test accounts (do not overwrite live profile edits)
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
        },
        {
          citizen_id: '1100400000004',
          password: 'pass1234',
          prefix: 'นางสาว',
          name: 'นางสาวกานดา วงศ์สุวรรณ',
          role: 'teacher',
          role_title: 'ผู้รับการประเมิน',
          department: 'แผนกวิชาคอมพิวเตอร์ธุรกิจ',
          position: 'ครูผู้ช่วย'
        },
        {
          citizen_id: '1100500000005',
          password: 'judge1234',
          prefix: 'ผศ.ดร.',
          name: 'ผศ.ดร.วิชัย พิริยะกุล',
          role: 'judge',
          role_title: 'กรรมการผู้ประเมิน',
          department: 'แผนกวิชาเทคโนโลยีสารสนเทศ',
          position: 'กรรมการผู้ทรงคุณวุฒิ'
        }
      ];

      for (const u of defaultUsers) {
        const [existing] = await pool.query('SELECT id, password FROM users WHERE citizen_id = ?', [u.citizen_id]);
        if (existing.length === 0) {
          const hashedPassword = await bcrypt.hash(u.password, 10);
          await pool.query(`
            INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, dept_status, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
          `, [u.citizen_id, hashedPassword, u.prefix, u.name, u.role, u.role_title, u.department, u.position]);
        } else if (!existing[0].password || !existing[0].password.startsWith('$2')) {
          const hashedPassword = await bcrypt.hash(u.password, 10);
          await pool.query('UPDATE users SET password = ? WHERE citizen_id = ?', [hashedPassword, u.citizen_id]);
        }
      }

      // 6. Seed initial departments
      await pool.query(`
        INSERT IGNORE INTO departments (name, code)
        VALUES 
          ('แผนกวิชาเทคโนโลยีสารสนเทศ', 'IT'),
          ('แผนกวิชาคอมพิวเตอร์ธุรกิจ', 'BC'),
          ('แผนกวิชาการบัญชี', 'ACC'),
          ('แผนกวิชาช่างยนต์', 'AUTO'),
          ('แผนกวิชาการจัดการโลจิสติกส์', 'LOG');
      `);

      // 7. Seed department judges (Judges assigned by department for Period 1 & 2)
      await pool.query(`
        INSERT IGNORE INTO department_judges (department_name, judge_citizen_id, period_id, role_in_board)
        VALUES 
          ('แผนกวิชาเทคโนโลยีสารสนเทศ', '1100300000003', 1, 'ประธานกรรมการ'),
          ('แผนกวิชาเทคโนโลยีสารสนเทศ', '1100500000005', 1, 'กรรมการผู้ทรงคุณวุฒิ'),
          ('แผนกวิชาคอมพิวเตอร์ธุรกิจ', '1100300000003', 1, 'ประธานกรรมการ'),
          ('แผนกวิชาเทคโนโลยีสารสนเทศ', '1100300000003', 2, 'ประธานกรรมการ'),
          ('แผนกวิชาเทคโนโลยีสารสนเทศ', '1100500000005', 2, 'กรรมการผู้ทรงคุณวุฒิ'),
          ('แผนกวิชาคอมพิวเตอร์ธุรกิจ', '1100300000003', 2, 'ประธานกรรมการ');
      `);

      // 8. Seed candidate 2 self-evaluations so candidate 2 is ready for grading
      await pool.query(`
        INSERT IGNORE INTO self_evaluations (period_id, teacher_citizen_id, metric_id, self_score, teacher_comment, evidence_url)
        VALUES
          (1, '1100400000004', 1, '4', 'จัดทำแผนการจัดการเรียนรู้ฐานสมรรถนะและสื่อการสอนออนไลน์ครบถ้วนทุกรายวิชา', NULL),
          (1, '1100400000004', 2, '3', 'เข้าร่วมอบรมเชิงปฏิบัติการพัฒนาทักษะดิจิทัลสำหรับการจัดการเรียนการสอน 24 ชั่วโมง', NULL),
          (1, '1100400000004', 3, 'มี', 'ปฏิบัติหน้าที่ครูที่ปรึกษาและร่วมกิจกรรมพัฒนาผู้เรียนของสถานศึกษาอย่างสม่ำเสมอ', NULL);
      `);

      // Clean up any legacy placeholder example.com URLs
      await pool.query("UPDATE self_evaluations SET evidence_url = NULL WHERE evidence_url LIKE '%example.com%';");

      // 9. Seed teacher submission for candidate 2 (without overwriting live submissions)
      await pool.query(`
        INSERT IGNORE INTO teacher_submissions (period_id, teacher_citizen_id, status)
        VALUES (1, '1100400000004', 'SUBMITTED');
      `);

      // Remove any orphan teacher_submissions whose user no longer exists
      await pool.query(`
        DELETE ts FROM teacher_submissions ts
        LEFT JOIN users u ON u.citizen_id = ts.teacher_citizen_id
        WHERE u.id IS NULL;
      `);

      // Migrate any legacy teacher records with unapproved free-text departments to PENDING HR approval
      await pool.query(`
        UPDATE users u
        LEFT JOIN departments d ON d.name = u.department
        SET u.requested_department = u.department,
            u.department = NULL,
            u.dept_status = 'PENDING'
        WHERE u.role = 'teacher'
          AND u.dept_status = 'APPROVED'
          AND u.department IS NOT NULL
          AND u.department != ''
          AND d.id IS NULL;
      `);

      // Ensure teachers with unapproved (PENDING/REJECTED) departments do not hold premature SUBMITTED state
      await pool.query(`
        DELETE ts FROM teacher_submissions ts
        INNER JOIN users u ON u.citizen_id = ts.teacher_citizen_id
        WHERE u.role = 'teacher' AND u.dept_status != 'APPROVED';
      `);

      // Remove any inconsistent SUBMITTED flag where candidate actually has 0 self-evaluation rows
      await pool.query(`
        DELETE ts FROM teacher_submissions ts
        LEFT JOIN self_evaluations se
          ON se.period_id = ts.period_id AND se.teacher_citizen_id = ts.teacher_citizen_id
        WHERE se.id IS NULL;
      `);

      // 10. Seed initial assignment for candidate 2 (without overwriting live statuses)
      await pool.query(`
        INSERT IGNORE INTO assignments (id, period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status)
        VALUES (2, 1, '1100400000004', '1100300000003', 'ประธานกรรมการ', 'SUBMITTED');
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
