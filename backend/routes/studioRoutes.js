const express = require('express');
const router = express.Router();
const { createStudio, getStudios, getStudio, updateStudio, deleteStudio } = require('../controllers/studioController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.post('/', auth, roleGuard('superadmin'), createStudio);
router.get('/', auth, roleGuard('superadmin'), getStudios);
router.get('/:id', auth, roleGuard('superadmin', 'studioadmin'), getStudio);

// Import multer for logo upload
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const studioId = req.params.id;
        const dir = path.join(__dirname, '..', 'uploads', studioId, 'logo');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'logo-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadLogo = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (/jpeg|jpg|png|webp/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only images allowed'), false);
    }
});

router.put('/:id', auth, roleGuard('superadmin', 'studioadmin'), uploadLogo.single('logo'), updateStudio);
router.delete('/:id', auth, roleGuard('superadmin'), deleteStudio);

module.exports = router;
