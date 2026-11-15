// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { getJwtSecret, fail } = require('../utils/response');

function extractCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === 'auth_token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

// Verify JWT Bearer token from Authorization header or HttpOnly auth_token cookie
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const token = headerToken || extractCookieToken(req.headers.cookie);

  if (!token) {
    return fail(res, 'Access token required. Please login first.', 401);
  }

  jwt.verify(token, getJwtSecret(), (err, decodedUser) => {
    if (err) {
      return fail(res, 'Invalid or expired token.', 403);
    }
    req.user = decodedUser;
    next();
  });
}

// Role-based access control middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return fail(res, 'Access denied: insufficient permissions for this operation.', 403);
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};
