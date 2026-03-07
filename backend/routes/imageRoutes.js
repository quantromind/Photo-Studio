const express = require('express');
const router = express.Router();
const { uploadMiddleware, uploadImages, getOrderImages, deleteImage } = require('../controllers/imageController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.post('/upload/:orderId', auth, roleGuard('studioadmin'), uploadMiddleware, uploadImages);
router.get('/order/:orderId', auth, roleGuard('studioadmin', 'customer'), getOrderImages);
router.delete('/:id', auth, roleGuard('studioadmin'), deleteImage);

module.exports = router;
