const Order = require('../models/Order');
const Category = require('../models/Category');
const User = require('../models/User');
const Party = require('../models/Party');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
// const DealerPrice = require('../models/DealerPrice'); // Removed in favor of Category.partyPrice
const generateOrderId = require('../utils/generateOrderId');
const { notifyOrderStatusChange } = require('../utils/notificationService');

// In-memory lock to prevent duplicate order creation
const processingOrders = new Set();

// @desc    Create order
// @route   POST /api/orders
// @access  StudioAdmin
exports.createOrder = async (req, res) => {
    try {
        if (req.user.role === 'staff' && !req.user.assignedSteps?.includes('reception')) {
            return res.status(403).json({ message: 'Only Reception staff can create new orders' });
        }
        const { customerName, customerEmail, customerPhone, categoryIds, categoryQuantities, categoryPrices, notes, coupleName, totalAmount, isParty: manualIsParty } = req.body;
        const studioId = req.user.studio?._id;

        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated with this account' });
        }

        if (!customerName || !categoryIds || categoryIds.length === 0) {
            return res.status(400).json({ message: 'Customer name and at least one category are required' });
        }

        // Prevent duplicate submissions — lock by phone/email+categories combo
        const sortedIds = [...categoryIds].sort().join(',');
        const userIdentifier = customerEmail || customerPhone;
        const lockKey = `${userIdentifier}-${sortedIds}-${studioId}`;
        if (processingOrders.has(lockKey)) {
            return res.status(409).json({ message: 'Order is already being processed. Please wait.' });
        }
        processingOrders.add(lockKey);

        try {
            // PRIORITY: Always treat customers as Parties
            // 1. Check if a Party already exists with this phone
            let party = await Party.findOne({ phone: customerPhone, studio: studioId });
            let customer = null;
            let isParty = true;

            if (party) {
                // Update party name/email if changed
                let isModified = false;
                if (party.name !== customerName) {
                    party.name = customerName;
                    isModified = true;
                }
                if (customerEmail && !party.email) {
                    party.email = customerEmail.toLowerCase();
                    isModified = true;
                }
                if (isModified) await party.save();
            } else {
                // 2. Check if an existing User/customer exists (backward compat)
                customer = await User.findOne({ phone: customerPhone, studio: studioId });
                
                if (customer) {
                    // Existing customer-based user — use as customer
                    isParty = false;
                    let isModified = false;
                    if (customer.name !== customerName) {
                        customer.name = customerName;
                        isModified = true;
                    }
                    if (customerEmail && !customer.email) {
                        const existingEmail = await User.findOne({ email: customerEmail.toLowerCase() });
                        if (!existingEmail) {
                            customer.email = customerEmail.toLowerCase();
                            isModified = true;
                        }
                    }
                    if (isModified) await customer.save();
                } else {
                    // 3. NEW customer → Create as Party
                    party = await Party.create({
                        name: customerName,
                        phone: customerPhone,
                        email: customerEmail ? customerEmail.toLowerCase() : undefined,
                        password: customerPhone || 'default123',
                        studio: studioId
                    });
                    isParty = true;
                }
            }

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

            // Calculate total amount if not provided
            let calculatedTotal = totalAmount;

            // Build quantities map (default qty = 1)
            const quantitiesMap = {};
            if (categoryQuantities && typeof categoryQuantities === 'object') {
                Object.keys(categoryQuantities).forEach(key => {
                    quantitiesMap[key] = parseInt(categoryQuantities[key]) || 1;
                });
            }

            // Build prices map
            const pricesMap = {};
            if (categoryPrices && typeof categoryPrices === 'object') {
                Object.keys(categoryPrices).forEach(key => {
                    pricesMap[key] = parseFloat(categoryPrices[key]);
                });
            }
            
            if (calculatedTotal === undefined || calculatedTotal === null || calculatedTotal === '') {
                calculatedTotal = 0;
                for (const cat of categories) {
                    const qty = quantitiesMap[cat._id.toString()] || 1;
                    if (isParty && party) {
                        // Priority 1: Custom Party Price
                        const customPriceObj = party?.partyPrices?.find(p => p.category.toString() === cat._id.toString());
                        const customPrice = customPriceObj ? customPriceObj.price : 0;
                        
                        if (customPrice > 0) {
                            calculatedTotal += customPrice * qty;
                        } else if (cat.partyPrice > 0) {
                            // Priority 2: Standard Category Party Price
                            calculatedTotal += cat.partyPrice * qty;
                        } else {
                            // Fallback: Base Price
                            calculatedTotal += (cat.basePrice || 0) * qty;
                        }
                    } else {
                        calculatedTotal += (cat.basePrice || 0) * qty;
                    }
                }
            }

            const order = await Order.create({
                orderId,
                studio: studioId,
                customer: customer?._id || null,
                party: party?._id || null,
                categories: categoryIds,
                categoryQuantities: quantitiesMap,
                categoryPrices: pricesMap,
                status: 'reception',
                statusHistory: [{
                    status: 'reception',
                    changedBy: req.user._id,
                    changedAt: new Date(),
                    notes: 'Order created'
                }],
                notes,
                coupleName,
                totalAmount: calculatedTotal,
                estimatedCompletion,
                isParty: !!isParty
            });

            const populatedOrder = await Order.findById(order._id)
                .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
                .populate('categories', 'name slaHours basePrice partyPrice hsnCode')
                .populate('studio', 'name address phone logo gstin pan bankDetails paymentQR printMode jobsheetFooter');

            // Send notification to Admin & Reception
            await Notification.create({
                studio: studioId,
                title: 'New Order Created',
                message: `Order ${orderId} has been created`,
                order: order._id,
                orderId: orderId,
                targetRoles: ['studioadmin', 'reception']
            });

            res.status(201).json({ success: true, order: populatedOrder });
        } finally {
            // Always release the lock
            processingOrders.delete(lockKey);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Update order
// @route   PUT /api/orders/:id
// @access  StudioAdmin
exports.updateOrder = async (req, res) => {
    try {
        if (req.user.role === 'staff' && !req.user.assignedSteps?.includes('reception')) {
            return res.status(403).json({ message: 'Only Reception staff can edit orders' });
        }
        const { customerName, customerEmail, customerPhone, categoryIds, categoryQuantities, categoryPrices, notes, coupleName, totalAmount, advancePayment, discount, isParty: manualIsParty } = req.body;
        const studioId = req.user.studio?._id;

        const order = await Order.findOne({ _id: req.params.id, studio: studioId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Do not allow editing delivered or cancelled orders
        if (['delivered', 'cancelled'].includes(order.status)) {
            return res.status(400).json({ message: `Cannot edit order in ${order.status} status` });
        }

        // Update fields
        if (customerName) {
            if (order.customer) {
                await User.findByIdAndUpdate(order.customer, { name: customerName, email: customerEmail, phone: customerPhone });
            } else if (order.party) {
                await Party.findByIdAndUpdate(order.party, { name: customerName, email: customerEmail, phone: customerPhone });
            }
        }

        if (categoryIds) {
            order.categories = categoryIds;
            // Recalculate SLA
            const categories = await Category.find({ _id: { $in: categoryIds } });
            const maxSlaHours = categories.reduce((max, cat) => cat.slaHours > max ? cat.slaHours : max, 0);
            const estimatedCompletion = new Date(order.createdAt);
            estimatedCompletion.setHours(estimatedCompletion.getHours() + maxSlaHours);
            order.estimatedCompletion = estimatedCompletion;
        }

        if (categoryQuantities) order.categoryQuantities = categoryQuantities;
        if (categoryPrices) order.categoryPrices = categoryPrices;
        if (notes !== undefined) order.notes = notes;
        if (coupleName !== undefined) order.coupleName = coupleName;
        if (totalAmount !== undefined) order.totalAmount = totalAmount;
        if (advancePayment !== undefined) order.advancePayment = advancePayment;
        if (discount !== undefined) order.discount = discount;
        if (manualIsParty !== undefined) order.isParty = manualIsParty;

        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours basePrice partyPrice hsnCode')
            .populate('studio', 'name address phone logo gstin pan bankDetails paymentQR printMode jobsheetFooter');

        res.json({ success: true, order: populatedOrder });
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
            query.status = { $nin: ['delivered', 'cancelled'] };
        } else if (status === 'history') {
            query.status = 'delivered';
        } else if (status === 'cancelled') {
            query.status = 'cancelled';
        } else if (status === 'overdue') {
            query.status = { $nin: ['delivered', 'cancelled'] };
            query.estimatedCompletion = { $lt: new Date() };
        } else if (status === 'deadline') {
            const next24Hours = new Date();
            next24Hours.setHours(next24Hours.getHours() + 24);
            query.status = { $nin: ['delivered', 'cancelled'] };
            query.estimatedCompletion = { $lte: next24Hours };
        } else if (status) {
            query.status = status;
        }

        // Filter by customer/party/phone
        if (req.query.phone) {
            // Normalize phone: strip +91/91 prefix
            let rawPhone = req.query.phone;
            let normPhone = rawPhone.replace(/[\s\-()]/g, '');
            if (normPhone.startsWith('+91')) normPhone = normPhone.slice(3);
            else if (normPhone.startsWith('91') && normPhone.length > 10) normPhone = normPhone.slice(2);
            
            const phonesToTry = [rawPhone];
            if (normPhone !== rawPhone) phonesToTry.push(normPhone);
            // Also try with +91 prefix if input was 10 digits
            if (normPhone.length === 10 && !phonesToTry.includes('+91' + normPhone)) {
                phonesToTry.push('+91' + normPhone);
            }
            
            const [users, parties] = await Promise.all([
                User.find({ phone: { $in: phonesToTry }, studio: studioId }),
                Party.find({ phone: { $in: phonesToTry }, studio: studioId })
            ]);
            const orConditions = [];
            users.forEach(u => orConditions.push({ customer: u._id }));
            parties.forEach(p => orConditions.push({ party: p._id }));
            
            if (orConditions.length > 0) {
                query.$or = orConditions;
            } else {
                // If phone provided but no user/party found, return empty
                return res.json({ success: true, count: 0, total: 0, orders: [] });
            }
        } else {
            if (req.query.customer) {
                query.customer = req.query.customer;
            }
            if (req.query.party) {
                query.party = req.query.party;
            }
        }

        if (req.user.role === 'staff' && !req.user.assignedSteps?.includes('reception')) {
            const steps = req.user.assignedSteps || [];
            if (query.status && typeof query.status === 'object') {
                query.status.$in = steps;
            } else if (query.status && typeof query.status === 'string') {
                if (!steps.includes(query.status)) {
                    return res.json({ success: true, count: 0, total: 0, pages: 0, orders: [] });
                }
            } else {
                query.status = { $in: steps };
            }
        }

        const orders = await Order.find(query)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours basePrice partyPrice hsnCode')
            .populate('studio', 'name address phone email gstin pan bankDetails logo paymentQR printMode jobsheetFooter')
            .populate('images')
            .populate('billImages')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
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
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('studio', 'name address phone logo gstin pan bankDetails paymentQR printMode jobsheetFooter')
            .populate('images')
            .populate('billImages')
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

        if (req.user.role === 'staff' && !req.user.assignedSteps?.includes('reception')) {
            const steps = req.user.assignedSteps || [];
            if (!steps.includes(order.status)) {
                return res.status(403).json({ message: 'You can only advance orders currently in your assigned steps' });
            }
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
                return res.status(400).json({ message: 'Order is already delivered' });
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

        // Create internal notification
        await Notification.create({
            studio: order.studio,
            title: 'Order Status Changed',
            message: `Order ${order.orderId} was moved to ${newStatus}`,
            order: order._id,
            orderId: order.orderId,
            targetRoles: ['studioadmin', 'reception', newStatus] // e.g. notifies 'designing' if it moved there
        });

        // Send public notification (SMS/Email)
        let customer = order.isParty ? await Party.findById(order.party) : await User.findById(order.customer);
        if (customer) {
            await notifyOrderStatusChange(order, customer, newStatus);
        }

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('images')
            .populate('billImages')
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
        const { totalAmount, advancePayment, discount, tax, taxType } = req.body;

        let order = await Order.findOne({ _id: req.params.id, studio: req.user.studio._id });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (totalAmount !== undefined) order.totalAmount = totalAmount;
        if (advancePayment !== undefined) order.advancePayment = advancePayment;
        if (discount !== undefined) order.discount = discount;
        if (tax !== undefined) order.tax = tax;
        if (taxType !== undefined) order.taxType = taxType;
        if (req.body.notes !== undefined) order.notes = req.body.notes;
        if (req.body.billImages !== undefined) order.billImages = req.body.billImages;

        await order.save();

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours basePrice partyPrice hsnCode')
            .populate('studio', 'name address phone email gstin pan bankDetails logo paymentQR printMode jobsheetFooter')
            .populate('images')
            .populate('billImages')
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
        if (req.user.role === 'staff' && (!req.user.assignedSteps || !req.user.assignedSteps.includes('reception'))) {
            return res.status(403).json({ message: 'Access denied: requires reception permission' });
        }
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

// @desc    Cancel an order
// @route   PUT /api/orders/:id/cancel
// @access  StudioAdmin
exports.cancelOrder = async (req, res) => {
    try {
        if (req.user.role === 'staff' && (!req.user.assignedSteps || !req.user.assignedSteps.includes('reception'))) {
            return res.status(403).json({ message: 'Access denied: requires reception permission' });
        }
        const { reason } = req.body;
        const order = await Order.findOne({ _id: req.params.id, studio: req.user.studio?._id });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ message: 'Order is already cancelled' });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ message: 'Cannot cancel a delivered order' });
        }

        order.status = 'cancelled';
        order.cancellationReason = reason || '';
        order.cancelledAt = new Date();
        order.statusHistory.push({
            status: 'cancelled',
            changedBy: req.user._id,
            changedAt: new Date(),
            notes: reason ? `Cancelled: ${reason}` : 'Order cancelled'
        });

        await order.save();

        // Send notification
        await Notification.create({
            studio: order.studio,
            title: 'Order Cancelled',
            message: `Order ${order.orderId} has been cancelled${reason ? ': ' + reason : ''}`,
            order: order._id,
            orderId: order.orderId,
            targetRoles: ['studioadmin', 'reception']
        });

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name slaHours')
            .populate('statusHistory.changedBy', 'name');

        res.json({ success: true, order: populatedOrder });
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
        const Payment = require('../models/Payment');

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

        const [deadlineCount, overdueCount, activeCount, cancelledCount] = await Promise.all([
            Order.countDocuments({
                studio: studioId,
                status: { $nin: ['delivered', 'cancelled'] },
                estimatedCompletion: { $lte: next24Hours }
            }),
            Order.countDocuments({
                studio: studioId,
                status: { $nin: ['delivered', 'cancelled'] },
                estimatedCompletion: { $lt: new Date() }
            }),
            Order.countDocuments({
                studio: studioId,
                status: { $nin: ['delivered', 'cancelled'] }
            }),
            Order.countDocuments({
                studio: studioId,
                status: 'cancelled'
            })
        ]);

        const statusCounts = {
            reception: 0,
            designing: 0,
            printing: 0,
            binding: 0,
            quality_check: 0,
            delivered: 0
        };

        stats.forEach(s => {
            statusCounts[s._id] = s.count;
        });

        // Calculate total party dues for dashboard
        // Use the ledger approach — match by party ID OR customer phone
        let totalPartyDue = 0;
        try {
            const parties = await Party.find({ studio: studioId }).select('_id phone').lean();
            if (parties.length > 0) {
                const partyPhones = parties.map(p => p.phone).filter(Boolean);
                const customers = await User.find({ phone: { $in: partyPhones }, studio: studioId }).select('_id').lean();
                const customerIds = customers.map(c => c._id);
                const partyIds = parties.map(p => p._id);

                const [orderDueAgg, paymentAgg] = await Promise.all([
                    Order.aggregate([
                        { $match: { studio: studioId, status: { $ne: 'cancelled' }, $or: [{ party: { $in: partyIds } }, { customer: { $in: customerIds } }] } },
                        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, totalAdvance: { $sum: '$advancePayment' }, totalDiscount: { $sum: '$discount' } } }
                    ]),
                    Payment.aggregate([
                        { $match: { studio: studioId } },
                        { $group: { _id: null, totalPayments: { $sum: '$amount' } } }
                    ])
                ]);

                const orderData = orderDueAgg[0] || { totalAmount: 0, totalAdvance: 0, totalDiscount: 0 };
                const paymentData = paymentAgg[0] || { totalPayments: 0 };
                totalPartyDue = Math.max(0, (orderData.totalAmount - orderData.totalDiscount) - orderData.totalAdvance - paymentData.totalPayments);
            }
        } catch (e) {
            console.error('Error calculating party dues:', e.message);
        }

        res.json({
            success: true,
            totalOrders,
            activeCount,
            deadlineCount,
            overdueCount,
            cancelledCount,
            historyCount: statusCounts.delivered,
            statusCounts,
            totalPartyDue: Math.round(totalPartyDue)
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
        const { startDate, endDate } = req.query;

        let dateQuery = { studio: studioId, status: { $ne: 'cancelled' } };
        if (startDate || endDate) {
            dateQuery.createdAt = {};
            if (startDate) dateQuery.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) {
                dateQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
            }
        }

        // 1. Basic Stats
        const allOrders = await Order.find(dateQuery, 'totalAmount advancePayment discount tax taxType categories createdAt').populate('categories', 'name');

        let totalBillings = 0;
        let totalAdvance = 0;
        let totalDiscount = 0;
        let totalTaxCollected = 0;
        let pendingBalance = 0;
        
        const categoryMap = {}; // For category breakdown
        const monthMap = {};    // For month-wise breakdown

        allOrders.forEach(order => {
            const amount = order.totalAmount || 0;
            const advance = order.advancePayment || 0;
            const discount = order.discount || 0;
            const taxPercentage = order.tax || 0;

            const taxableAmount = Math.max(0, amount - discount);
            let taxAmount = 0;
            let finalTotal = taxableAmount;

            if (order.taxType === 'inclusive') {
                const baseAmount = taxableAmount / (1 + taxPercentage / 100);
                taxAmount = taxableAmount - baseAmount;
                finalTotal = taxableAmount;
            } else {
                taxAmount = (taxableAmount * taxPercentage) / 100;
                finalTotal = taxableAmount + taxAmount;
            }

            totalBillings += amount;
            totalAdvance += advance;
            totalDiscount += discount;
            totalTaxCollected += taxAmount;
            pendingBalance += Math.max(0, finalTotal - advance);

            // Category Attribution (Proportional)
            if (order.categories && order.categories.length > 0) {
                const share = finalTotal / order.categories.length;
                order.categories.forEach(cat => {
                    const name = cat.name || 'Uncategorized';
                    categoryMap[name] = (categoryMap[name] || 0) + share;
                });
            }

            // Month Attribution
            const monthName = new Date(order.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
            monthMap[monthName] = (monthMap[monthName] || 0) + finalTotal;
        });

        // 1b. Fetch total manual payments from Balance Ledger (Payment model)
        let totalManualPayments = 0;
        try {
            const paymentMatch = { studio: studioId };
            if (dateQuery.createdAt) {
                paymentMatch.createdAt = dateQuery.createdAt;
            }

            const paymentAgg = await Payment.aggregate([
                { $match: paymentMatch },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            totalManualPayments = paymentAgg[0]?.total || 0;
        } catch (e) {
            console.error('Error fetching manual payments for revenue:', e.message);
        }

        // Subtract manual payments from pending balance
        pendingBalance = Math.max(0, pendingBalance - totalManualPayments);
        // Add manual payments to total collected (advance)
        const totalCollected = totalAdvance + totalManualPayments;

        // 2. Time Series Data (Daily Revenue)
        const timeSeries = await Order.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$totalAmount" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const timeSeriesData = timeSeries.map(item => ({
            date: item._id,
            revenue: Math.round(item.revenue),
            orders: item.count
        }));

        // 3. Format Category Data
        const categoryData = Object.keys(categoryMap).map(name => ({
            name,
            value: Math.round(categoryMap[name])
        })).sort((a, b) => b.value - a.value).slice(0, 8); // Top 8 categories

        // 4. Format Monthly Data
        const monthlyData = Object.keys(monthMap).map(name => ({
            name,
            value: Math.round(monthMap[name])
        })).sort((a, b) => {
            // Sort by actual date
            const dateA = new Date(a.name);
            const dateB = new Date(b.name);
            return dateA - dateB;
        });

        res.json({
            success: true,
            totalBillings: Math.round(totalBillings),
            totalAdvance: Math.round(totalCollected),
            totalDiscount: Math.round(totalDiscount),
            totalTaxCollected: Math.round(totalTaxCollected),
            pendingBalance: Math.round(pendingBalance),
            timeSeriesData,
            categoryData,
            monthlyData
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
        const { startDate, endDate } = req.query;

        let query = { studio: studioId };
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) {
                query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
            }
        }

        const orders = await Order.find(query)
            .populate('customer', 'name email phone')
            .populate('party', 'name email phone')
            .populate('categories', 'name')
            .sort('-createdAt')
            .lean();

        const rows = orders.map(order => {
            const amount = order.totalAmount || 0;
            const advance = order.advancePayment || 0;
            const discount = order.discount || 0;
            const taxPct = order.tax || 0;
            const taxableAmount = Math.max(0, amount - discount);
            
            let taxAmount = 0;
            let finalTotal = taxableAmount;
            
            if (order.taxType === 'inclusive') {
                const baseAmount = taxableAmount / (1 + taxPct / 100);
                taxAmount = taxableAmount - baseAmount;
                finalTotal = taxableAmount;
            } else {
                taxAmount = (taxableAmount * taxPct) / 100;
                finalTotal = taxableAmount + taxAmount;
            }
            
            taxAmount = Math.round(taxAmount);
            finalTotal = Math.round(finalTotal);
            const balance = Math.max(0, finalTotal - advance);

            return {
                orderId: order.orderId,
                customerName: (order.customer?.name || order.party?.name) || '',
                customerPhone: (order.customer?.phone || order.party?.phone) || '',
                customerEmail: (order.customer?.email || order.party?.email) || '',
                coupleName: order.coupleName || '',
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

// @desc    Get accurate party order history with manual payment distribution
// @route   GET /api/orders/party-history/:partyId
// @access  StudioAdmin, Staff
exports.getPartyHistory = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const { partyId } = req.params;

        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated' });
        }

        // 1. Get the party to get their phone number
        const party = await Party.findOne({ _id: partyId, studio: studioId }).lean();
        if (!party) {
            return res.status(404).json({ message: 'Party not found' });
        }

        // 2. Find all orders for this party (by party ID or matching phone)
        const customers = await User.find({ phone: party.phone, studio: studioId }).select('_id').lean();
        const customerIds = customers.map(c => c._id);

        const orders = await Order.find({
            studio: studioId,
            status: { $ne: 'cancelled' },
            $or: [
                { party: partyId },
                { customer: { $in: customerIds } }
            ]
        })
        .populate('categories', 'name')
        .sort({ createdAt: 1 }) // Oldest first for waterfall distribution
        .lean();

        // 3. Get all manual payments for this party
        const payments = await Payment.find({ party: partyId, studio: studioId }).sort({ createdAt: 1 }).lean();
        let totalManualPool = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // 4. Distribute payments (Waterfall Algorithm)
        let totalBilled = 0;
        let totalPaid = 0;

        const processedOrders = orders.map(order => {
            const amount = order.totalAmount || 0;
            const advance = order.advancePayment || 0;
            const discount = order.discount || 0;
            const taxPct = order.tax || 0;
            const taxable = Math.max(0, amount - discount);
            
            let finalTotal = taxable;
            if (order.taxType === 'exclusive') {
                finalTotal = taxable + (taxable * taxPct / 100);
            }

            const pendingAfterAdvance = Math.max(0, finalTotal - advance);
            
            // Take from manual pool
            const paymentFromPool = Math.min(pendingAfterAdvance, totalManualPool);
            totalManualPool -= paymentFromPool;

            const currentPaid = advance + paymentFromPool;
            const currentBalance = Math.max(0, finalTotal - currentPaid);

            totalBilled += finalTotal;
            totalPaid += currentPaid;

            return {
                ...order,
                finalTotal: Math.round(finalTotal),
                paidAmount: Math.round(currentPaid),
                balance: Math.round(currentBalance)
            };
        });

        // Sort back to newest first for UI
        processedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            orders: processedOrders,
            summary: {
                totalBilled: Math.round(totalBilled),
                totalPaid: Math.round(totalPaid),
                balanceDue: Math.round(Math.max(0, totalBilled - totalPaid))
            }
        });
    } catch (error) {
        console.error('Party history error:', error);
        res.status(500).json({ message: error.message });
    }
};


