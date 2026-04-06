const fs = require('fs');
let code = fs.readFileSync('controllers/orderController.js', 'utf8');

const regex1 = /exports\.deleteOrder \= async \(req\, res\) \=\> \{\r?\n\s*try \{\r?\n\s*const order/;
const replace1 = `exports.deleteOrder = async (req, res) => {
    try {
        if (req.user.role === 'staff' && (!req.user.assignedSteps || !req.user.assignedSteps.includes('reception'))) {
            return res.status(403).json({ message: 'Access denied: requires reception permission' });
        }
        const order`;

const regex2 = /exports\.cancelOrder \= async \(req\, res\) \=\> \{\r?\n\s*try \{\r?\n\s*const \{ reason \} \= req\.body;/;
const replace2 = `exports.cancelOrder = async (req, res) => {
    try {
        if (req.user.role === 'staff' && (!req.user.assignedSteps || !req.user.assignedSteps.includes('reception'))) {
            return res.status(403).json({ message: 'Access denied: requires reception permission' });
        }
        const { reason } = req.body;`;

if (regex1.test(code)) code = code.replace(regex1, replace1);
if (regex2.test(code)) code = code.replace(regex2, replace2);

fs.writeFileSync('controllers/orderController.js', code);
console.log('PATCH 2 SUCCESS');
