const { sendWhatsApp, sendWhatsAppWithDoc } = require('./whatsappService');
const { generateBillPDF } = require('./billGenerator');

/**
 * Helper: Clean and validate phone number
 */
const cleanPhone = (phone) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return null;
    return cleaned.length === 10 ? cleaned : cleaned.slice(-10);
};

/**
 * Helper: Get recipient from order (party or customer)
 */
const getRecipient = (order) => {
    return order.isParty ? order.party : order.customer;
};

/**
 * Helper: Calculate order financial details
 */
const getFinancials = (order) => {
    const total = order.totalAmount || 0;
    const discount = order.discount || 0;
    const advance = order.advancePayment || 0;
    const taxPercent = order.tax || 0;
    const taxType = order.taxType || 'exclusive';
    
    const taxableAmount = Math.max(0, total - discount);
    let taxAmount = 0;
    if (taxType === 'inclusive') {
        taxAmount = taxableAmount - (taxableAmount / (1 + taxPercent / 100));
    } else {
        taxAmount = taxableAmount * (taxPercent / 100);
    }
    const netAmount = taxType === 'inclusive' ? taxableAmount : (taxableAmount + taxAmount);
    const finalNet = Math.round(netAmount);
    const balance = Math.max(0, finalNet - advance);

    return { total, discount, advance, finalNet, balance };
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1: ORDER BOOKING (order created)
// ═══════════════════════════════════════════════════════════════
// BhashSMS Template Name: order_advance  (APPROVED ✅)
// Template Text:
//   Dear *{{1}}*, Booking No. *{{2}}* for *{{3}}* your advance 
//   payment has been received. Estimated Value *Rs. {{4}}* *{{5}}* Thanks
// ═══════════════════════════════════════════════════════════════
const notifyOrderBooking = async (order, recipient) => {
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order booking — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    // Get categories (use | instead of comma — BhashSMS uses comma as param delimiter)
    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const { total, advance, balance } = getFinancials(order);
    const cleanName = recipient.name ? recipient.name.replace(/,/g, ' ') : 'Customer';

    const params = [
        cleanName,                                   // {{1}} Name
        order.orderId,                               // {{2}} Booking No.
        categories,                                  // {{3}} Items
        total.toString(),                            // {{4}} Amount
        `00 (Adv: Rs.${advance} | Bal: Rs.${balance})` // {{5}} Payment info
    ];

    try {
        // Also generate bill PDF (fire & forget — don't block WhatsApp send)
        generateBillPDF(order).then(pdfUrl => {
            console.log(`[WA] 📄 Bill PDF generated: ${pdfUrl}`);
        }).catch(err => {
            console.error(`[WA] ⚠️ Bill PDF generation failed:`, err.message);
        });

        const result = await sendWhatsApp(phone, 'order_booking', params);
        console.log(`[WA] ✅ ORDER BOOKING sent to ${phone} for ${order.orderId}`);
        return { success: true, phone, response: result };
    } catch (err) {
        console.error(`[WA] ❌ ORDER BOOKING failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2: ORDER BOOKING WITH BILL PDF
// ═══════════════════════════════════════════════════════════════
// Uses EXISTING approved 'order_advance' template + PDF via sendmsg.php
// BhashSMS API: sendmsg.php with htype=document&url=PDF_URL
// ═══════════════════════════════════════════════════════════════
const notifyOrderWithBill = async (order, recipient) => {
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order invoice — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const { total, advance, balance } = getFinancials(order);
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 7000}`;
    const cleanName = recipient.name ? recipient.name.replace(/,/g, ' ') : 'Customer';

    // Same params as order_booking
    const params = [
        cleanName,                                   // {{1}} Name
        order.orderId,                               // {{2}} Booking No.
        categories,                                  // {{3}} Items
        total.toString(),                            // {{4}} Amount
        `00 (Adv: Rs.${advance} | Bal: Rs.${balance})` // {{5}} Payment info
    ];

    try {
        // Step 1: Generate bill PDF on server
        const pdfRelativeUrl = await generateBillPDF(order);
        const pdfFullUrl = `${backendUrl}${pdfRelativeUrl}`;
        console.log(`[WA] 📄 Bill PDF generated: ${pdfFullUrl}`);

        // Step 2: Send WhatsApp with PDF using sendmsg.php (htype=document)
        // Uses new approved 'order_booking' template!
        try {
            const result = await sendWhatsAppWithDoc(phone, 'order_booking', params, pdfFullUrl);
            console.log(`[WA] ✅ ORDER BOOKING + PDF sent to ${phone} for ${order.orderId}`);
            return { success: true, phone, response: result, pdfUrl: pdfFullUrl };
        } catch (docErr) {
            // If sendmsg.php fails, fallback to text-only via sendmsg.php
            console.warn(`[WA] ⚠️ PDF send failed, sending text-only:`, docErr.message);
            const result = await sendWhatsApp(phone, 'order_booking', params);
            console.log(`[WA] ✅ ORDER BOOKING (text only) sent to ${phone}`);
            return { success: true, phone, response: result, pdfUrl: pdfFullUrl, fallback: true };
        }
    } catch (err) {
        console.error(`[WA] ❌ ORDER WITH BILL failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3: ORDER ADVANCE PAYMENT RECEIVED
// ═══════════════════════════════════════════════════════════════
// BhashSMS Template Name: order_advance  (APPROVED ✅)
// Template Text:
//   Dear *{{1}}*, Booking No.: *{{2}}* for *{{3}}* your advance 
//   payment has been received. Estimated Value: *Rs.{{4}}* {{5}} Thanks
// ═══════════════════════════════════════════════════════════════
const notifyOrderAdvance = async (order, recipient, receivedAmount) => {
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order advance — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const { total, advance, balance } = getFinancials(order);
    const cleanName = recipient.name ? recipient.name.replace(/,/g, ' ') : 'Customer';

    const received = (receivedAmount !== undefined && receivedAmount > 0) ? receivedAmount : advance;
    const params = [
        cleanName,                                   // {{1}} Name
        order.orderId,                               // {{2}} Booking No.
        categories,                                  // {{3}} Items
        total.toString(),                            // {{4}} Estimated Value
        `00 (Received: Rs.${received} | Total Paid: Rs.${advance} | Bal: Rs.${balance})` // {{5}} Payment details
    ];

    try {
        const result = await sendWhatsApp(phone, 'payment_received', params);
        console.log(`[WA] ✅ ORDER ADVANCE sent to ${phone} for ${order.orderId}`);
        return { success: true, phone, response: result };
    } catch (err) {
        console.error(`[WA] ❌ ORDER ADVANCE failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4: ORDER COMPLETED (ready for delivery)
// ═══════════════════════════════════════════════════════════════
// BhashSMS Template Name: order_completed  (APPROVED ✅)
// Template Text:
//   Dear *{{1}}*, Booking No.: *{{2}}* for *{{3}}* has been 
//   successfully completed and ready for delivery. 
//   Estimated Value: *Rs.{{4}}* {{5}} Thanks
// ═══════════════════════════════════════════════════════════════
const notifyOrderCompleted = async (order) => {
    const recipient = getRecipient(order);
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order completed — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const { total, advance, balance } = getFinancials(order);
    const cleanName = recipient.name ? recipient.name.replace(/,/g, ' ') : 'Customer';

    const params = [
        cleanName,                                   // {{1}} Name
        order.orderId,                               // {{2}} Booking No.
        categories,                                  // {{3}} Items
        total.toString(),                            // {{4}} Estimated Value
        `00 (Adv: Rs.${advance} | Bal: Rs.${balance})` // {{5}} Payment details
    ];

    try {
        const result = await sendWhatsApp(phone, 'order_completed', params);
        console.log(`[WA] ✅ ORDER COMPLETED sent to ${phone} for ${order.orderId}`);
        return { success: true, phone, response: result };
    } catch (err) {
        console.error(`[WA] ❌ ORDER COMPLETED failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5: ORDER READY FOR PICKUP
// ═══════════════════════════════════════════════════════════════
// BhashSMS Template Name: order_ready  (NEEDS REGISTRATION 🆕)
// Template Text:
//   Dear *{{1}}*, Great news! Your order *{{2}}* for *{{3}}* is 
//   now ready for pickup. Total: Rs.{{4}} | Paid: Rs.{{5}} | 
//   Balance: Rs.{{6}}. Please visit us at your convenience. 
//   Thank you! - *{{7}}*
// ═══════════════════════════════════════════════════════════════
const notifyOrderReady = async (order) => {
    const recipient = getRecipient(order);
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order ready — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const studioName = order.studio?.name || 'Our Studio';
    const { finalNet, advance, balance } = getFinancials(order);

    const params = [
        recipient.name,           // {{1}} Name
        order.orderId,            // {{2}} Order ID
        categories,               // {{3}} Items
        finalNet.toString(),      // {{4}} Total
        advance.toString(),       // {{5}} Paid
        balance.toString(),       // {{6}} Balance
        studioName                // {{7}} Studio name
    ];

    try {
        const result = await sendWhatsApp(phone, 'order_ready', params);
        console.log(`[WA] ✅ ORDER READY sent to ${phone} for ${order.orderId}`);
        return { success: true, phone, response: result };
    } catch (err) {
        console.error(`[WA] ❌ ORDER READY failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6: ORDER DELIVERED — THANK YOU
// ═══════════════════════════════════════════════════════════════
// BhashSMS Template Name: order_thankyou  (NEEDS REGISTRATION 🆕)
// Template Text:
//   Dear *{{1}}*, Thank you for choosing *{{2}}*! Your order 
//   *{{3}}* for *{{4}}* has been successfully delivered. 
//   Total: Rs.{{5}} | Paid: Rs.{{6}} | Balance: Rs.{{7}}.
//   We appreciate your business and look forward to serving 
//   you again!
// ═══════════════════════════════════════════════════════════════
const notifyOrderDelivered = async (order) => {
    const recipient = getRecipient(order);
    if (!recipient?.phone) {
        console.warn('[WA] No phone for order delivered — skipping');
        return { success: false, reason: 'no_phone' };
    }

    const phone = cleanPhone(recipient.phone);
    if (!phone) return { success: false, reason: 'invalid_phone' };

    const categories = (order.categories || []).map(c => c.name).join(' | ');
    const studioName = order.studio?.name || 'Our Studio';
    const { finalNet, advance, balance } = getFinancials(order);

    const params = [
        recipient.name,           // {{1}} Name
        studioName,               // {{2}} Studio name
        order.orderId,            // {{3}} Order ID
        categories,               // {{4}} Items
        finalNet.toString(),      // {{5}} Total
        advance.toString(),       // {{6}} Paid
        balance.toString()        // {{7}} Balance
    ];

    try {
        const result = await sendWhatsApp(phone, 'order_thankyou', params);
        console.log(`[WA] ✅ ORDER DELIVERED (Thank You) sent to ${phone} for ${order.orderId}`);
        return { success: true, phone, response: result };
    } catch (err) {
        console.error(`[WA] ❌ ORDER DELIVERED failed for ${phone}:`, err.message);
        throw err;
    }
};

// ═══════════════════════════════════════════════════════════════
// Legacy placeholder
// ═══════════════════════════════════════════════════════════════
const sendNotification = async ({ type, to, message, orderId }) => {
    console.log(`📧 [NOTIFICATION] Type: ${type} | To: ${to} | Order: ${orderId}`);
    return { success: true, type, to, message };
};

const notifyOrderStatusChange = async (order, customer, newStatus) => {
    // This function is called from updateOrderStatus
    // We now use specific WhatsApp templates instead of generic SMS/email
    console.log(`[Notification] Status change: ${order.orderId} → ${newStatus}`);
};

module.exports = { 
    sendNotification, 
    notifyOrderStatusChange, 
    notifyOrderBooking,
    notifyOrderWithBill,
    notifyOrderAdvance,
    notifyOrderCompleted,
    notifyOrderReady, 
    notifyOrderDelivered,
    getFinancials
};
