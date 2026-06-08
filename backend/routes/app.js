const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const c = require('../controllers/appController');
const userAuth = require('../middleware/userAuth');

const answersDir = path.join(__dirname, '../uploads/answers');
fs.mkdirSync(answersDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, answersDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

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
router.post('/questions/:questionId/submit', upload.single('image'), c.submitAnswer);
router.get('/submissions', c.getSubmissionHistory);
router.get('/progress', c.getProgress);
router.get('/results', c.getResults);
router.get('/resume', c.getResumeLearning);
router.put('/resume', c.updateLastVisited);

module.exports = router;
