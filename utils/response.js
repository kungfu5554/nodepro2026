const getJwtSecret = () => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET environment variable must be set in production.');
  return process.env.JWT_SECRET || 'evaluation_system_jwt_secret_key_2026';
};
const ok = (res, message, data = null, statusCode = 200, extra = {}) => res.status(statusCode).json({ status: 'success', message, data, ...extra });
const fail = (res, message, statusCode = 400, data = null) => res.status(statusCode).json({ status: 'error', message, data });

module.exports = { getJwtSecret, ok, fail };
