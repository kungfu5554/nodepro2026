-- ============================================================================
-- Personnel Evaluation System Database Schema
-- Standard: Vocational Skills Competition (ปวช.) 2568-2572
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS my_app_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE my_app_db;

-- 1. Users table (Admin, HR, Teacher/Evaluatee, Judge)
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

-- 2. Evaluation periods table (Start, end, open/close status)
CREATE TABLE IF NOT EXISTS evaluation_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_open TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Evaluation metrics table
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

-- 4. Judge-Evaluatee assignments table
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

-- 5. Candidate self-evaluation records
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

-- 6. Judge score records per metric
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

-- 7. Overall evaluation summary and digital signature
CREATE TABLE IF NOT EXISTS evaluation_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL UNIQUE,
  total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  overall_feedback TEXT DEFAULT NULL,
  judge_signature VARCHAR(255) DEFAULT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Initial Seed Data
-- ============================================================================

-- Seed initial evaluation period
INSERT IGNORE INTO evaluation_periods (id, name, start_date, end_date, is_open)
VALUES (1, 'รอบประเมินประจำปี 2568', '2026-10-01', '2026-11-30', 1);

-- Seed initial metrics
INSERT IGNORE INTO metrics (id, period_id, title, description, weight, eval_type, evidence_type)
VALUES
  (1, 1, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
  (2, 1, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
  (3, 1, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE');

-- Seed default test accounts (Passwords hashed with bcrypt 10 rounds)
-- admin: admin1234, hr: hr1234, teacher: pass1234, judge: judge1234
INSERT IGNORE INTO users (citizen_id, password, prefix, name, role, role_title, department, position)
VALUES
  ('1100000000000', '$2b$10$c815Ztzqy/8u9YgP6F6DvuMt1iztHQykIxuqLQbIbnw5shhanCH..', 'นาย', 'นายพัฒนพงษ์ เทคโนแอดมิน', 'admin', 'ผู้ดูแลระบบ (Admin)', 'ศูนย์เทคโนโลยีสารสนเทศ', 'ผู้ดูแลระบบ'),
  ('1100100000001', '$2b$10$WmKTBymFYoFBP8AnYdGbvuE7UN2CYcu.P./bC6ZhimwFqxqxPStIu', 'นางสาว', 'นางสาวดวงใจ รัตนพร', 'hr', 'ฝ่ายบุคลากร (HR)', 'งานบุคลากร', 'เจ้าหน้าที่งานบุคลากร'),
  ('1100200000002', '$2b$10$srzUkRFMAOF07d..EiyKLeGgv1SzQYiqoUzhnKGUfDAvOy7xq.o6e', 'นาย', 'นายสมชาย ใจดี', 'teacher', 'ผู้รับการประเมิน', 'แผนกวิชาเทคโนโลยีสารสนเทศ', 'ครู คศ.1'),
  ('1100300000003', '$2b$10$jemNnhZdlIxhounDk5pddeNMllnIpVhrLUJqSag5CEug01Z8T9BFi', 'ดร.', 'ดร.สมศักดิ์ ทรงธรรม', 'judge', 'กรรมการผู้ประเมิน', 'คณะกรรมการประเมินภายนอก', 'ประธานกรรมการประเมิน');

-- Seed initial assignment
INSERT IGNORE INTO assignments (id, period_id, teacher_citizen_id, judge_citizen_id, role_in_board, status)
VALUES (1, 1, '1100200000002', '1100300000003', 'ประธานกรรมการ', 'PENDING');
