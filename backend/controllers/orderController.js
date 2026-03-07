const Order = require('../models/Order');
const Category = require('../models/Category');
const User = require('../models/User');
const generateOrderId = require('../utils/generateOrderId');
const { notifyOrderStatusChange } = require('../utils/notificationService');

// In-memory lock to prevent duplicate order creation
const processingOrders = new Set();

// @desc    Create order
// @route   POST /api/orders
// @access  StudioAdmin
exports.createOrder = async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, categoryIds, notes, totalAmount } = req.body;
        const studioId = req.user.studio?._id;

        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated with this account' });
        }

        if (!customerEmail || !customerName || !categoryIds || categoryIds.length === 0) {
            return res.status(400).json({ message: 'Customer name, email and at least one category are required' });
        }

        // Prevent duplicate submissions — lock by email+categories combo
        const sortedIds = [...categoryIds].sort().join(',');
        const lockKey = `${customerEmail}-${sortedIds}-${studioId}`;
        if (processingOrders.has(lockKey)) {
            return res.status(409).json({ message: 'Order is already being processed. Please wait.' });
        }
        processingOrders.add(lockKey);

        try {
            // Find or create customer (atomic upsert to prevent duplicates)
            let customer = await User.findOneAndUpdate(
                { email: customerEmail.toLowerCase() },
                {
                    $setOnInsert: {
                        name: customerName,
                        email: customerEmail.toLowerCase(),
                        phone: customerPhone,
                        password: customerPhone || 'default123',
                        role: 'customer',
                        studio: studioId
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // If customer was found (not new), password won't be hashed by pre-save
            // That's fine — we only want to create if not exists

            // Get categories for SLA
            const categories = await Category.find({ _id: { $in: categoryIds } });
            if (!categories || categories.length === 0) {
                return res.status(400).json({ message: 'Invalid categories provided' });
            }

            // Generate unique order ID
            const orderId = await generateOrderId();

            // Calculate estimated completion based on max SLA
            const maxSlaHours = categories.reduce((max, cat) => cat.slaHours > max ? cat.slaHours : max, 0);
            const estimatedCompletion = new Date();
            estimatedCompletion.setHours(estimatedCompletion.getHours() + maxSlaHours);

            const order = await Order.create({
                orderId,
                studio: studioId,
                customer: customer._id,
                categories: categoryIds,
                status: 'reception',
                statusHistory: [{
                    status: 'reception',
                    changedBy: req.user._id,
                    changedAt: new Date(),
                    notes: 'Order created'
                }],
                notes,
                totalAmount: totalAmount || 0,
                estimatedCompletion
            });

            const populatedOrder = await Order.findById(order._id)
                .populate('customer', 'name email phone')
                .populate('categories', 'name slaHours')
                .populate('studio', 'name');

            res.status(201).json({ success: true, order: populatedOrder });
        } finally {
            // Always release the lock
            processingOrders.delete(lockKey);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get orders (studio-scoped)
// @route   GET /api/orders
// @access  StudioAdmin
exports.getOrders = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const { status, page = 1, limit = 50 } = req.query;

        const query = { studio: studioId };
        if (status === 'active') {
            query.status = { $ne: 'completed' };
        } else if (status === 'history') {
            query.status = 'completed';
        } else if (status === 'overdue') {
            query.status = { $nin: ['completed', 'delivered'] };
            query.estimatedCompletion = { $lt: new Date() };
        } else if (status === 'deadline') {
            const next24Hours = new Date();
            next24Hours.setHours(next24Hours.getHours() + 24);
            query.status = { $nin: ['completed', 'delivered'] };
            query.estimatedCompletion = { $lte: next24Hours };
        } else if (status) {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('customer', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('studio', 'name address phone email gstin pan bankDetails logo')
            .populate('images')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        // Calculate wasOverdue for completed orders
        const processedOrders = orders.map(order => {
            let wasOverdue = false;
            if (order.status === 'completed' && order.estimatedCompletion) {
                // Find when it was marked completed
                const completedHistory = order.statusHistory?.find(h => h.status === 'completed');
                if (completedHistory && completedHistory.changedAt) {
                    wasOverdue = new Date(completedHistory.changedAt) > new Date(order.estimatedCompletion);
                } else {
                    // Fallback to updated at
                    wasOverdue = new Date(order.updatedAt) > new Date(order.estimatedCompletion);
                }
            }
            return { ...order, wasOverdue };
        });

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            count: processedOrders.length,
            total,
            pages: Math.ceil(total / limit),
            orders: processedOrders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single order with images
// @route   GET /api/orders/:id
// @access  StudioAdmin, Customer (own)
exports.getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('studio', 'name')
            .populate('images')
            .populate('statusHistory.changedBy', 'name');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Access check
        if (req.user.role === 'studioadmin' &&
            order.studio._id.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.user.role === 'customer' &&
            order.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status (advance or set specific status)
// @route   PUT /api/orders/:id/status
// @access  StudioAdmin
exports.updateOrderStatus = async (req, res) => {
    try {
        const { targetStatus } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // If targetStatus is provided, set to that status; otherwise advance to next
        let newStatus;
        if (targetStatus) {
            const validStatuses = Order.ORDER_STATUSES;
            if (!validStatuses.includes(targetStatus)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            newStatus = targetStatus;
        } else {
            newStatus = order.getNextStatus();
            if (!newStatus) {
                return res.status(400).json({ message: 'Order is already completed' });
            }
        }

        order.status = newStatus;
        order.statusHistory.push({
            status: newStatus,
            changedBy: req.user._id,
            changedAt: new Date(),
            notes: req.body.notes || ''
        });

        await order.save();

        // Send notification
        const customer = await User.findById(order.customer);
        if (customer) {
            await notifyOrderStatusChange(order, customer, newStatus);
        }

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('images')
            .populate('statusHistory.changedBy', 'name');

        res.json({ success: true, order: populatedOrder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order billing
// @route   PUT /api/orders/:id/billing
// @access  StudioAdmin
exports.updateBilling = async (req, res) => {
    try {
        const { totalAmount, advancePayment, discount, tax } = req.body;

        let order = await Order.findOne({ _id: req.params.id, studio: req.user.studio._id });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (totalAmount !== undefined) order.totalAmount = totalAmount;
        if (advancePayment !== undefined) order.advancePayment = advancePayment;
        if (discount !== undefined) order.discount = discount;
        if (tax !== undefined) order.tax = tax;

        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('studio', 'name address phone email gstin pan bankDetails logo')
            .populate('images')
            .populate('statusHistory.changedBy', 'name');

        res.json({ success: true, order: populatedOrder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  StudioAdmin
exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Order deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard stats
// @route   GET /api/orders/stats
// @access  StudioAdmin
exports.getOrderStats = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;

        const stats = await Order.aggregate([
            { $match: { studio: studioId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalOrders = await Order.countDocuments({ studio: studioId });

        // Calculate approaching deadline count (active + due within 24h)
        const next24Hours = new Date();
        next24Hours.setHours(next24Hours.getHours() + 24);

        const [deadlineCount, overdueCount, activeCount] = await Promise.all([
            Order.countDocuments({
                studio: studioId,
                status: { $nin: ['completed', 'delivered'] },
                estimatedCompletion: { $lte: next24Hours }
            }),
            Order.countDocuments({
                studio: studioId,
                status: { $nin: ['completed', 'delivered'] },
                estimatedCompletion: { $lt: new Date() }
            }),
            Order.countDocuments({
                studio: studioId,
                status: { $ne: 'completed' }
            })
        ]);

        const statusCounts = {
            reception: 0,
            designing: 0,
            printing: 0,
            binding: 0,
            quality_check: 0,
            delivered: 0,
            completed: 0
        };

        stats.forEach(s => {
            statusCounts[s._id] = s.count;
        });

        res.json({
            success: true,
            totalOrders,
            activeCount,
            deadlineCount,
            overdueCount,
            historyCount: statusCounts.completed,
            statusCounts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard revenue stats
// @route   GET /api/orders/revenue
// @access  StudioAdmin
exports.getRevenueStats = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;

        const result = await Order.aggregate([
            { $match: { studio: studioId } },
            {
                $group: {
                    _id: null,
                    totalBillings: { $sum: { $ifNull: ['$totalAmount', 0] } },
                    totalAdvance: { $sum: { $ifNull: ['$advancePayment', 0] } },
                    totalDiscount: { $sum: { $ifNull: ['$discount', 0] } },
                    // Assuming tax is stored as a percentage, calculation here might be complex. 
                    // Let's bring all orders and calculate carefully if we need exact numbers,
                    // but for a quick aggregate, let's calculate the sum of taxes as well.
                }
            }
        ]);

        // MongoDB aggregation for tax might be annoying if it requires calculating percentage per order.
        // It's safer and easier to fetch the data and reduce it in JS for a small scale app.
        const allOrders = await Order.find({ studio: studioId }, 'totalAmount advancePayment discount tax');

        let totalBillings = 0;
        let totalAdvance = 0;
        let totalDiscount = 0;
        let totalTaxCollected = 0;
        let pendingBalance = 0;

        allOrders.forEach(order => {
            const amount = order.totalAmount || 0;
            const advance = order.advancePayment || 0;
            const discount = order.discount || 0;
            const taxPercentage = order.tax || 0;

            const taxableAmount = Math.max(0, amount - discount);
            const taxAmount = (taxableAmount * taxPercentage) / 100;
            const finalTotal = taxableAmount + taxAmount;

            totalBillings += amount;
            totalAdvance += advance;
            totalDiscount += discount;
            totalTaxCollected += taxAmount;
            pendingBalance += Math.max(0, finalTotal - advance);
        });

        res.json({
            success: true,
            totalBillings: Math.round(totalBillings),
            totalAdvance: Math.round(totalAdvance),
            totalDiscount: Math.round(totalDiscount),
            totalTaxCollected: Math.round(totalTaxCollected),
            pendingBalance: Math.round(pendingBalance)
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all orders with billing details (for Excel export)
// @route   GET /api/orders/revenue-export
// @access  StudioAdmin
exports.getRevenueExport = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;

        const orders = await Order.find({ studio: studioId })
            .populate('customer', 'name email phone')
            .populate('categories', 'name')
            .sort('-createdAt')
            .lean();

        const rows = orders.map(order => {
            const amount = order.totalAmount || 0;
            const advance = order.advancePayment || 0;
            const discount = order.discount || 0;
            const taxPct = order.tax || 0;
            const taxableAmount = Math.max(0, amount - discount);
            const taxAmount = Math.round((taxableAmount * taxPct) / 100);
            const finalTotal = Math.round(taxableAmount + taxAmount);
            const balance = Math.max(0, finalTotal - advance);

            return {
                orderId: order.orderId,
                customerName: order.customer?.name || '',
                customerPhone: order.customer?.phone || '',
                customerEmail: order.customer?.email || '',
                categories: order.categories?.map(c => c?.name).filter(Boolean).join(', ') || '',
                status: order.status,
                grossAmount: amount,
                discount: discount,
                taxPercent: taxPct,
                taxAmount: taxAmount,
                finalInvoice: finalTotal,
                advancePaid: advance,
                balanceDue: balance,
                createdAt: order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : ''
            };
        });

        res.json({ success: true, orders: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

