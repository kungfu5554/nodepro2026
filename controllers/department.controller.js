const { pool } = require('../config/database');
const { ok, fail } = require('../utils/response');

async function getDepartments(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT d.id, d.name, d.code,
        (SELECT COUNT(*) FROM users u WHERE u.role = 'teacher' AND u.department = d.name AND u.dept_status = 'APPROVED') AS teacherCount,
        (SELECT COUNT(DISTINCT dj.judge_citizen_id) FROM department_judges dj WHERE dj.department_name = d.name) AS judgeCount,
        d.created_at AS createdAt
      FROM departments d ORDER BY d.id ASC
    `);
    return ok(res, 'Departments retrieved successfully.', rows);
  } catch (e) { next(e); }
}

async function createDepartment(req, res, next) {
  try {
    const { name, code } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) return fail(res, 'กรุณากรอกชื่อสาขาวิชา/แผนก', 400);

    const [existing] = await pool.query('SELECT id FROM departments WHERE name = ?', [cleanName]);
    if (existing.length > 0) return fail(res, 'ชื่อสาขาวิชานี้มีอยู่ในระบบแล้ว', 409);

    const [result] = await pool.query('INSERT INTO departments (name, code) VALUES (?, ?)', [cleanName, code ? code.trim() : null]);
    await pool.query("UPDATE users SET department = ?, dept_status = 'APPROVED', requested_department = NULL, dept_reject_reason = NULL WHERE dept_status = 'PENDING' AND requested_department = ?", [cleanName, cleanName]);
    return ok(res, 'เพิ่มสาขาวิชาเรียบร้อยแล้ว', { id: result.insertId, name: cleanName, code: code ? code.trim() : null }, 201);
  } catch (e) { next(e); }
}

async function deleteDepartment(req, res, next) {
  try {
    const { id } = req.params;
    const [depts] = await pool.query('SELECT id, name FROM departments WHERE id = ?', [id]);
    if (depts.length === 0) return fail(res, 'ไม่พบข้อมูลสาขาวิชา', 404);
    const deptName = depts[0].name;

    const [[{ userCount }]] = await pool.query('SELECT COUNT(*) AS userCount FROM users WHERE department = ? OR requested_department = ?', [deptName, deptName]);
    if (userCount > 0) return fail(res, `ไม่สามารถลบสาขาวิชา "${deptName}" ได้ เนื่องจากยังมีบุคลากรสังกัดหรือขออนุมัติอยู่ ${userCount} คน`, 400);

    await pool.query('DELETE FROM department_judges WHERE department_name = ?', [deptName]);
    await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    return ok(res, 'ลบสาขาวิชาเรียบร้อยแล้ว');
  } catch (e) { next(e); }
}

async function getDepartmentJudges(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT dj.id, dj.department_name AS departmentName, dj.judge_citizen_id AS judgeCitizenId,
        u.name AS judgeName, u.position AS judgePosition, dj.role_in_board AS roleInBoard,
        dj.period_id AS periodId, dj.created_at AS createdAt
      FROM department_judges dj
      JOIN users u ON dj.judge_citizen_id = u.citizen_id
      WHERE dj.period_id = ? ORDER BY dj.department_name ASC, dj.id ASC
    `, [req.query.periodId || 1]);
    return ok(res, 'Department judges retrieved successfully.', rows);
  } catch (e) { next(e); }
}

async function assignDepartmentJudge(req, res, next) {
  try {
    const { departmentName, judgeCitizenId, roleInBoard, periodId = 1 } = req.body;
    if (!departmentName || !judgeCitizenId) return fail(res, 'กรุณาเลือกสาขาวิชาและกรรมการผู้ประเมิน', 400);
    const [result] = await pool.query(`
      INSERT INTO department_judges (department_name, judge_citizen_id, role_in_board, period_id) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE role_in_board = VALUES(role_in_board)
    `, [departmentName, judgeCitizenId, roleInBoard || 'กรรมการ', periodId]);
    return ok(res, 'แต่งตั้งกรรมการประจำสาขาวิชาเรียบร้อยแล้ว', { id: result.insertId }, 201);
  } catch (e) { next(e); }
}

async function removeDepartmentJudge(req, res, next) {
  try {
    await pool.query('DELETE FROM department_judges WHERE id = ?', [req.params.id]);
    return ok(res, 'ถอดถอนกรรมการออกจากสาขาวิชาเรียบร้อยแล้ว');
  } catch (e) { next(e); }
}

async function getDepartmentRequests(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT id, citizen_id AS citizenId, prefix, name, role, position, phone, email,
        department, dept_status AS deptStatus, requested_department AS requestedDepartment,
        dept_reject_reason AS deptRejectReason, created_at AS createdAt, updated_at AS updatedAt
      FROM users WHERE dept_status IN ('PENDING', 'REJECTED')
      ORDER BY FIELD(dept_status, 'PENDING', 'REJECTED'), updated_at DESC
    `);
    return ok(res, 'Department requests retrieved.', rows);
  } catch (e) { next(e); }
}

async function approveDepartmentRequest(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { userId } = req.params;
    const { departmentName, code } = req.body || {};
    const [users] = await conn.query('SELECT * FROM users WHERE id = ? OR citizen_id = ? LIMIT 1', [userId, userId]);
    if (users.length === 0) { conn.release(); return fail(res, 'ไม่พบข้อมูลบุคลากรที่ส่งคำขอ', 404); }
    const userRow = users[0];
    const approvedName = String(departmentName || userRow.requested_department || '').trim();
    if (!approvedName) { conn.release(); return fail(res, 'ไม่พบชื่อสาขาวิชาที่จะอนุมัติ', 400); }

    await conn.beginTransaction();
    await conn.query('INSERT INTO departments (name, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE code = COALESCE(VALUES(code), code)', [approvedName, code && String(code).trim() ? String(code).trim() : null]);
    await conn.query("UPDATE users SET department = ?, dept_status = 'APPROVED', requested_department = NULL, dept_reject_reason = NULL WHERE id = ? OR (dept_status = 'PENDING' AND requested_department = ?)", [approvedName, userRow.id, userRow.requested_department || approvedName]);
    await conn.commit();
    conn.release();
    return ok(res, `อนุมัติสาขาวิชา "${approvedName}" เรียบร้อยแล้ว`, { departmentName: approvedName });
  } catch (e) {
    await conn.rollback();
    conn.release();
    next(e);
  }
}

async function rejectDepartmentRequest(req, res, next) {
  try {
    const { userId } = req.params;
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) return fail(res, 'กรุณาระบุเหตุผลที่ไม่อนุมัติสาขาวิชา เพื่อแจ้งให้ผู้รับการประเมินทราบ', 400);
    const [users] = await pool.query('SELECT id FROM users WHERE id = ? OR citizen_id = ? LIMIT 1', [userId, userId]);
    if (users.length === 0) return fail(res, 'ไม่พบข้อมูลบุคลากรที่ส่งคำขอ', 404);
    await pool.query("UPDATE users SET dept_status = 'REJECTED', dept_reject_reason = ? WHERE id = ?", [String(reason).trim(), users[0].id]);
    return ok(res, 'บันทึกการไม่อนุมัติพร้อมแจ้งเหตุผลให้บุคลากรทราบเรียบร้อยแล้ว');
  } catch (e) { next(e); }
}

module.exports = { getDepartments, createDepartment, deleteDepartment, getDepartmentJudges, assignDepartmentJudge, removeDepartmentJudge, getDepartmentRequests, approveDepartmentRequest, rejectDepartmentRequest };
