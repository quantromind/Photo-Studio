const dns = require('dns');

const host = '_mongodb._tcp.cluster0.atbnfrf.mongodb.net';

console.log('Testing default DNS...');
dns.resolveSrv(host, (err, addresses) => {
    if (err) {
        console.error('Default DNS failed:', err);
    } else {
        console.log('Default DNS success:', addresses);
    }

    console.log('\nTesting Google DNS (8.8.8.8)...');
    dns.setServers(['8.8.8.8']);
    dns.resolveSrv(host, (err, addresses) => {
        if (err) {
            console.error('Google DNS failed:', err);
        } else {
            console.log('Google DNS success:', addresses);
        }
    });
});
