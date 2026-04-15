const fs=require('fs');
const p='c:/Users/hp/Desktop/Quntromind/Photo-Studio/frontend/src/pages/studio/OrdersPage.jsx';
let c=fs.readFileSync(p,'utf8');

c=c.replace(/\s*const \[showModal, setShowModal\] = useState\(false\);\n/,'\n');
c=c.replace(/\s*const \[showCategoryDropdown, setShowCategoryDropdown\] = useState\(false\);\n/,'\n');
c=c.replace(/\s*const \[catSearchQuery, setCatSearchQuery\] = useState\(''\);\n/,'\n');
c=c.replace(/\s*const \[selectedCustomer, setSelectedCustomer\] = useState\(null\);\n\s*const \[customerPrices, setCustomerPrices\] = useState\(\{\}\);\n\s*const \[formData, setFormData\] = useState\(\{[\s\S]*?\}\);\n/,'\n');

c=c.replace(/\s*\/\/ Customer Lookup[\s\S]*?setSubmitting\(false\);\n\s*\}\n\s*\};\n/m,'\n\n');

c=c.replace(/onClick=\{\(\)\s*=>\s*setShowModal\(true\)\}/,"onClick={() => navigate('/orders/new')}");

c=c.replace(/\s*\{showModal && \([\s\S]*?\{showStatusModal && \(/, '\n\n            {/* ===== STATUS CHANGE MODAL ===== */}\n            {showStatusModal && (');

fs.writeFileSync(p,c);
console.log("File modified successfully");
