// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

function normalizeFullName(prefix, rawName) {
  let clean = (rawName || '').trim();
  const knownPrefixes = ['ผศ.ดร.', 'รศ.ดร.', 'ศ.ดร.', 'ว่าที่ ร.ต.', 'นางสาว', 'ดร.', 'นาย', 'นาง'];
  for (const p of knownPrefixes) {
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
    signatureUrl: user.signature_url
  };
}

// Public endpoint: Get approved departments for registration & dropdowns
async function getPublicDepartments(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, name, code FROM departments ORDER BY id ASC');
    res.status(200).json({
      status: 'success',
      message: 'Departments retrieved.',
      data: rows
    });
  } catch (error) {
    next(error);
  }
}

// Authenticate user credentials and issue JWT
async function login(req, res, next) {
  try {
    const { citizenId, password } = req.body;

    if (!citizenId || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกเลขประจำตัวประชาชนและรหัสผ่าน',
        data: null
      });
    }

    const loginIdentifier = citizenId.trim();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE citizen_id = ? OR email = ? OR employee_id = ?',
      [loginIdentifier, loginIdentifier, loginIdentifier]
    );
    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง',
        data: null
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
    const isPlainMatch = (password === user.password);

    if (!isMatch && !isPlainMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'เลขประจำตัวประชาชนหรือรหัสผ่านไม่ถูกต้อง',
        data: null
      });
    }

    const tokenPayload = {
      id: user.id,
      citizenId: user.citizen_id,
      name: user.name,
      role: user.role,
      roleTitle: user.role_title
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'evaluation_system_jwt_secret_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      status: 'success',
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        token,
        user: formatUserPayload(user)
      }
    });
  } catch (error) {
    next(error);
  }
}

// Register candidate (evaluatee) with approved department selection or custom HR request
async function register(req, res, next) {
  try {
    const {
      citizenId,
      username,
      employeeId,
      email,
      phone,
      password,
      prefix,
      name,
      fullname,
      department,
      customDepartment,
      isCustomDepartment,
      position,
      signature,
      signatureUrl
    } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const rawName = (fullname || name || '').trim();
    const finalSignature = signature || signatureUrl || null;

    if (!finalCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกเลขประจำตัวประชาชน',
        data: null
      });
    }

    if (!password || String(password).length < 4 || !rawName) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณากรอกชื่อ-นามสกุล และรหัสผ่านอย่างน้อย 4 ตัวอักษร',
        data: null
      });
    }

    // Check duplicate citizen ID
    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'เลขประจำตัวประชาชนนี้ถูกลงทะเบียนในระบบแล้ว',
        data: null
      });
    }

    // Resolve department vs custom department request to HR
    let finalDepartment = null;
    let deptStatus = 'APPROVED';
    let requestedDepartment = null;

    const wantsCustom = Boolean(isCustomDepartment) || department === '__CUSTOM__' || (customDepartment && String(customDepartment).trim() !== '');
    if (wantsCustom) {
      const reqName = String(customDepartment || '').trim();
      if (!reqName) {
        return res.status(400).json({
          status: 'error',
          message: 'กรุณาระบุชื่อสาขาวิชาที่ต้องการขอเพิ่มให้ฝ่ายบุคลากรอนุมัติ',
          data: null
        });
      }
      // Check if this department already exists in approved departments
      const [deptCheck] = await pool.query('SELECT name FROM departments WHERE name = ?', [reqName]);
      if (deptCheck.length > 0) {
        finalDepartment = deptCheck[0].name;
        deptStatus = 'APPROVED';
        requestedDepartment = null;
      } else {
        finalDepartment = null;
        deptStatus = 'PENDING';
        requestedDepartment = reqName;
      }
    } else {
      const selDept = String(department || '').trim();
      if (!selDept) {
        return res.status(400).json({
          status: 'error',
          message: 'กรุณาเลือกสาขาวิชา / แผนกวิชา',
          data: null
        });
      }
      const [deptCheck] = await pool.query('SELECT name FROM departments WHERE name = ?', [selDept]);
      if (deptCheck.length > 0) {
        finalDepartment = deptCheck[0].name;
        deptStatus = 'APPROVED';
        requestedDepartment = null;
      } else {
        finalDepartment = null;
        deptStatus = 'PENDING';
        requestedDepartment = selDept;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPrefix = prefix || 'นาย';
    const completeName = normalizeFullName(userPrefix, rawName);

    const [result] = await pool.query(`
      INSERT INTO users (
        citizen_id, password, prefix, name, role, role_title,
        department, dept_status, requested_department, dept_reject_reason,
        position, email, phone, employee_id, signature_url
      )
      VALUES (?, ?, ?, ?, 'teacher', 'ผู้รับการประเมิน', ?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId,
      hashedPassword,
      userPrefix,
      completeName,
      finalDepartment,
      deptStatus,
      requestedDepartment,
      position || 'ครูผู้ช่วย',
      email || null,
      phone || null,
      employeeId || null,
      finalSignature
    ]);

    const token = jwt.sign(
      {
        id: result.insertId,
        citizenId: finalCitizenId,
        name: completeName,
        role: 'teacher',
        roleTitle: 'ผู้รับการประเมิน'
      },
      process.env.JWT_SECRET || 'evaluation_system_jwt_secret_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const [createdRows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

    res.status(201).json({
      status: 'success',
      message: deptStatus === 'PENDING'
        ? 'ลงทะเบียนสำเร็จ คำขอเพิ่มสาขาวิชาใหม่ถูกส่งให้ฝ่ายบุคลากร (HR) พิจารณาอนุมัติแล้ว'
        : 'ลงทะเบียนสำเร็จ',
      data: {
        token,
        user: formatUserPayload(createdRows[0])
      }
    });
  } catch (error) {
    next(error);
  }
}

// Retrieve authenticated user profile
async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile retrieved successfully.',
      data: formatUserPayload(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

// Update authenticated user's own profile (including department selection or custom request)
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const [currentRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (currentRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลผู้ใช้งาน', data: null });
    }
    const currentUserRow = currentRows[0];

    const {
      prefix,
      name,
      department,
      customDepartment,
      isCustomDepartment,
      position,
      email,
      phone,
      employeeId,
      signature,
      signatureUrl,
      password
    } = req.body;

    const updates = [];
    const params = [];

    const effectivePrefix = prefix !== undefined ? prefix : currentUserRow.prefix;
    if (prefix !== undefined) {
      updates.push('prefix = ?');
      params.push(prefix);
    }
    if (name !== undefined && String(name).trim() !== '') {
      updates.push('name = ?');
      params.push(normalizeFullName(effectivePrefix, name));
    }

    // Handle department / customDepartment changes
    const wantsCustom = Boolean(isCustomDepartment) || department === '__CUSTOM__' || (customDepartment && String(customDepartment).trim() !== '');
    if (wantsCustom) {
      const reqName = String(customDepartment || '').trim();
      if (!reqName) {
        return res.status(400).json({
          status: 'error',
          message: 'กรุณาระบุชื่อสาขาวิชาที่ต้องการขอเพิ่ม',
          data: null
        });
      }
      const [deptCheck] = await pool.query('SELECT name FROM departments WHERE name = ?', [reqName]);
      if (deptCheck.length > 0) {
        updates.push('department = ?, dept_status = ?, requested_department = NULL, dept_reject_reason = NULL');
        params.push(deptCheck[0].name, 'APPROVED');
      } else if (currentUserRow.role === 'admin' || currentUserRow.role === 'hr') {
        await pool.query('INSERT IGNORE INTO departments (name) VALUES (?)', [reqName]);
        updates.push('department = ?, dept_status = ?, requested_department = NULL, dept_reject_reason = NULL');
        params.push(reqName, 'APPROVED');
      } else {
        updates.push('department = NULL, dept_status = ?, requested_department = ?, dept_reject_reason = NULL');
        params.push('PENDING', reqName);
      }
    } else if (department !== undefined && department !== null && String(department).trim() !== '') {
      const selDept = String(department).trim();
      if (currentUserRow.role === 'teacher') {
        const [deptCheck] = await pool.query('SELECT name FROM departments WHERE name = ?', [selDept]);
        if (deptCheck.length > 0) {
          updates.push('department = ?, dept_status = ?, requested_department = NULL, dept_reject_reason = NULL');
          params.push(deptCheck[0].name, 'APPROVED');
        } else {
          updates.push('department = NULL, dept_status = ?, requested_department = ?, dept_reject_reason = NULL');
          params.push('PENDING', selDept);
        }
      } else {
        updates.push('department = ?, dept_status = ?, requested_department = NULL, dept_reject_reason = NULL');
        params.push(selDept, 'APPROVED');
      }
    }

    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (employeeId !== undefined) { updates.push('employee_id = ?'); params.push(employeeId); }
    if (signature || signatureUrl) {
      updates.push('signature_url = ?');
      params.push(signature || signatureUrl);
    }
    if (password && String(password).trim() !== '') {
      if (String(password).length < 4) {
        return res.status(400).json({ status: 'error', message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร', data: null });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);

    res.status(200).json({
      status: 'success',
      message: 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว',
      data: formatUserPayload(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicDepartments,
  login,
  register,
  getProfile,
  updateProfile,
  normalizeFullName,
  formatUserPayload
};
