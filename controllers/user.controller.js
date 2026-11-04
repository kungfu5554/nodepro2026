// controllers/user.controller.js
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { normalizeFullName } = require('./auth.controller');

// Map role code to display title
function getRoleTitle(role) {
  switch (role) {
    case 'admin': return 'ผู้ดูแลระบบ (Admin)';
    case 'hr': return 'ฝ่ายบุคลากร (HR)';
    case 'teacher': return 'ผู้รับการประเมิน';
    case 'judge': return 'กรรมการผู้ประเมิน';
    default: return role;
  }
}

// Get all users with optional filtering and search
async function getUsers(req, res, next) {
  try {
    const { role, search } = req.query;
    let query = `
      SELECT 
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
        signature_url AS signatureUrl,
        created_at AS createdAt
      FROM users
      WHERE 1=1
    `;
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

    res.status(200).json({
      status: 'success',
      message: 'Users retrieved successfully.',
      data: users,
      users: users
    });
  } catch (error) {
    next(error);
  }
}

// Get single user by citizen ID or numeric ID
async function getUserByCitizenId(req, res, next) {
  try {
    const { citizenId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
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
        signature_url AS signatureUrl
      FROM users
      WHERE citizen_id = ? OR id = ?
      LIMIT 1
    `, [citizenId, citizenId]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'User found.',
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
}

// Create new user (Admin/HR)
async function createUser(req, res, next) {
  try {
    const { citizenId, username, password, prefix, fullname, name, role, department, position, email, phone, employeeId } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const rawName = (fullname || name || '').trim();

    if (!finalCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกเลขประจำตัวประชาชน',
        data: null
      });
    }

    if (!rawName || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกชื่อ-นามสกุล รหัสผ่าน และบทบาทให้ครบถ้วน',
        data: null
      });
    }

    const validRoles = ['admin', 'hr', 'teacher', 'judge'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: `บทบาทไม่ถูกต้อง: ${role}`,
        data: null
      });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: `เลขประจำตัวประชาชน "${finalCitizenId}" มีอยู่ในระบบแล้ว`,
        data: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPrefix = prefix || 'นาย';
    const roleTitle = getRoleTitle(role);
    const displayName = normalizeFullName(userPrefix, rawName);
    const finalDept = (department && department.trim()) ? department.trim() : (role === 'teacher' ? 'แผนกวิชาเทคโนโลยีสารสนเทศ' : 'ส่วนกลาง');

    if (role === 'teacher' && finalDept) {
      await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [finalDept]);
    }

    const [result] = await pool.query(`
      INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, dept_status, requested_department, dept_reject_reason, position, email, phone, employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', NULL, NULL, ?, ?, ?, ?)
    `, [
      finalCitizenId,
      hashedPassword,
      userPrefix,
      displayName,
      role,
      roleTitle,
      finalDept,
      position || (role === 'teacher' ? 'ครู คศ.1' : roleTitle),
      email || null,
      phone || null,
      employeeId || null
    ]);

    res.status(201).json({
      status: 'success',
      message: 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว',
      data: {
        id: result.insertId,
        citizenId: finalCitizenId,
        name: displayName,
        role,
        roleTitle,
        department: finalDept,
        deptStatus: 'APPROVED',
        position: position || 'ครู คศ.1',
        email: email || null,
        phone: phone || null
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update existing user by citizen ID or numeric ID (Admin/HR)
async function updateUser(req, res, next) {
  try {
    const { citizenId } = req.params;
    const { fullname, name, prefix, role, department, position, password, email, phone, employeeId, newCitizenId } = req.body;

    const [existing] = await pool.query('SELECT * FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    const userRow = existing[0];
    const targetCitizenId = (newCitizenId && newCitizenId.trim() !== '') ? newCitizenId.trim() : userRow.citizen_id;

    if (targetCitizenId !== userRow.citizen_id) {
      const [dup] = await pool.query('SELECT id FROM users WHERE citizen_id = ? AND id != ?', [targetCitizenId, userRow.id]);
      if (dup.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: `เลขประจำตัวประชาชน "${targetCitizenId}" ถูกใช้งานแล้ว`,
          data: null
        });
      }
    }

    const effectiveRole = role || userRow.role;
    const roleTitle = getRoleTitle(effectiveRole);
    const effectivePrefix = prefix || userRow.prefix;
    const rawName = (fullname || name);
    const finalName = rawName ? normalizeFullName(effectivePrefix, rawName) : userRow.name;

    let newPasswordHash = userRow.password;
    if (password && String(password).trim() !== '') {
      newPasswordHash = await bcrypt.hash(String(password), 10);
    }

    const hasDeptUpdate = department !== undefined && department !== null && String(department).trim() !== '';
    const finalDept = hasDeptUpdate ? String(department).trim() : userRow.department;

    if (hasDeptUpdate && effectiveRole === 'teacher') {
      await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [finalDept]);
    }

    await pool.query(`
      UPDATE users
      SET citizen_id = ?,
          name = ?,
          prefix = ?,
          role = ?,
          role_title = ?,
          department = ?,
          dept_status = ?,
          requested_department = ?,
          dept_reject_reason = ?,
          position = COALESCE(?, position),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          employee_id = COALESCE(?, employee_id),
          password = ?
      WHERE id = ?
    `, [
      targetCitizenId,
      finalName,
      effectivePrefix,
      effectiveRole,
      roleTitle,
      finalDept,
      hasDeptUpdate ? 'APPROVED' : userRow.dept_status,
      hasDeptUpdate ? null : userRow.requested_department,
      hasDeptUpdate ? null : userRow.dept_reject_reason,
      position !== undefined ? position : null,
      email !== undefined ? email : null,
      phone !== undefined ? phone : null,
      employeeId !== undefined ? employeeId : null,
      newPasswordHash,
      userRow.id
    ]);

    res.status(200).json({
      status: 'success',
      message: 'บันทึกการแก้ไขข้อมูลผู้ใช้งานเรียบร้อยแล้ว',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// Reset user password by citizen ID or numeric ID (Admin/HR)
async function resetUserPassword(req, res, next) {
  try {
    const { citizenId } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร',
        data: null
      });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, existing[0].id]);

    res.status(200).json({
      status: 'success',
      message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// Delete user by citizen ID or numeric ID
async function deleteUser(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { citizenId } = req.params;

    const [existing] = await conn.query('SELECT id, citizen_id FROM users WHERE citizen_id = ? OR id = ? LIMIT 1', [citizenId, citizenId]);
    if (existing.length === 0) {
      conn.release();
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    if (req.user && existing[0].id === req.user.id) {
      conn.release();
      return res.status(400).json({
        status: 'error',
        message: 'ไม่สามารถลบบัญชีผู้ใช้งานของตนเองที่กำลังเข้าสู่ระบบอยู่ได้',
        data: null
      });
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

    res.status(200).json({
      status: 'success',
      message: 'ลบผู้ใช้งานสำเร็จ',
      data: null
    });
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
