const http = require('http');
const url = require('url');

/**
 * Send WhatsApp text message via BhashSMS API (sendmsgutil.php)
 */
const sendWhatsApp = async (phone, templateName, params = []) => {
    return new Promise((resolve, reject) => {
        const user = process.env.BHASHSMS_USER;
        const pass = process.env.BHASHSMS_PASS;
        const sender = process.env.BHASHSMS_SENDER;

        if (!user || !pass || !sender) {
            console.error('[WhatsApp] ERROR: BhashSMS credentials missing in .env');
            return reject(new Error('BhashSMS credentials not configured'));
        }

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
            cleanPhone = cleanPhone.slice(cleanPhone.length - 10);
        }

        const paramsString = params.join(',');
        const queryParams = new url.URLSearchParams({
            user,
            pass,
            sender,
            phone: cleanPhone,
            text: templateName,
            priority: 'wa',
            stype: 'normal',
            Params: paramsString
        });

        const apiUrl = `http://bhashsms.com/api/sendmsgutil.php?${queryParams.toString()}`;

        console.log(`[WhatsApp] 📤 Sending to ${cleanPhone} | Template: ${templateName} | Params: ${paramsString}`);

        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[WhatsApp] ✅ Response: ${data.trim()}`);
                resolve({ success: true, response: data.trim() });
            });
        }).on('error', (err) => {
            console.error('[WhatsApp] ❌ Error:', err.message);
            reject(err);
        });
    });
};

/**
 * Send WhatsApp message WITH PDF/Document via BhashSMS API (sendmsg.php)
 * Uses: htype=document & url=PUBLIC_PDF_URL
 * API Format from BhashSMS docs:
 * http://bhashsms.com/api/sendmsg.php?user=...&pass=...&sender=BUZWAP&phone=...
 *   &text=TEMPLATENAME&priority=wa&stype=normal&Params=p1,p2&htype=document&url=PDF_URL
 */
const sendWhatsAppWithDoc = async (phone, templateName, params = [], pdfUrl) => {
    return new Promise((resolve, reject) => {
        const user = process.env.BHASHSMS_USER;
        const pass = process.env.BHASHSMS_PASS;
        const sender = process.env.BHASHSMS_SENDER;

        if (!user || !pass || !sender) {
            console.error('[WhatsApp] ERROR: BhashSMS credentials missing in .env');
            return reject(new Error('BhashSMS credentials not configured'));
        }

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
            cleanPhone = cleanPhone.slice(cleanPhone.length - 10);
        }

        const paramsString = params.join(',');
        
        // Use sendmsg.php (NOT sendmsgutil.php) for media messages
        const queryParams = new url.URLSearchParams({
            user,
            pass,
            sender,
            phone: cleanPhone,
            text: templateName,
            priority: 'wa',
            stype: 'normal',
            Params: paramsString,
            htype: 'document',
            url: pdfUrl
        });

        const apiUrl = `http://bhashsms.com/api/sendmsg.php?${queryParams.toString()}`;

        console.log(`[WhatsApp] 📤📄 Sending DOC to ${cleanPhone} | Template: ${templateName}`);
        console.log(`[WhatsApp] 📎 PDF URL: ${pdfUrl}`);
        console.log(`[WhatsApp] 🔗 Full URL: ${apiUrl}`);

        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[WhatsApp] ✅ Doc Response: ${data.trim()}`);
                resolve({ success: true, response: data.trim() });
            });
        }).on('error', (err) => {
            console.error('[WhatsApp] ❌ Doc Error:', err.message);
            reject(err);
        });
    });
};

module.exports = { sendWhatsApp, sendWhatsAppWithDoc };
