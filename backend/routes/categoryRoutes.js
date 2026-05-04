const express = require('express');
const router = express.Router();
const { createCategory, getCategories, updateCategory, deleteCategory } = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.post('/', auth, roleGuard('studioadmin', 'staff'), createCategory);
router.get('/', auth, roleGuard('studioadmin', 'staff'), getCategories);
router.put('/:id', auth, roleGuard('studioadmin', 'staff'), updateCategory);
router.delete('/:id', auth, roleGuard('studioadmin', 'staff'), deleteCategory);

module.exports = router;
