const express = require('express');
const router = express.Router();
const { createCategory, getCategories, updateCategory, deleteCategory } = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.post('/', auth, roleGuard('studioadmin'), createCategory);
router.get('/', auth, roleGuard('studioadmin'), getCategories);
router.put('/:id', auth, roleGuard('studioadmin'), updateCategory);
router.delete('/:id', auth, roleGuard('studioadmin'), deleteCategory);

module.exports = router;
