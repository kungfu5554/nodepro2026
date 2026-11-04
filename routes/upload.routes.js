// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = require('../middleware/upload.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');

// File upload endpoint (Criteria 6.3: File Upload PDF / Images)
router.post('/', authenticateToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'error',
          message: 'File size exceeds maximum allowed limit of 10MB.',
          data: null
        });
      }
      return res.status(400).json({ status: 'error', message: err.message, data: null });
    } else if (err) {
      return res.status(err.status || 400).json({ status: 'error', message: err.message, data: null });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded or file rejected.',
        data: null
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      status: 'success',
      message: 'File uploaded successfully.',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fileUrl
      }
    });
  });
});

module.exports = router;
