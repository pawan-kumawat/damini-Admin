const router = require('express').Router();
const c = require('../controllers/boardController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
