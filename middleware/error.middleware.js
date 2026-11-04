// middleware/error.middleware.js

// Centralized error handling middleware
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error('[Error]', err.stack || err.message);

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal server error occurred.',
    data: null
  });
}

// 404 Route Not Found middleware
function notFoundHandler(req, res, next) {
  res.status(404).json({
    status: 'error',
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    data: null
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
