-- ============================================================================
-- Personnel Evaluation System Database Schema
-- Standard: Vocational Skills Competition (ปวช.) 2568-2572
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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
  dept_status ENUM('APPROVED', 'PENDING', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  requested_department VARCHAR(150) DEFAULT NULL,
  dept_reject_reason TEXT DEFAULT NULL,
  position VARCHAR(100) DEFAULT NULL,
  email VARCHAR(120) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  employee_id VARCHAR(50) DEFAULT NULL,
  required_judges INT NOT NULL DEFAULT 3,
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

-- 3. Evaluation metric categories table
CREATE TABLE IF NOT EXISTS metric_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Evaluation metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  category_id INT DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  weight INT NOT NULL DEFAULT 25,
  eval_type ENUM('SCALE', 'BOOLEAN') NOT NULL DEFAULT 'SCALE',
  evidence_type ENUM('PDF', 'IMAGE', 'URL') NOT NULL DEFAULT 'PDF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES metric_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Judge-Evaluatee assignments table (Claimed & evaluated records)
CREATE TABLE IF NOT EXISTS assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  teacher_citizen_id VARCHAR(50) NOT NULL,
  judge_citizen_id VARCHAR(50) NOT NULL,
  role_in_board VARCHAR(50) NOT NULL DEFAULT 'กรรมการผู้ประเมิน',
  status ENUM('PENDING', 'CLAIMED', 'SUBMITTED', 'EVALUATED') NOT NULL DEFAULT 'CLAIMED',
  claimed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_citizen_id) REFERENCES users(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (judge_citizen_id) REFERENCES users(citizen_id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_assignment (period_id, teacher_citizen_id, judge_citizen_id),
  INDEX idx_assign_period_teacher_status (period_id, teacher_citizen_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Candidate self-evaluation records
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
  judge_signature LONGTEXT DEFAULT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Department judges table (Judges assigned by department)
CREATE TABLE IF NOT EXISTS department_judges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(150) NOT NULL,
  judge_citizen_id VARCHAR(50) NOT NULL,
  period_id INT NOT NULL DEFAULT 1,
  role_in_board VARCHAR(50) NOT NULL DEFAULT 'กรรมการ',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dept_judge (department_name, judge_citizen_id, period_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Teacher submissions tracking table
CREATE TABLE IF NOT EXISTS teacher_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  teacher_citizen_id VARCHAR(50) NOT NULL,
  status ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'SUBMITTED',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teacher_submission (period_id, teacher_citizen_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
