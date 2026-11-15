const jwt = require('jsonwebtoken');
const { getJwtSecret, fail } = require('../utils/response');

const extractCookieToken = (c) => {
  const m = (c || '').match(/(?:^|;\s*)auth_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const authenticateToken = (req, res, next) => {
  const token = (req.headers.authorization || '').split(' ')[1] || extractCookieToken(req.headers.cookie);
  if (!token) return fail(res, 'Access token required. Please login first.', 401);
  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) return fail(res, 'Invalid or expired token.', 403);
    req.user = user;
    next();
  });
};

const requireRole = (...roles) => (req, res, next) =>
  !req.user || !roles.includes(req.user.role)
    ? fail(res, 'Access denied: insufficient permissions for this operation.', 403)
    : next();

module.exports = { authenticateToken, requireRole };
