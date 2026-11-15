const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[Error]', err.stack || err.message);
  res.status(err.status || 500).json({ status: 'error', message: err.message || 'Internal server error occurred.', data: null });
};

const notFoundHandler = (req, res) =>
  res.status(404).json({ status: 'error', message: `Resource not found: ${req.method} ${req.originalUrl}`, data: null });

module.exports = { errorHandler, notFoundHandler };
