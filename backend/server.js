const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const studioRoutes = require('./routes/studioRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const imageRoutes = require('./routes/imageRoutes');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Photo Studio API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Seed super admin on first run
const User = require('./models/User');
const seedSuperAdmin = async () => {
    try {
        const existingAdmin = await User.findOne({ role: 'superadmin' });
        if (!existingAdmin) {
            await User.create({
                name: 'Super Admin',
                email: 'admin@photostudio.com',
                password: 'admin123',
                role: 'superadmin',
                phone: '0000000000'
            });
            console.log('🔑 Super Admin created: admin@photostudio.com / admin123');
        }
    } catch (error) {
        console.error('Error seeding super admin:', error.message);
    }
};

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    seedSuperAdmin();
});
