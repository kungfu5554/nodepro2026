// controllers/user.controller.js
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

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
      SELECT id, citizen_id AS citizenId, prefix, name, role, role_title AS roleTitle, department, position, email, phone, employee_id AS employeeId, signature_url AS signatureUrl, created_at AS createdAt
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'ALL') {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR citizen_id LIKE ? OR email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
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

// Get single user by citizen ID
async function getUserByCitizenId(req, res, next) {
  try {
    const { citizenId } = req.params;

    const [rows] = await pool.query(`
      SELECT id, citizen_id AS citizenId, prefix, name, role, role_title AS roleTitle, department, position, email, phone, employee_id AS employeeId, signature_url AS signatureUrl
      FROM users WHERE citizen_id = ?
    `, [citizenId]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `User with citizen ID ${citizenId} not found.`,
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

// Create new user
async function createUser(req, res, next) {
  try {
    const { citizenId, username, password, prefix, fullname, name, role, department, position, email, phone, employeeId } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const finalName = (fullname || name || '').trim();

    if (!finalCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'Username / Citizen ID is required.',
        data: null
      });
    }

    if (!finalName || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'Full name, password, and role are required fields.',
        data: null
      });
    }

    const validRoles = ['admin', 'hr', 'teacher', 'judge'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid role "${role}". Allowed roles: ${validRoles.join(', ')}`,
        data: null
      });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: `Username / Citizen ID "${finalCitizenId}" is already registered.`,
        data: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPrefix = prefix || 'นาย';
    const roleTitle = getRoleTitle(role);
    const displayName = finalName.startsWith(userPrefix) ? finalName : `${userPrefix} ${finalName}`;

    const [result] = await pool.query(`
      INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, position, email, phone, employee_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId, 
      hashedPassword, 
      userPrefix, 
      displayName, 
      role, 
      roleTitle, 
      department || 'แผนกวิชาเทคโนโลยีสารสนเทศ', 
      position || 'ครู คศ.1',
      email || null,
      phone || null,
      employeeId || null
    ]);

    res.status(201).json({
      status: 'success',
      message: 'User created successfully.',
      data: {
        id: result.insertId,
        citizenId: finalCitizenId,
        name: displayName,
        role,
        roleTitle,
        department: department || 'แผนกวิชาเทคโนโลยีสารสนเทศ',
        position: position || 'ครู คศ.1',
        email: email || null,
        phone: phone || null
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update existing user by citizen ID
async function updateUser(req, res, next) {
  try {
    const { citizenId } = req.params;
    const { fullname, name, prefix, role, department, position, password, email, phone, employeeId, newCitizenId } = req.body;

    const [existing] = await pool.query('SELECT id, password FROM users WHERE citizen_id = ?', [citizenId]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
        data: null
      });
    }

    const targetCitizenId = (newCitizenId && newCitizenId.trim() !== '') ? newCitizenId.trim() : citizenId;

    if (targetCitizenId !== citizenId) {
      const [dup] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [targetCitizenId]);
      if (dup.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: `Username / Citizen ID "${targetCitizenId}" is already taken.`,
          data: null
        });
      }
    }

    const roleTitle = role ? getRoleTitle(role) : undefined;
    let newPasswordHash = existing[0].password;
    if (password && password.trim() !== '') {
      newPasswordHash = await bcrypt.hash(password, 10);
    }

    const finalName = (fullname || name);

    await pool.query(`
      UPDATE users
      SET citizen_id = ?,
          name = COALESCE(?, name),
          prefix = COALESCE(?, prefix),
          role = COALESCE(?, role),
          role_title = COALESCE(?, role_title),
          department = COALESCE(?, department),
          position = COALESCE(?, position),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          employee_id = COALESCE(?, employee_id),
          password = ?
      WHERE citizen_id = ?
    `, [targetCitizenId, finalName || null, prefix || null, role || null, roleTitle || null, department || null, position || null, email || null, phone || null, employeeId || null, newPasswordHash, citizenId]);

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

// Delete user by citizen ID
async function deleteUser(req, res, next) {
  try {
    const { citizenId } = req.params;

    const [result] = await pool.query('DELETE FROM users WHERE citizen_id = ?', [citizenId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully.',
      data: null
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getUserByCitizenId,
  createUser,
  updateUser,
  deleteUser
};
