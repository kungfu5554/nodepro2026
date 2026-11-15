// controllers/user.controller.js
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { normalizeFullName } = require('./auth.controller');
const { ok, fail } = require('../utils/response');
const { parseRequiredJudges } = require('../utils/validation');

const ROLE_TITLES = {
  admin: 'ผู้ดูแลระบบ (Admin)',
  hr: 'ฝ่ายบุคลากร (HR)',
  teacher: 'ผู้รับการประเมิน',
  judge: 'กรรมการผู้ประเมิน'
};

function getRoleTitle(role) {
  return ROLE_TITLES[role] || role;
}

const USER_SELECT_FIELDS = `
  id,
  citizen_id AS citizenId,
  prefix,
  name,
  role,
  role_title AS roleTitle,
  department,
  dept_status AS deptStatus,
  requested_department AS requestedDepartment,
  dept_reject_reason AS deptRejectReason,
  position,
  email,
  phone,
  employee_id AS employeeId,
  required_judges AS requiredJudges,
  signature_url AS signatureUrl,
  created_at AS createdAt
`;

async function getUsers(req, res, next) {
  try {
    const { role, search } = req.query;
    let query = `SELECT ${USER_SELECT_FIELDS} FROM users WHERE 1=1`;
    const params = [];

    if (role && role !== 'ALL') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR citizen_id LIKE ? OR email LIKE ? OR department LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY id DESC';
    const [users] = await pool.query(query, params);
    return ok(res, 'Users retrieved successfully.', users, 200, { users });
  } catch (error) {
    next(error);
  }
}

async function getUserByCitizenId(req, res, next) {
  try {
    const { citizenId } = req.params;
    const [rows] = await pool.query(
      `SELECT ${USER_SELECT_FIELDS} FROM users WHERE citizen_id = ? OR id = ? LIMIT 1`,
      [citizenId, citizenId]
    );
    if (rows.length === 0) {
      return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);
    }
    return ok(res, 'User found.', rows[0]);
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const {
      citizenId, username, password, prefix, fullname, name,
      role, department, position, email, phone, employeeId, requiredJudges
    } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const rawName = (fullname || name || '').trim();

    if (!finalCitizenId) return fail(res, 'กรุณากรอกเลขประจำตัวประชาชน', 400);
    if (!rawName || !password || !role) {
      return fail(res, 'กรุณากรอกชื่อ-นามสกุล รหัสผ่าน และบทบาทให้ครบถ้วน', 400);
    }
    if (String(password).length < 4) {
      return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 400);
    }
    if (!ROLE_TITLES[role]) {
      return fail(res, `บทบาทไม่ถูกต้อง: ${role}`, 400);
    }

    const parsedJudges = parseRequiredJudges(requiredJudges, 3);
    if (!parsedJudges.valid) {
      return fail(res, 'จำนวนกรรมการที่ต้องการประเมินต้องเป็นตัวเลขจำนวนเต็มระหว่าง 1 ถึง 10 ท่าน', 400);
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return fail(res, `เลขประจำตัวประชาชน "${finalCitizenId}" มีอยู่ในระบบแล้ว`, 409);
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const userPrefix = prefix || 'นาย';
    const roleTitle = getRoleTitle(role);
    const displayName = normalizeFullName(userPrefix, rawName);
    const finalDept = (department && department.trim())
      ? department.trim()
      : (role === 'teacher' ? 'แผนกวิชาเทคโนโลยีสารสนเทศ' : 'ส่วนกลาง');

    if (role === 'teacher' && finalDept) {
      await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [finalDept]);
    }

    const [result] = await pool.query(`
      INSERT INTO users (
        citizen_id, password, prefix, name, role, role_title,
        department, dept_status, requested_department, dept_reject_reason,
        position, email, phone, employee_id, required_judges
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', NULL, NULL, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId, hashedPassword, userPrefix, displayName, role, roleTitle,
      finalDept, position || (role === 'teacher' ? 'ครู คศ.1' : roleTitle),
      email || null, phone || null, employeeId || null, parsedJudges.value
    ]);

    return ok(res, 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว', {
      id: result.insertId,
      citizenId: finalCitizenId,
      name: displayName,
      role,
      roleTitle,
      department: finalDept,
      deptStatus: 'APPROVED',
      requiredJudges: parsedJudges.value,
      position: position || (role === 'teacher' ? 'ครู คศ.1' : roleTitle),
      email: email || null,
      phone: phone || null
    }, 201);
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { citizenId } = req.params;
    const {
      fullname, name, prefix, role, department, position,
      password, email, phone, employeeId, newCitizenId, requiredJudges
    } = req.body;

    const [existing] = await pool.query('SELECT * FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);

    const userRow = existing[0];
    const targetCitizenId = (newCitizenId && newCitizenId.trim() !== '') ? newCitizenId.trim() : userRow.citizen_id;

    if (targetCitizenId !== userRow.citizen_id) {
      const [dup] = await pool.query('SELECT id FROM users WHERE citizen_id = ? AND id != ?', [targetCitizenId, userRow.id]);
      if (dup.length > 0) return fail(res, `เลขประจำตัวประชาชน "${targetCitizenId}" ถูกใช้งานแล้ว`, 409);
    }

    const effectiveRole = role || userRow.role;
    if (!ROLE_TITLES[effectiveRole]) return fail(res, `บทบาทไม่ถูกต้อง: ${effectiveRole}`, 400);

    const parsedJudges = parseRequiredJudges(requiredJudges, userRow.required_judges || 3);
    if (!parsedJudges.valid) {
      return fail(res, 'จำนวนกรรมการที่ต้องการประเมินต้องเป็นตัวเลขจำนวนเต็มระหว่าง 1 ถึง 10 ท่าน', 400);
    }

    let newPasswordHash = userRow.password;
    if (password && String(password).trim() !== '') {
      if (String(password).length < 4) {
        return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 400);
      }
      newPasswordHash = await bcrypt.hash(String(password), 10);
    }

    const effectivePrefix = prefix || userRow.prefix;
    const rawName = fullname || name;
    const finalName = rawName ? normalizeFullName(effectivePrefix, rawName) : userRow.name;
    const hasDeptUpdate = department !== undefined && department !== null && String(department).trim() !== '';
    const finalDept = hasDeptUpdate ? String(department).trim() : userRow.department;

    if (hasDeptUpdate && effectiveRole === 'teacher') {
      await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [finalDept]);
    }

    await pool.query(`
      UPDATE users
      SET citizen_id = ?, name = ?, prefix = ?, role = ?, role_title = ?,
          department = ?, dept_status = ?, requested_department = ?, dept_reject_reason = ?,
          position = COALESCE(?, position),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          employee_id = COALESCE(?, employee_id),
          required_judges = ?,
          password = ?
      WHERE id = ?
    `, [
      targetCitizenId, finalName, effectivePrefix, effectiveRole, getRoleTitle(effectiveRole),
      finalDept,
      hasDeptUpdate ? 'APPROVED' : userRow.dept_status,
      hasDeptUpdate ? null : userRow.requested_department,
      hasDeptUpdate ? null : userRow.dept_reject_reason,
      position !== undefined ? position : null,
      email !== undefined ? email : null,
      phone !== undefined ? phone : null,
      employeeId !== undefined ? employeeId : null,
      parsedJudges.value,
      newPasswordHash,
      userRow.id
    ]);

    return ok(res, 'บันทึกการแก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
}

async function resetUserPassword(req, res, next) {
  try {
    const { citizenId } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 4) {
      return fail(res, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร', 400);
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);

    const hashedPassword = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, existing[0].id]);
    return ok(res, 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { citizenId } = req.params;
    const [existing] = await conn.query('SELECT id, citizen_id FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) {
      conn.release();
      return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);
    }
    if (req.user && existing[0].id === req.user.id) {
      conn.release();
      return fail(res, 'ไม่สามารถลบบัญชีผู้ใช้งานของตนเองที่กำลังเข้าสู่ระบบอยู่ได้', 400);
    }

    const targetCid = existing[0].citizen_id;
    await conn.beginTransaction();
    await conn.query('DELETE FROM teacher_submissions WHERE teacher_citizen_id = ?', [targetCid]);
    await conn.query('DELETE FROM self_evaluations WHERE teacher_citizen_id = ?', [targetCid]);
    await conn.query('DELETE FROM department_judges WHERE judge_citizen_id = ?', [targetCid]);
    await conn.query('DELETE FROM assignments WHERE teacher_citizen_id = ? OR judge_citizen_id = ?', [targetCid, targetCid]);
    await conn.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
    await conn.commit();
    conn.release();

    return ok(res, 'ลบผู้ใช้งานสำเร็จ');
  } catch (error) {
    await conn.rollback();
    conn.release();
    next(error);
  }
}

module.exports = {
  getUsers,
  getUserByCitizenId,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser
};
