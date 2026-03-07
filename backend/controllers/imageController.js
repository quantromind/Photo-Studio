const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image');
const Order = require('../models/Order');

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const studioId = req.user.studio?._id?.toString() || 'unknown';
        const orderId = req.params.orderId;
        const dir = path.join(__dirname, '..', 'uploads', studioId, orderId);

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|tiff|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

exports.uploadMiddleware = upload.array('images', 20);

// @desc    Upload images to an order
// @route   POST /api/images/upload/:orderId
// @access  StudioAdmin
exports.uploadImages = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const images = [];
        for (const file of req.files) {
            const image = await Image.create({
                url: `/uploads/${req.user.studio._id}/${req.params.orderId}/${file.filename}`,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                order: order._id,
                studio: req.user.studio._id,
                uploadedBy: req.user._id
            });
            images.push(image);
            order.images.push(image._id);
        }

        await order.save();

        res.status(201).json({
            success: true,
            count: images.length,
            images
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get images for an order
// @route   GET /api/images/order/:orderId
// @access  StudioAdmin, Customer (own order)
exports.getOrderImages = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const images = await Image.find({ order: req.params.orderId })
            .populate('uploadedBy', 'name')
            .sort('-createdAt');

        res.json({ success: true, count: images.length, images });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete image
// @route   DELETE /api/images/:id
// @access  StudioAdmin
exports.deleteImage = async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        if (image.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Delete file from disk
        const filePath = path.join(__dirname, '..', image.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from order
        await Order.findByIdAndUpdate(image.order, {
            $pull: { images: image._id }
        });

        await Image.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
