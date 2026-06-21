const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const c = require('../controllers/topicController');
const adminAuth = require('../middleware/adminAuth');

const topicsDir = path.join(__dirname, '../uploads/topics');
fs.mkdirSync(topicsDir, { recursive: true });

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, topicsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const looksLikeImage = file.mimetype?.startsWith('image/') || imageExtensions.has(ext);
    if (!looksLikeImage) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

const handleTopicImage = (req, res, next) => {
  upload.single('image')(req, res, err => {
    if (!err) return next();
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({ status: false, message: err.message, data: null });
  });
};

router.use(adminAuth);
router.get('/', c.getAll);
router.post('/', handleTopicImage, c.create);
router.put('/:id', handleTopicImage, c.update);
router.delete('/:id', c.remove);

module.exports = router;
