/**
 * Quick test: Send a single WhatsApp message via BhashSMS
 * Tests BOTH endpoints to see which one works
 * Usage: node scratch/test_wa_quick.js <phone_number>
 */
const http = require('http');

const user = 'Krajdigitalpress_BW';
const pass = '123456';
const sender = 'BUZWAP';
const phone = process.argv[2] || '8975221255';

// Use approved order_booking template
const templateName = 'order_booking';
const params = 'Test,TEST-001,Test Item,100,00 (Test)';

function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const apiUrl = `http://bhashsms.com/api/${endpoint}?user=${user}&pass=${pass}&sender=${sender}&phone=${phone}&text=${templateName}&priority=wa&stype=normal&Params=${encodeURIComponent(params)}`;

        console.log(`\n📤 Testing ${endpoint} → ${phone}`);
        
        http.get(apiUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`   📥 Response: "${data.trim()}"`);
                const lower = data.trim().toLowerCase();
                if (lower.includes('no sufficient') || lower.includes('insufficient') || lower.includes('error') || lower.includes('fail')) {
                    console.log(`   ❌ FAILED: ${data.trim()}`);
                } else {
                    console.log(`   ✅ SUCCESS!`);
                }
                resolve(data.trim());
            });
        }).on('error', (err) => {
            console.log(`   ❌ Network error: ${err.message}`);
            resolve(null);
        });
    });
}

async function main() {
    console.log('=== BhashSMS Endpoint Test ===');
    console.log(`Phone: ${phone} | Template: ${templateName}\n`);
    
    // Test sendmsgutil.php (should use WA Utility Credits - 9910 available)
    console.log('--- Test 1: sendmsgutil.php (WA Utility Credits) ---');
    await testEndpoint('sendmsgutil.php');
    
    // Small delay
    await new Promise(r => setTimeout(r, 2000));
    
    // Test sendmsg.php (uses WhatsApp SMS Credits - 0 available)
    console.log('\n--- Test 2: sendmsg.php (WhatsApp SMS Credits) ---');
    await testEndpoint('sendmsg.php');
    
    console.log('\n=== Test Complete ===');
}

main();
