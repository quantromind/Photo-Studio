const Payment = require('../models/Payment');
const Party = require('../models/Party');
const Order = require('../models/Order');
const User = require('../models/User');

// @desc    Get balance ledger — all parties with their due amounts
// @route   GET /api/payments/ledger
// @access  StudioAdmin, Staff
exports.getLedger = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated with this account' });
        }

        // 1. Get all parties for this studio
        const parties = await Party.find({ studio: studioId })
            .select('-password')
            .sort('name')
            .lean();

        if (parties.length === 0) {
            return res.json({ success: true, ledger: [], summary: { totalDue: 0, totalBilled: 0, totalPaid: 0 } });
        }

        // 2. For each party, find orders by phone number (same logic as HistoryModal)
        //    This catches orders linked via customer phone even without the party ObjectId
        let grandTotalDue = 0;
        let grandTotalBilled = 0;
        let grandTotalPaid = 0;

        // Batch: find all customers matching party phone numbers
        const partyPhones = parties.map(p => p.phone).filter(Boolean);
        const [customers, allPayments] = await Promise.all([
            User.find({ phone: { $in: partyPhones }, studio: studioId }).select('_id phone').lean(),
            Payment.aggregate([
                { $match: { studio: studioId, party: { $in: parties.map(p => p._id) } } },
                { $group: { _id: '$party', totalManualPayments: { $sum: '$amount' } } }
            ])
        ]);

        // Build phone -> customerId map
        const phoneToCustomer = {};
        customers.forEach(c => {
            phoneToCustomer[c.phone] = c._id;
        });

        // Build payment map
        const paymentMap = {};
        allPayments.forEach(item => {
            paymentMap[item._id.toString()] = item.totalManualPayments;
        });

        // 3. Single aggregate query for all orders in this studio to avoid N+1 problem
        const allOrderTotals = await Order.aggregate([
            {
                $match: {
                    studio: studioId,
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: { party: '$party', customer: '$customer' },
                    totalAmount: { $sum: '$totalAmount' },
                    totalAdvance: { $sum: '$advancePayment' },
                    totalDiscount: { $sum: '$discount' },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        // 4. Map the results to the parties
        const ledger = parties.map(party => {
            const pid = party._id.toString();
            const customerId = phoneToCustomer[party.phone]?.toString();

            // Find all order groups that belong to this party (either by party ref or customer ref)
            let totalAmount = 0;
            let totalAdvance = 0;
            let totalDiscount = 0;
            let orderCount = 0;

            allOrderTotals.forEach(group => {
                const isMatch = 
                    (group._id.party && group._id.party.toString() === pid) ||
                    (customerId && group._id.customer && group._id.customer.toString() === customerId);

                if (isMatch) {
                    totalAmount += (group.totalAmount || 0);
                    totalAdvance += (group.totalAdvance || 0);
                    totalDiscount += (group.totalDiscount || 0);
                    orderCount += (group.orderCount || 0);
                }
            });

            const manualPayments = paymentMap[pid] || 0;
            const totalBilled = totalAmount - totalDiscount;
            const totalPaid = totalAdvance + manualPayments;
            const due = Math.max(0, totalBilled - totalPaid);

            grandTotalDue += due;
            grandTotalBilled += totalBilled;
            grandTotalPaid += totalPaid;

            return {
                _id: party._id,
                name: party.name,
                phone: party.phone,
                email: party.email,
                city: party.city,
                state: party.state,
                partyType: party.partyType,
                totalBilled: Math.round(totalBilled),
                totalAdvance: Math.round(totalAdvance),
                totalManualPayments: Math.round(manualPayments),
                totalPaid: Math.round(totalPaid),
                due: Math.round(due),
                orderCount: orderCount
            };
        });

        // Sort by due (highest first)
        ledger.sort((a, b) => b.due - a.due);

        res.json({
            success: true,
            ledger,
            summary: {
                totalDue: Math.round(grandTotalDue),
                totalBilled: Math.round(grandTotalBilled),
                totalPaid: Math.round(grandTotalPaid)
            }
        });
    } catch (error) {
        console.error('Ledger error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Record a manual payment for a party
// @route   POST /api/payments
// @access  StudioAdmin
exports.recordPayment = async (req, res) => {
    try {
        const { partyId, amount, paymentMethod, reference, notes } = req.body;
        const studioId = req.user.studio?._id;

        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated' });
        }

        if (!partyId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Party and valid amount are required' });
        }

        // Verify party belongs to this studio
        const party = await Party.findOne({ _id: partyId, studio: studioId });
        if (!party) {
            return res.status(404).json({ message: 'Party not found' });
        }

        const payment = await Payment.create({
            party: partyId,
            studio: studioId,
            amount,
            paymentMethod: paymentMethod || 'cash',
            reference: reference || '',
            notes: notes || '',
            recordedBy: req.user._id
        });

        const populated = await Payment.findById(payment._id)
            .populate('party', 'name phone')
            .populate('recordedBy', 'name');

        res.status(201).json({ success: true, payment: populated });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all payment transactions for a specific party
// @route   GET /api/payments/party/:partyId
// @access  StudioAdmin, Staff
exports.getPartyPayments = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const { partyId } = req.params;

        const payments = await Payment.find({ party: partyId, studio: studioId })
            .populate('recordedBy', 'name')
            .sort('-createdAt')
            .lean();

        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a payment record
// @route   DELETE /api/payments/:id
// @access  StudioAdmin
exports.deletePayment = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const payment = await Payment.findOne({ _id: req.params.id, studio: studioId });

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        await Payment.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Payment deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
