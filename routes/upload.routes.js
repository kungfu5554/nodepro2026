// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');

// File upload endpoint (Criteria 6.3: File Upload PDF / Images)
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
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

module.exports = router;

