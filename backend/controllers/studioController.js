const Studio = require('../models/Studio');
const User = require('../models/User');

// @desc    Create studio
// @route   POST /api/studios
// @access  SuperAdmin
exports.createStudio = async (req, res) => {
    try {
        const { name, address, phone, email, ownerName, ownerEmail, ownerPassword, ownerPhone } = req.body;

        // Create studio owner
        const owner = await User.create({
            name: ownerName,
            email: ownerEmail,
            password: ownerPassword,
            phone: ownerPhone,
            role: 'studioadmin'
        });

        // Create studio
        const studio = await Studio.create({
            name,
            owner: owner._id,
            address,
            phone,
            email
        });

        // Link studio to owner
        owner.studio = studio._id;
        await owner.save();

        res.status(201).json({
            success: true,
            studio: await studio.populate('owner', 'name email phone')
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all studios
// @route   GET /api/studios
// @access  SuperAdmin
exports.getStudios = async (req, res) => {
    try {
        const studios = await Studio.find()
            .populate('owner', 'name email phone')
            .sort('-createdAt');

        res.json({ success: true, count: studios.length, studios });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single studio
// @route   GET /api/studios/:id
// @access  SuperAdmin, StudioAdmin (own)
exports.getStudio = async (req, res) => {
    try {
        const studio = await Studio.findById(req.params.id)
            .populate('owner', 'name email phone');

        if (!studio) {
            return res.status(404).json({ message: 'Studio not found' });
        }

        // StudioAdmins can only view their own studio
        if (req.user.role === 'studioadmin' &&
            req.user.studio?._id.toString() !== studio._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ success: true, studio });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update studio
// @route   PUT /api/studios/:id
// @access  SuperAdmin, StudioAdmin (own)
exports.updateStudio = async (req, res) => {
    try {
        const { name, address, phone, email, isActive, gstin, pan, bankDetails } = req.body;

        const studio = await Studio.findById(req.params.id);
        if (!studio) {
            return res.status(404).json({ message: 'Studio not found' });
        }

        if (req.user.role === 'studioadmin' &&
            req.user.studio?._id.toString() !== studio._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (name) studio.name = name;
        if (address) studio.address = address;
        if (phone) studio.phone = phone;
        if (email) studio.email = email;
        if (gstin) studio.gstin = gstin;
        if (pan) studio.pan = pan;
        if (bankDetails) studio.bankDetails = bankDetails;
        if (typeof isActive === 'boolean') studio.isActive = isActive;

        if (req.file) {
            studio.logo = `/uploads/${studio._id}/logo/${req.file.filename}`;
        }

        await studio.save();

        res.json({ success: true, studio: await studio.populate('owner', 'name email phone') });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete studio
// @route   DELETE /api/studios/:id
// @access  SuperAdmin
exports.deleteStudio = async (req, res) => {
    try {
        const studio = await Studio.findById(req.params.id);
        if (!studio) {
            return res.status(404).json({ message: 'Studio not found' });
        }

        await Studio.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Studio deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
