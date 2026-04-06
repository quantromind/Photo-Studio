const fs = require('fs');

let content = fs.readFileSync('d:/Photo Studio/frontend/src/pages/studio/PartiesPage.jsx', 'utf8');

// fetchData
const oldFetch = `            const [custRes, catRes] = await Promise.all([
                API.get('/customer/list'),
                API.get('/categories')
            ]);
            const customers = custRes.data.customers || [];
            setAllCustomers(customers);
            setParties(customers.filter(c => c.isParty));
            setCategories(catRes.data.categories);`;
const newFetch = `            const [partyRes, catRes] = await Promise.all([
                API.get('/parties'),
                API.get('/categories')
            ]);
            setParties(partyRes.data.parties || []);
            setCategories(catRes.data.categories);`;

content = content.replace(oldFetch, newFetch);

// handleCreateParty
const oldCreate = `            // Check if existing customer (not party) - normalizing phone check
            const searchPhone = formData.phone.replace(/\\D/g, '').slice(-10);
            const existingCustomer = allCustomers.find(c => {
                const cPhone = String(c.phone || '').replace(/\\D/g, '').slice(-10);
                return cPhone === searchPhone || (c.email && c.email === formData.email);
            });
            
            let userId;
            if (existingCustomer) {
                // Just upgrade them
                userId = existingCustomer._id;
            } else {
                // Create new customer first
                try {
                    const res = await API.post('/customer/create', {
                        ...formData
                    });
                    userId = res.data.user._id;
                } catch (regErr) {
                    // If they exist but weren't in our studio list (unlikely with studio scoping but safety first)
                    if (regErr.response?.data?.message?.includes('exists')) {
                        throw new Error('This phone number is already registered. Please add them from the Customers list.');
                    }
                    throw regErr;
                }
            }
            
            if (!userId) throw new Error('Could not identify user ID');

            // Mark as party
            await API.put(\`/customer/toggle/\${userId}\`);
            
            setSuccess(existingCustomer ? 'Existing customer upgraded to Party!' : 'New Party added successfully!');`;
            
const newCreate = `            await API.post('/parties/create', formData);
            setSuccess('New Party added successfully!');`;
            
content = content.replace(oldCreate, newCreate);

// handleSavePrices
content = content.replace('await API.put(`/customer/party-prices/${showPriceModal._id}`', 'await API.put(`/parties/prices/${showPriceModal._id}`');

// delete party
content = content.replace('onClick={() => fetchData()}', 'onClick={async () => { if(window.confirm("Delete party?")) { await API.delete(`/parties/${party._id}`); fetchData(); } }}');

fs.writeFileSync('d:/Photo Studio/frontend/src/pages/studio/PartiesPage.jsx', content, 'utf8');
console.log('Done');
