const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Send WhatsApp message via BhashSMS API
 * @param {string} phone - Recipient phone number (10 digits)
 * @param {string} templateName - Template name (e.g., 'order_booking')
 * @param {string[]} params - Array of parameters for the template
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

        // Ensure phone is 10 digits (strip +91 or 91 prefix)
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

        // Try HTTPS first, fallback to HTTP
        const apiUrlHttps = `https://bhashsms.com/api/sendmsgutil.php?${queryParams.toString()}`;
        const apiUrlHttp = `http://bhashsms.com/api/sendmsgutil.php?${queryParams.toString()}`;

        console.log(`[WhatsApp] 📤 Sending to ${cleanPhone} | Template: ${templateName} | Params: ${paramsString}`);

        const makeRequest = (requestUrl, protocol, isRetry = false) => {
            const client = protocol === 'https' ? https : http;
            
            console.log(`[WhatsApp] 🔗 URL: ${requestUrl}`);
            
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
            });

            req.on('error', (err) => {
                console.error(`[WhatsApp] ❌ ${protocol.toUpperCase()} Error:`, err.message);
                if (!isRetry && protocol === 'https') {
                    console.log(`[WhatsApp] 🔄 Retrying with HTTP...`);
                    makeRequest(apiUrlHttp, 'http', true);
                } else {
                    reject(new Error(`WhatsApp send failed: ${err.message}`));
                }
            });

            // Set timeout to 15 seconds
            req.setTimeout(15000, () => {
                req.destroy();
                console.error(`[WhatsApp] ❌ Request timeout (${protocol.toUpperCase()})`);
                if (!isRetry && protocol === 'https') {
                    console.log(`[WhatsApp] 🔄 Retrying with HTTP after timeout...`);
                    makeRequest(apiUrlHttp, 'http', true);
                } else {
                    reject(new Error('WhatsApp send timed out'));
                }
            });
        };

        // Start with HTTPS
        makeRequest(apiUrlHttps, 'https');
    });
};

module.exports = { sendWhatsApp };
