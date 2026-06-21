const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const c = require('../controllers/appController');
const userAuth = require('../middleware/userAuth');

const answersDir = path.join(__dirname, '../uploads/answers');
fs.mkdirSync(answersDir, { recursive: true });

function requestBaseUrl(req) {
  const configured = process.env.APP_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function withAbsoluteUploadUrls(value, req) {
  if (Array.isArray(value)) return value.map(item => withAbsoluteUploadUrls(item, req));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.startsWith('/uploads/')) return `${requestBaseUrl(req)}${value}`;
    return value;
  }
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value) || typeof value.toHexString === 'function') return value;
  const object = value.toObject ? value.toObject() : value;
  if (object.constructor && object.constructor !== Object) return object;
  const normalized = {};
  Object.entries(object).forEach(([key, item]) => {
    normalized[key] = withAbsoluteUploadUrls(item, req);
  });
  return normalized;
}

router.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => json(withAbsoluteUploadUrls(body, req));
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, answersDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']);
const answerImageFields = new Set(['image', 'file', 'answerImage', 'answer_image', 'upload']);

function isImageBySignature(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return false;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    if (buffer.slice(0, 3).toString() === 'GIF') return true;
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return true;
    if (buffer.slice(4, 12).toString().startsWith('ftyphei')) return true;
    return false;
  } catch (err) {
    return false;
  }
}

function cleanupFiles(files = []) {
  files.forEach(file => {
    if (file?.path) fs.unlink(file.path, () => {});
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const looseMobileUpload = !file.mimetype || file.mimetype === 'application/octet-stream';
    const looksLikeImage = file.mimetype?.startsWith('image/') || imageExtensions.has(ext) || looseMobileUpload;
    if (!looksLikeImage) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

const handleUpload = (req, res, next) => {
  upload.any()(req, res, err => {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    if (err) return res.status(statusCode).json({ status: false, message: err.message, data: null });

    const files = req.files || [];
    const file = files.find(item => answerImageFields.has(item.fieldname)) || files[0];
    if (!file) return next();

    const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
    const validImage = file.mimetype?.startsWith('image/') || imageExtensions.has(ext) || isImageBySignature(file.path);
    if (!validImage) {
      cleanupFiles(files);
      return res.status(400).json({ status: false, message: 'Only image uploads are allowed', data: null });
    }

    req.file = file;
    req.files = files;
    return next();
  });
};

router.post('/auth/send-otp', c.sendOtp);
router.post('/auth/verify-otp', c.verifyOtp);

router.use(userAuth);
router.get('/me', c.getMe);
router.put('/me', c.updateMe);
router.put('/select-board-class', c.selectBoardClass);
router.get('/dashboard', c.getDashboard);
router.get('/languages', c.getLanguages);
router.get('/boards', c.getBoards);
router.get('/classes', c.getClasses);
router.get('/subjects', c.getSubjects);
router.get('/chapters', c.getChapters);
router.get('/topics', c.getTopics);
router.get('/subjects/:subjectId/topics', c.getSubjectTopics);
router.get('/topics/:topicId', c.getTopicDetail);
router.get('/questions', c.getQuestions);
router.get('/subscriptions', c.getSubscriptions);
router.post('/purchases', c.purchaseSubscription);
router.get('/purchases', c.getMyPurchases);
router.post('/questions/:questionId/submit', handleUpload, c.submitAnswer);
router.get('/submissions', c.getSubmissionHistory);
router.get('/progress', c.getProgress);
router.get('/results', c.getResults);
router.get('/resume', c.getResumeLearning);
router.put('/resume', c.updateLastVisited);

module.exports = router;
