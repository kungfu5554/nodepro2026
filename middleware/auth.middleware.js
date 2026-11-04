// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

// Verify JWT Bearer token from authorization header
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract Bearer <token>

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Access token required. Please login first.',
      data: null
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'evaluation_system_jwt_secret_key_2026', (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid or expired token.',
        data: null
      });
    }

    req.user = decodedUser;
    next();
  });
}

// Role-based access control middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied: insufficient permissions for this operation.',
        data: null
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};

