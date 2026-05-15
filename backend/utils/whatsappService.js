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

<<<<<<< HEAD
        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[WhatsApp] ✅ Response: ${data.trim()}`);
                resolve({ success: true, response: data.trim() });
=======
        const makeRequest = (requestUrl, protocol, isRetry = false) => {
            const client = protocol === 'https' ? https : http;
            
            // Mask password in log for security
            const maskedUrl = requestUrl.replace(/pass=[^&]+/, 'pass=******');
            console.log(`[WhatsApp] 🔗 Requesting (${protocol.toUpperCase()}): ${maskedUrl}`);
            
            const req = client.get(requestUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log(`[WhatsApp] 📥 Response (status ${res.statusCode}): ${data}`);
                    
                    // Check if the response indicates success
                    const trimmedData = data.trim().toLowerCase();
                    if (res.statusCode >= 200 && res.statusCode < 300 && data.trim().length > 0) {
                        // BhashSMS typically returns a message ID or success text
                        if (trimmedData.includes('error') || trimmedData.includes('fail') || trimmedData.includes('invalid')) {
                            console.error(`[WhatsApp] ❌ API returned error: ${data}`);
                            reject(new Error(`BhashSMS API error: ${data.trim()}`));
                        } else {
                            console.log(`[WhatsApp] ✅ Message sent successfully!`);
                            resolve({ success: true, response: data.trim() });
                        }
                    } else if (data.trim().length === 0) {
                        // Empty response - API might not have processed
                        if (!isRetry) {
                            console.warn(`[WhatsApp] ⚠️ Empty response on ${protocol.toUpperCase()}, retrying with HTTP...`);
                            makeRequest(apiUrlHttp, 'http', true);
                        } else {
                            console.error(`[WhatsApp] ❌ Empty response from API (both HTTPS and HTTP failed)`);
                            reject(new Error('BhashSMS returned empty response - message may not have been sent'));
                        }
                    } else {
                        console.error(`[WhatsApp] ❌ Unexpected status ${res.statusCode}: ${data}`);
                        reject(new Error(`BhashSMS returned status ${res.statusCode}`));
                    }
                });
>>>>>>> 37df225387ef0ae69fa29f1dc5ceb2d7083e048a
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
