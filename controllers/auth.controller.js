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
    const isPlainMatch = password === user.password; // Backward fallback

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
      signatureUrl 
    } = req.body;

    const finalCitizenId = (citizenId || username || '').trim();
    const finalName = (fullname || name || '').trim();

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
      INSERT INTO users (citizen_id, password, plain_password, prefix, name, role, role_title, department, position, email, phone, employee_id, signature_url)
      VALUES (?, ?, ?, ?, ?, 'teacher', 'ผู้รับการประเมิน', ?, ?, ?, ?, ?, ?)
    `, [
      finalCitizenId, 
      hashedPassword, 
      password,
      userPrefix, 
      completeName, 
      department || 'แผนกวิชาเทคโนโลยีสารสนเทศ', 
      position || 'ครูผู้ช่วย',
      email || null,
      phone || null,
      employeeId || null,
      signatureUrl || null
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
          signatureUrl: signatureUrl || null
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

module.exports = {
  login,
  register,
  getProfile
};

