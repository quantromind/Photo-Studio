const { sendWhatsApp } = require('./whatsappService');

const sendNotification = async ({ type, to, message, orderId }) => {
    // Log notification (placeholder)
    console.log(`📧 [NOTIFICATION] Type: ${type} | To: ${to} | Order: ${orderId}`);
    console.log(`   Message: ${message}`);

    // TODO: Integrate with actual services:
    // - Twilio for SMS/WhatsApp
    // - SendGrid/Nodemailer for Email

    return { success: true, type, to, message };
};

const notifyOrderStatusChange = async (order, customer, newStatus) => {
    const statusLabels = {
        reception: 'Reception',
        designing: 'Designing',
        printing: 'Printing',
        binding: 'Binding',
        quality_check: 'Quality Check',
        delivered: 'Delivered',
        completed: 'Completed (Order History)'
    };

    const message = `Your order #${order.orderId} has moved to ${statusLabels[newStatus] || newStatus} stage.`;

    if (customer.email) {
        await sendNotification({
            type: 'email',
            to: customer.email,
            message,
            orderId: order.orderId
        });
    }

    if (customer.phone) {
        await sendNotification({
            type: 'sms',
            to: customer.phone,
            message,
            orderId: order.orderId
        });
    }
};

const notifyOrderBooking = async (order, customer) => {
    if (!customer || !customer.phone) {
        console.warn('[Notification] No customer phone — skipping WhatsApp');
        return { success: false, reason: 'no_phone' };
    }

    // Clean phone number (strip spaces, symbols)
    const phone = customer.phone.replace(/\D/g, '');
    if (phone.length < 10) {
        console.warn(`[Notification] Phone too short (${phone.length} digits) — skipping`);
        return { success: false, reason: 'invalid_phone' };
    }
    const targetPhone = phone.length === 10 ? phone : phone.slice(-10);

    // Prepare parameters for 'order_booking' template
    // Template: Dear *{{1}}*, Booking No.: *{{2}}* for *{{3}}* has been 
    //           successfully completed. Estimated Value: *Rs. {{4}}* {{5}} Thanks
    //
    // IMPORTANT: BhashSMS uses comma (,) as parameter delimiter!
    // So individual param values must NOT contain commas, otherwise
    // the API will split them into extra params causing template mismatch.
    const categories = order.categories.map(c => c.name).join(' | ');  // Use | instead of comma
    const amount = order.totalAmount || 0;
    const advance = order.advancePayment || 0;
    const discount = order.discount || 0;
    const balance = Math.max(0, amount - discount - advance);
    
    const params = [
        customer.name,                              // {{1}} Name
        order.orderId,                               // {{2}} Booking No.
        categories,                                  // {{3}} Services (pipe-separated)
        amount.toString(),                           // {{4}} Amount
        `(Adv: ${advance} | Bal: ${balance})`        // {{5}} Extra info (NO commas!)
    ];

    try {
        const result = await sendWhatsApp(targetPhone, 'order_booking', params);
        console.log(`[Notification] ✅ Order booking WhatsApp sent to ${targetPhone}`);
        return { success: true, phone: targetPhone, response: result };
    } catch (err) {
        console.error(`[Notification] ❌ Failed to send booking WhatsApp to ${targetPhone}:`, err.message);
        // Re-throw so caller knows it failed
        throw err;
    }
};

module.exports = { sendNotification, notifyOrderStatusChange, notifyOrderBooking };
