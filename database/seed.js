// database/seed.js
const bcrypt = require('bcryptjs');

async function seedInitialData(pool) {
  // 1. Evaluation periods
  await pool.query(`
    INSERT IGNORE INTO evaluation_periods (id, name, start_date, end_date, is_open)
    VALUES 
      (1, 'รอบการประเมินที่ 1 ประจำปีการศึกษา 2568', '2026-10-01', '2026-11-30', 1),
      (2, 'รอบการประเมินที่ 2 ประจำปีการศึกษา 2567', '2026-04-01', '2026-05-31', 0);
  `);

  // 2. Evaluation metric categories
  await pool.query(`
    INSERT IGNORE INTO metric_categories (id, period_id, name, description, sort_order)
    VALUES
      (1, 1, 'ด้านการจัดการเรียนรู้', 'ตัวชี้วัดเกี่ยวกับการออกแบบและจัดการเรียนรู้แก่ผู้เรียน', 1),
      (2, 1, 'ด้านการพัฒนาตนเองและมีส่วนร่วม', 'ตัวชี้วัดเกี่ยวกับการพัฒนาวิชาชีพและกิจกรรมสถานศึกษา', 2),
      (3, 2, 'ด้านการจัดการเรียนรู้', 'ตัวชี้วัดเกี่ยวกับการออกแบบและจัดการเรียนรู้แก่ผู้เรียน', 1),
      (4, 2, 'ด้านการพัฒนาตนเองและมีส่วนร่วม', 'ตัวชี้วัดเกี่ยวกับการพัฒนาวิชาชีพและกิจกรรมสถานศึกษา', 2);
  `);

  // 3. Evaluation metrics
  await pool.query(`
    INSERT IGNORE INTO metrics (id, period_id, category_id, title, description, weight, eval_type, evidence_type)
    VALUES
      (1, 1, 1, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
      (2, 1, 2, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
      (3, 1, 2, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE'),
      (4, 2, 3, 'ด้านการจัดการเรียนรู้และการพัฒนาผู้เรียน', 'การจัดทำแผนการจัดการเรียนรู้และสื่อการสอน', 40, 'SCALE', 'PDF'),
      (5, 2, 4, 'ด้านการพัฒนาตนเองและวิชาชีพ', 'การเข้ารับการอบรมและพัฒนาสมรรถนะวิชาชีพ', 30, 'SCALE', 'URL'),
      (6, 2, 4, 'การมีส่วนร่วมในกิจกรรมสถานศึกษา', 'การเข้าร่วมโครงการและกิจกรรมของสถานศึกษา', 30, 'BOOLEAN', 'IMAGE');
  `);
  await pool.query(`
    UPDATE metrics SET category_id = 1 WHERE id = 1 AND category_id IS NULL;
    UPDATE metrics SET category_id = 2 WHERE id IN (2, 3) AND category_id IS NULL;
    UPDATE metrics SET category_id = 3 WHERE id = 4 AND category_id IS NULL;
    UPDATE metrics SET category_id = 4 WHERE id IN (5, 6) AND category_id IS NULL;
  `);

  // 3. Default test users (only insert if missing)
  const defaultUsers = [
    ['1100000000000', 'admin1234', 'นาย', 'นายพัฒนพงษ์ เทคโนแอดมิน', 'admin', 'ผู้ดูแลระบบ (Admin)', 'ศูนย์เทคโนโลยีสารสนเทศ', 'ผู้ดูแลระบบ', 3],
    ['1100100000001', 'hr1234', 'นางสาว', 'นางสาวดวงใจ รัตนพร', 'hr', 'ฝ่ายบุคลากร (HR)', 'งานบุคลากร', 'เจ้าหน้าที่งานบุคลากร', 3],
    ['1100200000002', 'pass1234', 'นาย', 'นายสมชาย ใจดี', 'teacher', 'ผู้รับการประเมิน', 'แผนกวิชาเทคโนโลยีสารสนเทศ', 'ครู คศ.1', 3],
    ['1100300000003', 'judge1234', 'ดร.', 'ดร.สมศักดิ์ ทรงธรรม', 'judge', 'กรรมการผู้ประเมิน', 'คณะกรรมการประเมินภายนอก', 'ประธานกรรมการประเมิน', 3],
    ['1100400000004', 'pass1234', 'นางสาว', 'นางสาวกานดา วงศ์สุวรรณ', 'teacher', 'ผู้รับการประเมิน', 'แผนกวิชาคอมพิวเตอร์ธุรกิจ', 'ครูผู้ช่วย', 3],
    ['1100500000005', 'judge1234', 'ผศ.ดร.', 'ผศ.ดร.วิชัย พิริยะกุล', 'judge', 'กรรมการผู้ประเมิน', 'แผนกวิชาเทคโนโลยีสารสนเทศ', 'กรรมการผู้ทรงคุณวุฒิ', 3]
  ];

  for (const [citizenId, rawPass, prefix, name, role, roleTitle, dept, position, requiredJudges] of defaultUsers) {
    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [citizenId]);
    if (existing.length === 0) {
      const hashed = await bcrypt.hash(rawPass, 10);
      await pool.query(`
        INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, dept_status, position, required_judges)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?)
      `, [citizenId, hashed, prefix, name, role, roleTitle, dept, position, requiredJudges]);
    }
  }

  // 4. Departments
  await pool.query(`
    INSERT IGNORE INTO departments (name, code)
    VALUES 
      ('แผนกวิชาเทคโนโลยีสารสนเทศ', 'IT'),
      ('แผนกวิชาคอมพิวเตอร์ธุรกิจ', 'BC'),
      ('แผนกวิชาการบัญชี', 'ACC'),
      ('แผนกวิชาช่างยนต์', 'AUTO'),
      ('แผนกวิชาการจัดการโลจิสติกส์', 'LOG');
  `);

  // 5. Department judges
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

  // 6. Seed candidate 2 self-evaluations & submission so judge can claim immediately
  await pool.query(`
    INSERT IGNORE INTO self_evaluations (period_id, teacher_citizen_id, metric_id, self_score, teacher_comment, evidence_url)
    VALUES
      (1, '1100400000004', 1, '4', 'จัดทำแผนการจัดการเรียนรู้ฐานสมรรถนะและสื่อการสอนออนไลน์ครบถ้วนทุกรายวิชา', NULL),
      (1, '1100400000004', 2, '3', 'เข้าร่วมอบรมเชิงปฏิบัติการพัฒนาทักษะดิจิทัลสำหรับการจัดการเรียนการสอน 24 ชั่วโมง', NULL),
      (1, '1100400000004', 3, 'มี', 'ปฏิบัติหน้าที่ครูที่ปรึกษาและร่วมกิจกรรมพัฒนาผู้เรียนของสถานศึกษาอย่างสม่ำเสมอ', NULL);
  `);

  await pool.query(`
    INSERT IGNORE INTO teacher_submissions (period_id, teacher_citizen_id, status)
    VALUES (1, '1100400000004', 'SUBMITTED');
  `);
}

module.exports = { seedInitialData };
