const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a professional Tax Invoice PDF for an order
 * @param {Object} order - Populated order object (with studio, categories, party/customer)
 * @returns {string} - The relative URL path to the generated PDF (e.g., /uploads/studioId/bills/Bill_ORD-0001.pdf)
 */
const generateBillPDF = async (order) => {
    const studioId = (order.studio?._id || order.studio).toString();
    const billsDir = path.join(__dirname, '..', 'uploads', studioId, 'bills');
    
    // Ensure directory exists
    if (!fs.existsSync(billsDir)) {
        fs.mkdirSync(billsDir, { recursive: true });
    }

    const fileName = `Bill_${order.orderId}.pdf`;
    const filePath = path.join(billsDir, fileName);
    const relativeUrl = `/uploads/${studioId}/bills/${fileName}`;

    // Order details
    const studio = order.studio || {};
    const recipient = order.isParty ? order.party : order.customer;
    const recipientName = recipient?.name || '-';
    const recipientPhone = recipient?.phone || '-';
    const categories = order.categories || [];
    const totalAmount = order.totalAmount || 0;
    const discount = order.discount || 0;
    const advance = order.advancePayment || 0;
    const taxPercent = order.tax || 0;
    const taxType = order.taxType || 'exclusive';
    
    const taxableAmount = Math.max(0, totalAmount - discount);
    let taxAmount = 0;
    if (taxType === 'inclusive') {
        taxAmount = taxableAmount - (taxableAmount / (1 + taxPercent / 100));
    } else {
        taxAmount = taxableAmount * (taxPercent / 100);
    }
    const netAmount = taxType === 'inclusive' ? taxableAmount : (taxableAmount + taxAmount);
    const finalNet = Math.round(netAmount);
    const balance = Math.max(0, finalNet - advance);

    const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4', 
                margin: 40,
                info: {
                    Title: `Invoice ${order.orderId}`,
                    Author: studio.name || 'Photo Studio',
                }
            });
            
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const pageWidth = doc.page.width - 80; // 40 margin each side
            const leftMargin = 40;

            // ─── HEADER ─────────────────────────────────────
            // Studio Name
            doc.fontSize(22).font('Helvetica-Bold')
               .text(studio.name || 'STUDIO', leftMargin, 40, { align: 'center', width: pageWidth });
            
            // Studio Address
            if (studio.address) {
                doc.fontSize(9).font('Helvetica')
                   .text(studio.address, leftMargin, doc.y + 4, { align: 'center', width: pageWidth });
            }
            
            // Studio Phone
            if (studio.phone) {
                doc.fontSize(9).font('Helvetica')
                   .text(`Phone: +91 ${studio.phone}`, leftMargin, doc.y + 2, { align: 'center', width: pageWidth });
            }

            // GSTIN
            if (studio.gstin) {
                doc.fontSize(8).font('Helvetica')
                   .text(`GSTIN: ${studio.gstin}`, leftMargin, doc.y + 2, { align: 'center', width: pageWidth });
            }

            // ─── TAX INVOICE TITLE ──────────────────────────
            const titleY = doc.y + 12;
            doc.rect(leftMargin, titleY, pageWidth, 28).fill('#1a56db');
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff')
               .text('TAX INVOICE', leftMargin, titleY + 7, { align: 'center', width: pageWidth });
            doc.fillColor('#000000');

            // ─── INVOICE INFO ROW ───────────────────────────
            const infoY = titleY + 38;
            doc.fontSize(9).font('Helvetica-Bold');
            
            // Left column - Invoice No
            doc.text('Invoice No:', leftMargin, infoY);
            doc.font('Helvetica').text(order.orderId, leftMargin + 70, infoY);
            
            // Right column - Date
            doc.font('Helvetica-Bold').text('Date:', leftMargin + 320, infoY);
            doc.font('Helvetica').text(invoiceDate, leftMargin + 355, infoY);

            // ─── BILLED TO ──────────────────────────────────
            const billedY = infoY + 25;
            doc.rect(leftMargin, billedY, pageWidth, 1).fill('#1a56db');
            
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a56db')
               .text('BILLED TO', leftMargin, billedY + 8);
            doc.fillColor('#000000');
            
            doc.fontSize(12).font('Helvetica-Bold')
               .text(recipientName, leftMargin, doc.y + 4);
            
            doc.fontSize(9).font('Helvetica')
               .text(`Phone: ${recipientPhone}`, leftMargin, doc.y + 3);

            if (order.coupleName) {
                doc.text(`Couple: ${order.coupleName}`, leftMargin, doc.y + 2);
            }

            // ─── ITEMS TABLE ────────────────────────────────
            const tableTop = doc.y + 18;
            const colWidths = {
                sr: 35,
                name: pageWidth - 35 - 50 - 80 - 80 - 80,
                qty: 50,
                rate: 80,
                disc: 80,
                amount: 80
            };

            // Table header
            doc.rect(leftMargin, tableTop, pageWidth, 24).fill('#f0f4ff');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1a56db');
            
            let colX = leftMargin + 6;
            doc.text('Sr.', colX, tableTop + 7, { width: colWidths.sr });
            colX += colWidths.sr;
            doc.text('Item Description', colX, tableTop + 7, { width: colWidths.name });
            colX += colWidths.name;
            doc.text('Qty', colX, tableTop + 7, { width: colWidths.qty, align: 'center' });
            colX += colWidths.qty;
            doc.text('Rate (₹)', colX, tableTop + 7, { width: colWidths.rate, align: 'right' });
            colX += colWidths.rate;
            doc.text('Disc (₹)', colX, tableTop + 7, { width: colWidths.disc, align: 'right' });
            colX += colWidths.disc;
            doc.text('Amount (₹)', colX, tableTop + 7, { width: colWidths.amount, align: 'right' });
            
            doc.fillColor('#000000');

            // Table rows
            let rowY = tableTop + 28;
            categories.forEach((cat, idx) => {
                const catId = (cat._id || cat).toString();
                const qty = (order.categoryQuantities && order.categoryQuantities[catId]) || 1;
                let rate = (order.categoryPrices && order.categoryPrices[catId]) || cat.basePrice || cat.partyPrice || 0;
                if (typeof rate === 'object' && rate !== null) rate = 0;
                const amount = rate * qty;
                const disc = idx === 0 ? discount : 0;
                const total = amount - disc;

                // Alternate row background
                if (idx % 2 === 0) {
                    doc.rect(leftMargin, rowY - 2, pageWidth, 20).fill('#fafbff');
                    doc.fillColor('#000000');
                }

                doc.fontSize(9).font('Helvetica');
                colX = leftMargin + 6;
                doc.text(`${idx + 1}`, colX, rowY, { width: colWidths.sr });
                colX += colWidths.sr;
                doc.text(cat.name || '-', colX, rowY, { width: colWidths.name });
                colX += colWidths.name;
                doc.text(`${qty}`, colX, rowY, { width: colWidths.qty, align: 'center' });
                colX += colWidths.qty;
                doc.text(`${parseFloat(rate).toFixed(2)}`, colX, rowY, { width: colWidths.rate, align: 'right' });
                colX += colWidths.rate;
                doc.text(disc > 0 ? `${disc.toFixed(2)}` : '-', colX, rowY, { width: colWidths.disc, align: 'right' });
                colX += colWidths.disc;
                doc.text(`${total.toFixed(2)}`, colX, rowY, { width: colWidths.amount, align: 'right' });
                
                rowY += 22;
            });

            // Table bottom line
            doc.rect(leftMargin, rowY, pageWidth, 1.5).fill('#1a56db');

            // ─── TOTALS SECTION ─────────────────────────────
            const totalsX = leftMargin + pageWidth - 250;
            let totalY = rowY + 15;
            const labelW = 140;
            const valueW = 100;

            const drawTotalRow = (label, value, bold = false, highlight = false) => {
                if (highlight) {
                    doc.rect(totalsX - 5, totalY - 3, 255, 22).fill('#1a56db');
                    doc.fillColor('#ffffff');
                }
                doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
                doc.text(label, totalsX, totalY, { width: labelW });
                doc.text(value, totalsX + labelW, totalY, { width: valueW, align: 'right' });
                if (highlight) doc.fillColor('#000000');
                totalY += 20;
            };

            drawTotalRow('Sub Total:', `Rs. ${totalAmount.toFixed(2)}`);
            if (discount > 0) {
                drawTotalRow('Discount:', `- Rs. ${discount.toFixed(2)}`);
            }
            if (taxAmount > 0) {
                drawTotalRow(`Tax (${taxPercent}%):`, `Rs. ${taxAmount.toFixed(2)}`);
            }
            drawTotalRow('Net Amount:', `Rs. ${finalNet.toFixed(2)}`, true, true);
            
            totalY += 5;
            if (advance > 0) {
                drawTotalRow('Advance Paid:', `Rs. ${advance.toFixed(2)}`);
            }
            drawTotalRow('Balance Due:', `Rs. ${balance.toFixed(2)}`, true);

            // ─── PAYMENT INFO ───────────────────────────────
            if (order.paymentMode) {
                totalY += 5;
                doc.fontSize(8).font('Helvetica')
                   .text(`Payment Mode: ${order.paymentMode.toUpperCase()}`, totalsX, totalY);
            }

            // ─── NOTES ──────────────────────────────────────
            if (order.notes) {
                const notesY = Math.max(totalY + 25, rowY + 15);
                doc.fontSize(8).font('Helvetica-Bold')
                   .text('Notes:', leftMargin, notesY);
                doc.fontSize(8).font('Helvetica')
                   .text(order.notes, leftMargin, doc.y + 3, { width: pageWidth * 0.5 });
            }

            // ─── FOOTER ─────────────────────────────────────
            const footerY = doc.page.height - 80;
            doc.rect(leftMargin, footerY, pageWidth, 1).fill('#e0e0e0');
            
            // Signatory
            doc.fontSize(8).font('Helvetica')
               .text('Authorized Signatory', leftMargin + pageWidth - 150, footerY + 8, { width: 150, align: 'right' });
            
            // System tag
            doc.fontSize(7).fillColor('#999999')
               .text(`Generated on ${new Date().toLocaleString('en-IN')} | ${studio.name || 'Photo Studio'}`, 
                      leftMargin, footerY + 30, { align: 'center', width: pageWidth });

            doc.end();

            stream.on('finish', () => {
                console.log(`[BillGenerator] ✅ PDF created: ${relativeUrl}`);
                resolve(relativeUrl);
            });

            stream.on('error', (err) => {
                console.error(`[BillGenerator] ❌ PDF write error:`, err.message);
                reject(err);
            });

        } catch (err) {
            console.error(`[BillGenerator] ❌ PDF generation error:`, err.message);
            reject(err);
        }
    });
};

module.exports = { generateBillPDF };
