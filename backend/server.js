const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const staffRoutes = require('./routes/staffRoutes');
const studioRoutes = require('./routes/studioRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const imageRoutes = require('./routes/imageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const communityRoutes = require('./routes/communityRoutes');
const partyRoutes = require('./routes/partyRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

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
app.use('/api/staff', staffRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Photo Studio API is running' });
});

// ─── Socket.IO Real-Time Events ────────────────────────────────
const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // User joins with their userId
    socket.on('userOnline', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
    });

    // Join a group room
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
    });

    // Leave a group room
    socket.on('leaveRoom', (roomId) => {
        socket.leave(roomId);
    });

    // Send message to a group
    socket.on('sendGroupMessage', (data) => {
        io.to(data.communityId).emit('newGroupMessage', data);
    });

    // Send direct message
    socket.on('sendDirectMessage', (data) => {
        const recipientSocketId = onlineUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('newDirectMessage', data);
        }
        // Also send back to sender for confirmation
        socket.emit('newDirectMessage', data);
    });

    // Typing indicator
    socket.on('typing', (data) => {
        if (data.communityId) {
            socket.to(data.communityId).emit('userTyping', data);
        } else if (data.recipientId) {
            const recipientSocketId = onlineUsers.get(data.recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('userTyping', data);
            }
        }
    });

    socket.on('stopTyping', (data) => {
        if (data.communityId) {
            socket.to(data.communityId).emit('userStopTyping', data);
        } else if (data.recipientId) {
            const recipientSocketId = onlineUsers.get(data.recipientId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('userStopTyping', data);
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        for (const [userId, sId] of onlineUsers.entries()) {
            if (sId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        io.emit('onlineUsers', Array.from(onlineUsers.keys()));
        console.log('🔌 User disconnected:', socket.id);
    });
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

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO ready for connections`);
    seedSuperAdmin();
});
