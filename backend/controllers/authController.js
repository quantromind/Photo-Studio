const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Studio = require('../models/Studio');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role, studioName } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Allow studioadmin creation via registration
        const userRole = role === 'studioadmin' ? 'studioadmin' : 'customer';

        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: userRole
        });

        // Initialize corresponding Studio for studioadmin
        if (userRole === 'studioadmin') {
            try {
                const studio = await Studio.create({
                    name: studioName || `${name}'s Studio`,
                    owner: user._id,
                    email: email,
                    phone: phone
                });
                user.studio = studio._id;
                await user.save();
            } catch (err) {
                // Rollback user creation if studio creation fails
                await User.findByIdAndDelete(user._id);
                return res.status(400).json({ message: 'Failed to create studio: ' + err.message });
            }
        }

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password').populate('studio');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.isActive) {
            return res.status(401).json({ message: 'Account is deactivated' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Block login if the user's studio is deactivated
        if (user.studio && !user.studio.isActive) {
            return res.status(403).json({ message: 'Your studio has been deactivated. Contact super admin.' });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                studio: user.studio,
                assignedSteps: user.assignedSteps,
                permissions: user.permissions
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('studio');
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                studio: user.studio,
                assignedSteps: user.assignedSteps,
                permissions: user.permissions
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
