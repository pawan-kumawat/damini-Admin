const router = require('express').Router();
const c = require('../controllers/evaluationController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);
router.get('/submissions', c.getSubmissions);
router.get('/submissions/:id', c.getSubmission);
router.post('/submissions/:id/evaluate', c.evaluateSubmission);

module.exports = router;
