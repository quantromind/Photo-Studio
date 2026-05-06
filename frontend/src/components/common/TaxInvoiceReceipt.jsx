import React from 'react';
import './TaxInvoiceReceipt.css';

const TaxInvoiceReceipt = ({ order, billingData, getFileUrl, currentUser, customerBalance = 0 }) => {
    if (!order || !order.studio) return null;

    const studio = order.studio;
    const invoiceDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    // Determine Party/Customer details
    const billedTo = order.isParty ? (order.party?.name || '-') : (order.customer?.name || '-');
    const billedAddress = order.isParty ? (order.party?.address || '') : (order.customer?.address || '');
    const billedPhone = order.isParty ? (order.party?.phone || '-') : (order.customer?.phone || '-');

    const totalAmount = billingData.totalAmount || 0;
    const discountAmount = billingData.discount || 0;
    const taxPercent = billingData.tax || 0;
    const taxType = billingData.taxType || 'exclusive';
    
    const taxableAmount = Math.max(0, totalAmount - discountAmount);
    let taxAmount = 0;
    if (taxType === 'inclusive') {
        taxAmount = taxableAmount - (taxableAmount / (1 + taxPercent / 100));
    } else {
        taxAmount = taxableAmount * (taxPercent / 100);
    }

    const netInvoiceAmt = taxType === 'inclusive' ? taxableAmount : (taxableAmount + taxAmount);
    const roundOff = Math.round(netInvoiceAmt) - netInvoiceAmt;
    const finalNetAmt = Math.round(netInvoiceAmt);

    const advancePaid = billingData.advancePayment || 0;
    const preBalance = customerBalance || 0;
    const totalBalance = preBalance + finalNetAmt;
    const remainingBalance = totalBalance - advancePaid;

    const printedBy = currentUser?.name || 'Admin';
    const createdBy = order.statusHistory?.find(h => h.status === 'reception')?.changedBy?.name || 'Admin';
    
    const orderCreateTime = new Date(order.createdAt).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).toUpperCase();

    const printTime = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).toUpperCase();

    return (
        <div className="tax-invoice-print print-only">
            <div className="invoice-container">
                {/* Header Section */}
                <div className="invoice-header-new">
                    <div className="header-left">
                        {studio.logo ? (
                            <img src={getFileUrl(studio.logo)} alt="Studio Logo" className="studio-logo-print" />
                        ) : (
                            <div className="logo-placeholder">LOGO</div>
                        )}
                    </div>
                    <div className="header-center">
                        <h1 className="studio-name-print">{studio.name || 'K RAJ DIGITAL PRESS'}</h1>
                        <p className="studio-address-print">
                            {studio.address || '116 SIDDSHWER COMPLEX SOUTH SADER BAZER, Solapur-413003 Maharashtra'}
                        </p>
                        <div className="tax-invoice-title-box">
                            <h2 className="tax-invoice-title">Tax Invoice</h2>
                            <span className="tax-invoice-subtitle">(Album Sale)</span>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="phone-no">Phone No.: +91 {studio.phone || ''}</div>
                        <div className="barcode-box">
                            <div className="barcode-stripes">
                                {[...Array(30)].map((_, i) => (
                                    <div key={i} className={`stripe ${i % 3 === 0 ? 'wide' : i % 5 === 0 ? 'medium' : 'thin'}`}></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="invoice-info-grid">
                    <div className="info-box billed-to">
                        <div className="info-label">Details of Reciever (Billed To)</div>
                        <div className="info-content">
                            <div className="recipient-name">{billedTo}</div>
                            <div className="recipient-address">{billedAddress}</div>
                        </div>
                    </div>
                    <div className="info-box invoice-no-box">
                        <div className="info-label">Tax Invoice No.</div>
                        <div className="info-content center-text bold-text">{order.orderId}</div>
                    </div>
                    <div className="info-box invoice-date-box">
                        <div className="info-label">Invoice Date</div>
                        <div className="info-content center-text bold-text">{invoiceDate}</div>
                    </div>
                    <div className="info-box consignee">
                        <div className="info-label">Details of Consignee ( Shipped To )</div>
                        <div className="info-content">
                            <div className="consignee-note">-Same as Billed To -</div>
                        </div>
                    </div>
                    <div className="info-box mobile-box">
                        <div className="info-label">Mobile</div>
                        <div className="info-content center-text">{billedPhone}</div>
                    </div>
                    <div className="info-box gst-no">
                        <div className="info-label">GST No.</div>
                        <div className="info-content">{studio.gstin || '-'}</div>
                    </div>
                    <div className="info-box event-box">
                        <div className="info-label">Event</div>
                        <div className="info-content"></div>
                    </div>
                    <div className="info-box couple-box">
                        <div className="info-label">Couple Name</div>
                        <div className="info-content">{order.coupleName || 'birthday'}</div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="items-table-print">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>Sr. No.</th>
                            <th style={{ width: '40%' }}>Item Name</th>
                            <th style={{ width: '10%' }}>HSN</th>
                            <th style={{ width: '8%' }}>Qty</th>
                            <th style={{ width: '10%' }}>Rate</th>
                            <th style={{ width: '10%' }}>Amount</th>
                            <th style={{ width: '10%' }}>Disc. Amount</th>
                            <th style={{ width: '12%' }}>Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="order-id-row">
                            <td colSpan="8" className="bold-text underline-text">{order.orderId}</td>
                        </tr>
                        {(order.categories || []).map((cat, idx) => {
                            const catId = (cat._id || cat).toString();
                            const qty = (order.categoryQuantities && order.categoryQuantities[catId]) || 1;
                            const rate = (order.categoryPrices && order.categoryPrices[catId]) || (order.isParty ? (cat.partyPrice || cat.price || cat.basePrice || 0) : (cat.price || cat.basePrice || 0));
                            const amount = rate * qty;
                            const disc = idx === 0 ? discountAmount : 0; // Show total discount on first item or split it? Image shows it per item but usually it's overall.
                            const total = amount - disc;

                            return (
                                <tr key={idx} className="item-row-print">
                                    <td className="center-text">{idx + 1}</td>
                                    <td>{cat.name}</td>
                                    <td className="center-text">{cat.hsnCode || '-'}</td>
                                    <td className="center-text">{qty}</td>
                                    <td className="right-text">{rate > 0 ? rate.toFixed(2) : '-'}</td>
                                    <td className="right-text">{amount > 0 ? amount.toFixed(2) : '-'}</td>
                                    <td className="right-text">{disc > 0 ? disc.toFixed(2) : '-'}</td>
                                    <td className="right-text">{total > 0 ? total.toFixed(2) : '-'}</td>
                                </tr>
                            );
                        })}
                        {/* Empty rows to maintain height */}
                        {[...Array(Math.max(0, 5 - (order.categories?.length || 0)))].map((_, i) => (
                            <tr key={`empty-${i}`} className="empty-row-print">
                                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary Section */}
                <div className="summary-section-new">
                    <div className="summary-left">
                        <div className="subtotal-row">
                            <span className="label">Sub Total - A</span>
                            <span className="separator">:</span>
                            <span className="value bold-text">{totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="subtotal-row">
                            <span className="label">Additional Amount</span>
                            <span className="separator">:</span>
                            <span className="value">-</span>
                        </div>
                        <div className="subtotal-row">
                            <span className="label">Discount Amount</span>
                            <span className="separator">:</span>
                            <span className="value">{discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="subtotal-row">
                            <span className="label">Sub Total - B</span>
                            <span className="separator">:</span>
                            <span className="value bold-text">{(totalAmount - discountAmount).toFixed(2)}</span>
                        </div>

                        <table className="tax-details-table">
                            <thead>
                                <tr>
                                    <th>Tax Type</th>
                                    <th>Tax %</th>
                                    <th>Tax Amt.</th>
                                    <th>Goods Amt</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>CGST</td>
                                    <td className="center-text">{taxPercent > 0 ? (taxPercent / 2) : '-'}</td>
                                    <td className="right-text">{taxAmount > 0 ? (taxAmount / 2).toFixed(2) : '-'}</td>
                                    <td className="right-text">{taxableAmount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>SGST</td>
                                    <td className="center-text">{taxPercent > 0 ? (taxPercent / 2) : '-'}</td>
                                    <td className="right-text">{taxAmount > 0 ? (taxAmount / 2).toFixed(2) : '-'}</td>
                                    <td className="right-text">{taxableAmount.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Payment QR Code */}
                        {studio.qrCode && (
                            <div className="payment-qr-section">
                                <p className="qr-label">Scan to Pay</p>
                                <img src={getFileUrl(studio.qrCode)} alt="Payment QR" className="payment-qr-img" />
                            </div>
                        )}
                    </div>

                    <div className="summary-right">
                        <div className="total-row">
                            <span className="label">Total Tax Amount</span>
                            <span className="separator">:</span>
                            <span className="value">{taxAmount > 0 ? taxAmount.toFixed(2) : '-'}</span>
                        </div>
                        <div className="total-row large-text">
                            <span className="label">Total Amount</span>
                            <span className="separator">:</span>
                            <span className="value bold-text">{netInvoiceAmt.toFixed(2)}</span>
                        </div>
                        <div className="total-row">
                            <span className="label">Round Off</span>
                            <span className="separator">:</span>
                            <span className="value">{roundOff.toFixed(2)}</span>
                        </div>
                        <div className="total-row large-text highlight-row">
                            <span className="label">Net Invoice Amt.</span>
                            <span className="separator">:</span>
                            <span className="value bold-text">{finalNetAmt.toFixed(2)}</span>
                        </div>
                        <div className="total-row divider-top">
                            <span className="label">Pre. Balance Amt.</span>
                            <span className="separator">:</span>
                            <span className="value">{preBalance > 0 ? preBalance.toFixed(2) : '-'}</span>
                        </div>
                        <div className="total-row">
                            <span className="label">Total Balance Amt.</span>
                            <span className="separator">:</span>
                            <span className="value">{totalBalance > 0 ? totalBalance.toFixed(2) : '-'}</span>
                        </div>
                        <div className="total-row">
                            <span className="label">Recd. Amount</span>
                            <span className="separator">:</span>
                            <span className="value">{advancePaid > 0 ? advancePaid.toFixed(2) : '-'}</span>
                        </div>
                        <div className="total-row divider-top large-text">
                            <span className="label">Remaining Balance</span>
                            <span className="separator">:</span>
                            <span className="value bold-text">{remainingBalance.toFixed(2)} Dr</span>
                        </div>
                        
                        <div className="authorized-signatory">
                            <div className="sign-line"></div>
                            <div className="sign-label">Authorized Signatory</div>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="invoice-footer-new">
                    <div className="footer-left">
                        Counter: Binding
                    </div>
                    <div className="footer-right">
                        By {createdBy} on {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {orderCreateTime.split(' ')[1]} Printed by {printedBy} on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {printTime.split(' ')[1]}
                    </div>
                </div>
                <div className="system-tag">
                    A Marv Systems Product +91-8090842211
                </div>
            </div>
        </div>
    );
};

export default TaxInvoiceReceipt;
