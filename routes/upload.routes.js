// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = require('../middleware/upload.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');

function handleUpload(req, res) {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          status: 'error',
          message: 'ขนาดไฟล์เกินกำหนดสูงสุด 10MB',
          data: null
        });
      }
      return res.status(400).json({ status: 'error', message: err.message, data: null });
    } else if (err) {
      return res.status(err.status || 400).json({ status: 'error', message: err.message, data: null });
    }

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!uploadedFile) {
      return res.status(400).json({
        status: 'error',
        message: 'ไม่พบไฟล์ที่อัปโหลด หรือประเภทไฟล์ไม่ถูกต้อง',
        data: null
      });
    }

    const fileUrl = `/uploads/${uploadedFile.filename}`;

    res.status(200).json({
      status: 'success',
      message: 'อัปโหลดไฟล์สำเร็จ',
      data: {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
        fileUrl
      }
    });
  });
}

// Support both /api/upload and /api/upload/evidence
router.post('/', authenticateToken, handleUpload);
router.post('/evidence', authenticateToken, handleUpload);

module.exports = router;
