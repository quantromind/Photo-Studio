const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    Get all staff for a studio
// @route   GET /api/staff
// @access  StudioAdmin
exports.getStaff = async (req, res) => {
    try {
        const staff = await User.find({
            studio: req.user.studio._id,
            role: 'staff'
        }).select('-password').sort('-createdAt');
        res.json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a staff member
// @route   POST /api/staff
// @access  StudioAdmin
exports.createStaff = async (req, res) => {
    try {
        const { name, email, password, phone, assignedSteps, permissions } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        const staff = await User.create({
            name,
            email,
            password,
            phone,
            role: 'staff',
            studio: req.user.studio._id,
            assignedSteps: assignedSteps || [],
            permissions: permissions || ['orders']
        });

        const staffData = staff.toObject();
        delete staffData.password;

        res.status(201).json({ success: true, staff: staffData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  StudioAdmin
exports.updateStaff = async (req, res) => {
    try {
        const { name, phone, assignedSteps, permissions, password, isActive } = req.body;
        
        let staff = await User.findOne({ _id: req.params.id, studio: req.user.studio._id, role: 'staff' });
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (name) staff.name = name;
        if (phone !== undefined) staff.phone = phone;
        if (assignedSteps) staff.assignedSteps = assignedSteps;
        if (permissions) staff.permissions = permissions;
        if (isActive !== undefined) staff.isActive = isActive;

        if (password) {
            // Because we have pre-save hook for password in User model
            staff.password = password;
        }

        await staff.save();

        const staffData = staff.toObject();
        delete staffData.password;

        res.json({ success: true, staff: staffData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  StudioAdmin
exports.deleteStaff = async (req, res) => {
    try {
        const staff = await User.findOneAndDelete({ _id: req.params.id, studio: req.user.studio._id, role: 'staff' });
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }
        res.json({ success: true, message: 'Staff member removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
