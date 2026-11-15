const router = require('express').Router();
const multer = require('multer');
const upload = require('../middleware/upload.middleware');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { ok, fail } = require('../utils/response');

const handleUpload = (req, res) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) return fail(res, err.code === 'LIMIT_FILE_SIZE' ? 'ขนาดไฟล์เกินกำหนดสูงสุด 10MB' : err.message, err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    if (err) return fail(res, err.message, err.status || 400);
    const f = req.file || (req.files && req.files[0]);
    if (!f) return fail(res, 'ไม่พบไฟล์ที่อัปโหลด หรือประเภทไฟล์ไม่ถูกต้อง', 400);
    ok(res, 'อัปโหลดไฟล์สำเร็จ', { filename: f.filename, originalName: f.originalname, mimetype: f.mimetype, size: f.size, fileUrl: `/uploads/${f.filename}` });
  });
};

const authUpload = [authenticateToken, requireRole('teacher', 'admin', 'hr'), handleUpload];
router.post('/', ...authUpload);
router.post('/evidence', ...authUpload);

module.exports = router;
