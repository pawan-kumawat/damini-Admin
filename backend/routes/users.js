const router = require('express').Router();
const c = require('../controllers/userController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.patch('/:id/toggle-status', c.toggleStatus);

module.exports = router;
