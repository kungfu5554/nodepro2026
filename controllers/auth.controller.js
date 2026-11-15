// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { getJwtSecret, ok, fail } = require('../utils/response');
const { parseRequiredJudges } = require('../utils/validation');

const KNOWN_PREFIXES = ['ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ว่าที่ ร.ต.', 'นางสาว', 'ดร.', 'นาย', 'นาง'];

function normalizeFullName(prefix, rawName) {
  let clean = (rawName || '').trim();
  for (const p of KNOWN_PREFIXES) {
    if (clean.startsWith(p)) {
      clean = clean.slice(p.length).trim();
      break;
    }
  }
  const pfx = (prefix || '').trim();
  return pfx ? `${pfx}${clean}` : clean;
}

function formatUserPayload(user) {
  return {
    id: user.id,
    citizenId: user.citizen_id,
    prefix: user.prefix,
    name: user.name,
    role: user.role,
    roleTitle: user.role_title,
    department: user.department,
    deptStatus: user.dept_status || 'APPROVED',
    requestedDepartment: user.requested_department || null,
    deptRejectReason: user.dept_reject_reason || null,
    position: user.position,
    email: user.email,
    phone: user.phone,
    employeeId: user.employee_id,
    requiredJudges: Number(user.required_judges) || 3,
    signatureUrl: user.signature_url
  };
}

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      citizenId: user.citizen_id,
      name: user.name,
      role: user.role,
      roleTitle: user.role_title
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function resolveDepartmentChoice({ department, customDepartment, isCustomDepartment, isAdminOrHr = false, enforceTeacherApproval = true }) {
  const wantsCustom = Boolean(isCustomDepartment) || department === '__CUSTOM__' || (customDepartment && String(customDepartment).trim() !== '');
  const rawDept = wantsCustom ? String(customDepartment || '').trim() : String(department || '').trim();

  if (!rawDept) {
    return { error: wantsCustom ? 'กรุณาระบุชื่อสาขาวิชาที่ต้องการขอเพิ่มให้ฝ่ายบุคลากรอนุมัติ' : 'กรุณาเลือกสาขาวิชา / แผนกวิชา' };
  }

  const [deptCheck] = await pool.query('SELECT name FROM departments WHERE name = ?', [rawDept]);
  if (deptCheck.length > 0) {
    return { department: deptCheck[0].name, deptStatus: 'APPROVED', requestedDepartment: null };
  }

  if (isAdminOrHr) {
    await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [rawDept]);
    return { department: rawDept, deptStatus: 'APPROVED', requestedDepartment: null };
  }

  if (!enforceTeacherApproval) {
    return { department: rawDept, deptStatus: 'APPROVED', requestedDepartment: null };
  }

  return { department: null, deptStatus: 'PENDING', requestedDepartment: rawDept };
}

async function getPublicDepartments(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, name, code FROM departments ORDER BY id ASC');
    return ok(res, 'Departments retrieved.', rows);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { citizenId, password } = req.body;
    if (!citizenId || !password) {
      return fail(res, 'กรุณากรอกเลขประจำตัวประชาชนและรหัสผ่าน', 400);
    }

    const loginId = citizenId.trim();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE citizen_id = ? OR email = ? OR employee_id = ?',
      [loginId, loginId, loginId]
    );
    if (rows.length === 0) {
      return fail(res, 'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(String(password), String(user.password || '')).catch(() => false);
    if (!isMatch) {
      return fail(res, 'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง', 401);
    }

    const token = signUserToken(user);
    setAuthCookie(res, token);
    return ok(res, 'เข้าสู่ระบบสำเร็จ', { token, user: formatUserPayload(user) });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie('auth_token');
  return ok(res, 'ออกจากระบบเรียบร้อยแล้ว');
}

async function register(req, res, next) {
  try {
    const {
      citizenId, username, employeeId, email, phone, password,
      prefix, name, fullname, department, customDepartment, isCustomDepartment,
      position, requiredJudges, signature, signatureUrl
    } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const rawName = (fullname || name || '').trim();
    const finalSignature = signature || signatureUrl || null;

    if (!finalCitizenId) {
      return fail(res, 'กรุณากรอกเลขประจำตัวประชาชน', 400);
    }
    if (!password || String(password).length < 4 || !rawName) {
      return fail(res, 'กรุณากรอกชื่อ-นามสกุล และรหัสผ่านอย่างน้อย 4 ตัวอักษร', 400);
    }

    const parsedJudges = parseRequiredJudges(requiredJudges, 3);
    if (!parsedJudges.valid) {
      return fail(res, 'จำนวนกรรมการที่ต้องการประเมินต้องเป็นตัวเลขจำนวนเต็มระหว่าง 1 ถึง 10 ท่าน', 400);
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return fail(res, 'เลขประจำตัวประชาชนนี้ถูกลงทะเบียนในระบบแล้ว', 400);
    }

    const deptResult = await resolveDepartmentChoice({ department, customDepartment, isCustomDepartment });
    if (deptResult.error) {
      return fail(res, deptResult.error, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPrefix = prefix || 'นาย';
    const completeName = normalizeFullName(userPrefix, rawName);

    const [result] = await pool.query(`
      INSERT INTO users (
        citizen_id, password, prefix, name, role, role_title,
        department, dept_status, requested_department, dept_reject_reason,
        position, email, phone, employee_id, required_judges, signature_url
      )
      VALUES (?, ?, ?, ?, 'teacher', 'ผู้รับการประเมิน', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId, hashedPassword, userPrefix, completeName,
      deptResult.department, deptResult.deptStatus, deptResult.requestedDepartment,
      position || 'ครูผู้ช่วย', email || null, phone || null, employeeId || null,
      parsedJudges.value, finalSignature
    ]);

    const [createdRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = createdRows[0];
    const token = signUserToken(user);
    setAuthCookie(res, token);

    const message = deptResult.deptStatus === 'PENDING'
      ? 'ลงทะเบียนสำเร็จ คำขอเพิ่มสาขาวิชาใหม่ถูกส่งให้ฝ่ายบุคลากร (HR) พิจารณาอนุมัติแล้ว'
      : 'ลงทะเบียนสำเร็จ';

    return ok(res, message, { token, user: formatUserPayload(user) }, 201);
  } catch (error) {
    next(error);
  }
}

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);
    }
    return ok(res, 'Profile retrieved successfully.', formatUserPayload(rows[0]));
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const [currentRows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (currentRows.length === 0) {
      return fail(res, 'ไม่พบข้อมูลผู้ใช้งาน', 404);
    }
    const currentUser = currentRows[0];

    const {
      prefix, name, department, customDepartment, isCustomDepartment,
      position, email, phone, employeeId, requiredJudges, signature, signatureUrl, password
    } = req.body;

    const updates = [];
    const params = [];
    const effectivePrefix = prefix !== undefined ? prefix : currentUser.prefix;

    if (prefix !== undefined) { updates.push('prefix = ?'); params.push(prefix); }
    if (name !== undefined && String(name).trim() !== '') {
      updates.push('name = ?');
      params.push(normalizeFullName(effectivePrefix, name));
    }

    const hasDeptInput = Boolean(isCustomDepartment) || department === '__CUSTOM__' || (customDepartment && String(customDepartment).trim() !== '') || (department !== undefined && department !== null && String(department).trim() !== '');
    if (hasDeptInput) {
      const deptResult = await resolveDepartmentChoice({
        department,
        customDepartment,
        isCustomDepartment,
        isAdminOrHr: currentUser.role === 'admin' || currentUser.role === 'hr',
        enforceTeacherApproval: currentUser.role === 'teacher'
      });
      if (deptResult.error) return fail(res, deptResult.error, 400);

      updates.push('department = ?, dept_status = ?, requested_department = ?, dept_reject_reason = NULL');
      params.push(deptResult.department, deptResult.deptStatus, deptResult.requestedDepartment);
    }

    if (requiredJudges !== undefined && requiredJudges !== null && requiredJudges !== '') {
      const parsedJudges = parseRequiredJudges(requiredJudges);
      if (!parsedJudges.valid) {
        return fail(res, 'จำนวนกรรมการที่ต้องการประเมินต้องเป็นตัวเลขจำนวนเต็มระหว่าง 1 ถึง 10 ท่าน', 400);
      }
      const [maxRows] = await pool.query(`
        SELECT COUNT(*) AS cnt
        FROM assignments
        WHERE teacher_citizen_id = ? AND status IN ('CLAIMED', 'SUBMITTED', 'EVALUATED')
        GROUP BY period_id
        ORDER BY cnt DESC
        LIMIT 1
      `, [currentUser.citizen_id]);
      const currentClaimedMax = maxRows.length > 0 ? Number(maxRows[0].cnt) : 0;
      if (parsedJudges.value < currentClaimedMax) {
        return fail(res, `ไม่สามารถลดจำนวนกรรมการต่ำกว่า ${currentClaimedMax} ท่านได้ เนื่องจากมีกรรมการกดรับประเมินแล้ว ${currentClaimedMax} ท่าน`, 400);
      }
      updates.push('required_judges = ?');
      params.push(parsedJudges.value);
    }

    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (employeeId !== undefined) { updates.push('employee_id = ?'); params.push(employeeId); }
    if (signature || signatureUrl) { updates.push('signature_url = ?'); params.push(signature || signatureUrl); }

    if (password && String(password).trim() !== '') {
      if (String(password).length < 4) {
        return fail(res, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', 400);
      }
      updates.push('password = ?');
      params.push(await bcrypt.hash(String(password), 10));
    }

    if (updates.length > 0) {
      params.push(currentUser.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [currentUser.id]);
    return ok(res, 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว', formatUserPayload(rows[0]));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicDepartments,
  login,
  logout,
  register,
  getProfile,
  updateProfile,
  normalizeFullName,
  formatUserPayload
};
