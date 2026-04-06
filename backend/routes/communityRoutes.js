const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const communityController = require('../controllers/communityController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const studioId = req.user.role === 'superadmin' ? 'superadmin' : (req.user.studio._id || req.user.studio);
        const dir = path.join(__dirname, '..', 'uploads', studioId.toString(), 'community');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images are allowed'), false);
    }
});

// All routes require authentication and exclude customers
router.use(auth);
router.use(roleGuard('superadmin', 'studioadmin', 'staff'));

// Groups
router.get('/groups', communityController.getGroups);
router.post('/groups', communityController.createGroup);
router.put('/groups/:id', communityController.updateGroup);
router.delete('/groups/:id', communityController.deleteGroup);
router.post('/groups/:id/join', communityController.joinGroup);
router.post('/groups/:id/leave', communityController.leaveGroup);
router.post('/groups/:id/members', communityController.addMembers);
router.post('/groups/:id/remove-member', communityController.removeMember);
router.get('/groups/:id/messages', communityController.getGroupMessages);

// Messages
router.post('/messages', communityController.sendMessage);

// Direct Messages
router.get('/dm/conversations', communityController.getDirectConversations);
router.get('/dm/:userId', communityController.getDirectMessages);

// Members
router.get('/members', communityController.getStudioMembers);

// Upload Avatar
router.post('/avatar', upload.single('avatar'), communityController.uploadAvatar);

module.exports = router;
