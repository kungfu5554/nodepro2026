// routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = require('../middleware/upload.middleware');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { ok, fail } = require('../utils/response');

function handleUpload(req, res) {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 'ขนาดไฟล์เกินกำหนดสูงสุด 10MB', 413);
      }
      return fail(res, err.message, 400);
    } else if (err) {
      return fail(res, err.message, err.status || 400);
    }

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!uploadedFile) {
      return fail(res, 'ไม่พบไฟล์ที่อัปโหลด หรือประเภทไฟล์ไม่ถูกต้อง', 400);
    }

    return ok(res, 'อัปโหลดไฟล์สำเร็จ', {
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalname,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
      fileUrl: `/uploads/${uploadedFile.filename}`
    });
  });
}

// Support both /api/upload and /api/upload/evidence (only teachers, HR, and admin)
router.post('/', authenticateToken, requireRole('teacher', 'admin', 'hr'), handleUpload);
router.post('/evidence', authenticateToken, requireRole('teacher', 'admin', 'hr'), handleUpload);

module.exports = router;
