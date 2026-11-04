// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Authenticate user credentials and issue JWT
async function login(req, res, next) {
  try {
    const { citizenId, password } = req.body;

    if (!citizenId || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Citizen ID and password are required.',
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
        message: 'Invalid citizen ID or password.',
        data: null
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
    const isPlainMatch = (password === user.password); // Fallback if plain text seed

    if (!isMatch && !isPlainMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid citizen ID or password.',
        data: null
      });
    }

    // Generate JWT token
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
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          citizenId: user.citizen_id,
          prefix: user.prefix,
          name: user.name,
          role: user.role,
          roleTitle: user.role_title,
          department: user.department,
          position: user.position,
          email: user.email,
          phone: user.phone,
          employeeId: user.employee_id,
          signatureUrl: user.signature_url
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// Register candidate (evaluatee)
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
      position, 
      signature,
      signatureUrl 
    } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const finalName = (fullname || name || '').trim();
    const finalSignature = signature || signatureUrl || null;

    if (!finalCitizenId) {
      return res.status(400).json({
        status: 'error',
        message: 'Citizen ID / Username is required.',
        data: null
      });
    }

    if (!password || !finalName) {
      return res.status(400).json({
        status: 'error',
        message: 'Full name and password are required.',
        data: null
      });
    }

    // Check duplicate citizen ID or username
    const [existing] = await pool.query('SELECT id FROM users WHERE citizen_id = ?', [finalCitizenId]);
    if (existing.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'This Citizen ID / Username is already registered.',
        data: null
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPrefix = prefix || 'นาย';
    const completeName = finalName.startsWith(userPrefix) ? finalName : `${userPrefix} ${finalName}`;

    const [result] = await pool.query(`
      INSERT INTO users (citizen_id, password, prefix, name, role, role_title, department, position, email, phone, employee_id, signature_url)
      VALUES (?, ?, ?, ?, 'teacher', 'ผู้รับการประเมิน', ?, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId, 
      hashedPassword, 
      userPrefix, 
      completeName, 
      department || 'แผนกวิชาเทคโนโลยีสารสนเทศ', 
      position || 'ครูผู้ช่วย',
      email || null,
      phone || null,
      employeeId || null,
      finalSignature
    ]);

    // Issue JWT token on registration so client can login immediately
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

    res.status(201).json({
      status: 'success',
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id: result.insertId,
          citizenId: finalCitizenId,
          prefix: userPrefix,
          name: completeName,
          role: 'teacher',
          roleTitle: 'ผู้รับการประเมิน',
          department: department || 'แผนกวิชาเทคโนโลยีสารสนเทศ',
          position: position || 'ครูผู้ช่วย',
          email: email || null,
          phone: phone || null,
          employeeId: employeeId || null,
          signatureUrl: finalSignature
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// Retrieve authenticated user profile
async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT id, citizen_id AS citizenId, prefix, name, role, role_title AS roleTitle, department, position, email, phone, employee_id AS employeeId, signature_url AS signatureUrl
      FROM users WHERE id = ?
    `, [req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User profile not found.',
        data: null
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile retrieved successfully.',
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
}

// Update authenticated user's own profile
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { prefix, name, department, position, email, phone, employeeId, signature, signatureUrl, password } = req.body;

    const updates = [];
    const params = [];

    if (prefix !== undefined) { updates.push('prefix = ?'); params.push(prefix); }
    if (name !== undefined && name.trim()) { updates.push('name = ?'); params.push(name.trim()); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (employeeId !== undefined) { updates.push('employee_id = ?'); params.push(employeeId); }
    if (signature || signatureUrl) {
      updates.push('signature_url = ?');
      params.push(signature || signatureUrl);
    }
    if (password && password.length >= 4) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.query(`
      SELECT id, citizen_id AS citizenId, prefix, name, role, role_title AS roleTitle, department, position, email, phone, employee_id AS employeeId, signature_url AS signatureUrl
      FROM users WHERE id = ?
    `, [userId]);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  register,
  getProfile,
  updateProfile
};
