const Order = require('../models/Order');
const User = require('../models/User');
const Image = require('../models/Image');

// @desc    Track order by OrderID (public)
// @route   GET /api/customer/track/:orderId
// @access  Public
exports.trackOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId })
            .populate('categories', 'name slaHours')
            .populate('studio', 'name')
            .select('orderId status statusHistory categories studio estimatedCompletion createdAt');

        if (!order) {
            return res.status(404).json({ message: 'Order not found. Please check the Order ID.' });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get album/images for an order (public shareable link)
// @route   GET /api/customer/album/:orderId
// @access  Public
exports.getOrderAlbum = async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId })
            .populate('categories', 'name')
            .populate('studio', 'name')
            .populate('customer', 'name')
            .populate('images');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({
            success: true,
            album: {
                orderId: order.orderId,
                studioName: order.studio?.name,
                customerName: order.customer?.name,
                categoryNames: order.categories?.map(c => c.name).join(', '),
                status: order.status,
                images: order.images || [],
                createdAt: order.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my orders (customer)
// @route   GET /api/customer/orders
// @access  Customer
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.user._id })
            .populate('categories', 'name slaHours')
            .populate('studio', 'name')
            .populate('images')
            .sort('-createdAt')
            .lean();

        // Calculate wasOverdue for delivered orders
        const processedOrders = orders.map(order => {
            let wasOverdue = false;
            if (order.status === 'delivered' && order.estimatedCompletion) {
                const completedHistory = order.statusHistory?.find(h => h.status === 'delivered');
                if (completedHistory && completedHistory.changedAt) {
                    wasOverdue = new Date(completedHistory.changedAt) > new Date(order.estimatedCompletion);
                } else {
                    wasOverdue = new Date(order.updatedAt) > new Date(order.estimatedCompletion);
                }
            }
            return { ...order, wasOverdue };
        });

        res.json({ success: true, count: processedOrders.length, orders: processedOrders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get customers (studio-scoped)
// @route   GET /api/customer/list
// @access  StudioAdmin
exports.getCustomers = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const customers = await User.find({ studio: studioId, role: 'customer' })
            .select('name email phone createdAt')
            .sort('-createdAt');

        res.json({ success: true, count: customers.length, customers });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Create a new customer (studio-scoped)
// @route   POST /api/customer/create
// @access  StudioAdmin
exports.createCustomer = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const studioId = req.user.studio?._id;

        // Check if email already exists globally
        if (email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ message: 'A user with this email already exists' });
            }
        }

        // Create new user linked to this studio
        const user = await User.create({
            name,
            email,
            phone,
            password: password || 'customer123',
            role: 'customer',
            studio: studioId
        });

        res.status(201).json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                studio: user.studio
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

