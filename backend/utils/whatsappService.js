const http = require('http');
const url = require('url');

/**
 * Send WhatsApp text message via BhashSMS API (sendmsgutil.php)
 * Uses WA UTILITY CREDITS (not WhatsApp SMS Credits)
 * 
 * Endpoint: sendmsgutil.php → WA Utility Credits
 * Endpoint: sendmsg.php → WhatsApp SMS Credits (for media/marketing)
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

        // ⚡ Use sendmsgutil.php (WA Utility Credits endpoint)
        const apiUrl = `http://bhashsms.com/api/sendmsgutil.php?${queryParams.toString()}`;

        // Mask password in log for security
        const maskedUrl = apiUrl.replace(/pass=[^&]+/, 'pass=******');
        console.log(`[WhatsApp] 📤 Sending to ${cleanPhone} | Template: ${templateName} | Params: ${paramsString}`);
        console.log(`[WhatsApp] 🔗 URL: ${maskedUrl}`);

        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[WhatsApp] 📥 Response (status ${res.statusCode}): ${data.trim()}`);

                const trimmedData = data.trim().toLowerCase();
                if (trimmedData.includes('error') || trimmedData.includes('fail') || 
                    trimmedData.includes('invalid') || trimmedData.includes('no sufficient') ||
                    trimmedData.includes('insufficient')) {
                    console.error(`[WhatsApp] ❌ API returned error: ${data.trim()}`);
                    reject(new Error(`BhashSMS API error: ${data.trim()}`));
                } else {
                    console.log(`[WhatsApp] ✅ Message sent successfully!`);
                    resolve({ success: true, response: data.trim() });
                }
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
 * NOTE: This uses sendmsg.php (WhatsApp SMS Credits) because media requires it
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
        
        // Use sendmsg.php for media/document messages
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

        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[WhatsApp] 📥 Doc Response (status ${res.statusCode}): ${data.trim()}`);
                
                const trimmedData = data.trim().toLowerCase();
                if (trimmedData.includes('error') || trimmedData.includes('fail') || 
                    trimmedData.includes('invalid') || trimmedData.includes('no sufficient') ||
                    trimmedData.includes('insufficient')) {
                    console.error(`[WhatsApp] ❌ Doc API error: ${data.trim()}`);
                    reject(new Error(`BhashSMS Doc API error: ${data.trim()}`));
                } else {
                    console.log(`[WhatsApp] ✅ Doc sent successfully!`);
                    resolve({ success: true, response: data.trim() });
                }
            });
        }).on('error', (err) => {
            console.error('[WhatsApp] ❌ Doc Error:', err.message);
            reject(err);
        });
    });
};

module.exports = { sendWhatsApp, sendWhatsAppWithDoc };
