import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlineCurrencyRupee, HiOutlineCash, HiOutlineDocumentReport, HiOutlineChartPie, HiOutlineDownload, HiOutlineFilter } from 'react-icons/hi';
import * as XLSX from 'xlsx';
import './RevenueDashboard.css';

const RevenueDashboard = () => {
    const [stats, setStats] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');
    
    // Default to first day of current month to today
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    useEffect(() => {
        fetchRevenueData();
    }, [startDate, endDate]);

    const fetchRevenueData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);
            
            const [statsRes, exportRes] = await Promise.all([
                API.get(`/orders/revenue?${queryParams.toString()}`),
                API.get(`/orders/revenue-export?${queryParams.toString()}`)
            ]);
            
            if (statsRes.data.success) {
                setStats(statsRes.data);
            }
            if (exportRes.data.orders) {
                setOrders(exportRes.data.orders);
            }
        } catch (err) {
            setError('Failed to fetch revenue statistics');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ===== EXCEL EXPORT =====
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const wb = XLSX.utils.book_new();

            // ---- Sheet 1: Summary ----
            const summaryData = [
                ['Revenue Summary Report'],
                ['Period', `${startDate || 'All Time'} to ${endDate || 'Today'}`],
                ['Generated On', new Date().toLocaleString('en-IN')],
                [],
                ['Metric', 'Amount (₹)'],
                ['Gross Revenue', stats?.totalBillings || 0],
                ['Total Discounts Given', stats?.totalDiscount || 0],
                ['Net Taxable Amount', (stats?.totalBillings || 0) - (stats?.totalDiscount || 0)],
                ['Tax Collected', stats?.totalTaxCollected || 0],
                ['Final Invoice Value', (stats?.totalBillings || 0) - (stats?.totalDiscount || 0) + (stats?.totalTaxCollected || 0)],
                [],
                ['Advance / Collected', stats?.totalAdvance || 0],
                ['Pending Balance Due', stats?.pendingBalance || 0],
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            // ---- Sheet 2: Orders Detail ----
            const detailHeaders = [
                'Order ID', 'Customer Name', 'Phone', 'Categories', 'Status', 'Gross Amount (₹)',
                'Discount (₹)', 'Net Total (₹)', 'Advance Paid (₹)', 'Balance Due (₹)', 'Date'
            ];
            const detailRows = orders.map(o => {
                const amount = o.totalAmount || 0;
                const discount = o.discount || 0;
                const taxableAmount = Math.max(0, amount - discount);
                const taxAmount = Math.round((taxableAmount * (o.tax || 0)) / 100);
                const finalTotal = taxableAmount + taxAmount;
                const advance = o.advancePayment || 0;
                
                return [
                    o.orderId, o.customerName, o.customerPhone,
                    typeof o.categories === 'string' ? o.categories : o.categories?.map(c=>c.name).join(', '), 
                    o.status, amount, discount, finalTotal, advance, Math.max(0, finalTotal - advance), 
                    new Date(o.createdAt || o.date).toLocaleDateString()
                ];
            });
            const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
            wsDetail['!cols'] = detailHeaders.map((h, i) => ({ wch: i < 4 ? 22 : 16 }));
            XLSX.utils.book_append_sheet(wb, wsDetail, 'Orders Detail');

            XLSX.writeFile(wb, `Revenue_Report_${startDate}_to_${endDate}.xlsx`);
        } catch (err) {
            console.error('Export failed', err);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    if (error) {
        return (
            <div className="revenue-dashboard fade-in">
                <div className="page-header">
                    <h1>Revenue Dashboard</h1>
                </div>
                <div className="alert alert-error">{error}</div>
            </div>
        );
    }

    const {
        totalBillings = 0,
        totalAdvance = 0,
        totalDiscount = 0,
        totalTaxCollected = 0,
        pendingBalance = 0
    } = stats || {};

    const collectionRate = totalBillings > 0
        ? Math.round((totalAdvance / (totalBillings + totalTaxCollected - totalDiscount)) * 100)
        : 0;

    return (
        <div className="revenue-dashboard fade-in">
            {/* Header section hidden in print */}
            <div className="page-header no-print">
                <div>
                    <h1>Revenue & Analytics</h1>
                    <p className="revenue-subtitle">Financial insights, collections overview, and detailed billing</p>
                </div>
                <div className="revenue-actions-group">
                    <div className="date-filter-group">
                        <div className="date-input-wrapper">
                            <span className="date-label">From:</span>
                            <input 
                                type="date" 
                                className="date-input" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                            />
                        </div>
                        <div className="date-input-wrapper">
                            <span className="date-label">To:</span>
                            <input 
                                type="date" 
                                className="date-input" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                            />
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => window.print()} title="Print Billing PDF">
                        <HiOutlineDocumentReport /> Print PDF
                    </button>
                    <button className="btn btn-primary" onClick={handleExportExcel} disabled={exporting}>
                        <HiOutlineDownload /> {exporting ? 'Exporting...' : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="print-header">
                <div className="print-brand">
                    <h2>PhotoStudio Premium</h2>
                    <p>Financial Revenue & Billing Report</p>
                </div>
                <div className="print-meta">
                    <p><strong>Period:</strong> {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</p>
                    <p><strong>Generated On:</strong> {new Date().toLocaleString()}</p>
                </div>
            </div>

            {loading ? (
                <LoadingSpinner text="Analyzing Revenue Data..." />
            ) : (
                <>
                    <div className="revenue-cards-grid">
                        <div className="rev-card glass-card primary-gradient">
                            <div className="rev-card__icon">
                                <HiOutlineChartPie />
                            </div>
                            <div className="rev-card__content">
                                <h3>Total Gross Billings</h3>
                                <div className="rev-card__value">₹{totalBillings.toLocaleString('en-IN')}</div>
                                <p className="rev-card__footer">Before tax and discounts</p>
                            </div>
                        </div>

                        <div className="rev-card glass-card success-gradient">
                            <div className="rev-card__icon">
                                <HiOutlineCash />
                            </div>
                            <div className="rev-card__content">
                                <h3>Advance &amp; Collected</h3>
                                <div className="rev-card__value">₹{totalAdvance.toLocaleString('en-IN')}</div>
                                <p className="rev-card__footer">{collectionRate}% Collection Rate</p>
                            </div>
                        </div>

                        <div className="rev-card glass-card warning-gradient">
                            <div className="rev-card__icon">
                                <HiOutlineCurrencyRupee />
                            </div>
                            <div className="rev-card__content">
                                <h3>Pending Balance Due</h3>
                                <div className="rev-card__value">₹{pendingBalance.toLocaleString('en-IN')}</div>
                                <p className="rev-card__footer">Awaiting collection</p>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-split">
                        <div className="revenue-details-container glass-card">
                            <div className="revenue-details-header">
                                <h2>Financial Breakdown</h2>
                            </div>
                            <div className="revenue-details-body">
                                <div className="breakdown-item">
                                    <span className="breakdown-label">Gross Revenue</span>
                                    <span className="breakdown-amount">₹{totalBillings.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="breakdown-item text-danger">
                                    <span className="breakdown-label">Total Discounts Given</span>
                                    <span className="breakdown-amount">- ₹{totalDiscount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="breakdown-item breakdown-subtotal">
                                    <span className="breakdown-label">Net Taxable Amount</span>
                                    <span className="breakdown-amount">₹{(totalBillings - totalDiscount).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="breakdown-item text-muted">
                                    <span className="breakdown-label">Tax Collected (Estimated)</span>
                                    <span className="breakdown-amount">+ ₹{totalTaxCollected.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="breakdown-item breakdown-total">
                                    <span className="breakdown-label">Final Invoice Value</span>
                                    <span className="breakdown-amount highlight">
                                        ₹{(totalBillings - totalDiscount + totalTaxCollected).toLocaleString('en-IN')}
                                    </span>
                                </div>

                                <div className="breakdown-separator"></div>

                                <div className="breakdown-item text-success">
                                    <span className="breakdown-label">Collected / Advance Paid</span>
                                    <span className="breakdown-amount">- ₹{totalAdvance.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="breakdown-item breakdown-total">
                                    <span className="breakdown-label">Pending Balance to Collect</span>
                                    <span className="breakdown-amount pending-highlight">
                                        ₹{pendingBalance.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="revenue-orders-container glass-card">
                            <div className="revenue-details-header">
                                <h2>Related Orders ({orders.length})</h2>
                            </div>
                            <div className="table-wrapper print-table">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Customer</th>
                                            <th>Date</th>
                                            <th>Total</th>
                                            <th>Advance</th>
                                            <th>Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.length > 0 ? orders.map((order, idx) => {
                                            const amount = order.totalAmount || 0;
                                            const discount = order.discount || 0;
                                            const taxableAmount = Math.max(0, amount - discount);
                                            const taxAmount = Math.round((taxableAmount * (order.tax || 0)) / 100);
                                            const finalTotal = taxableAmount + taxAmount;
                                            const advance = order.advancePayment || 0;
                                            const balance = Math.max(0, finalTotal - advance);
                                            
                                            // Handle dates that come from getRevenueExport mapping
                                            const orderDate = new Date(order.createdAt || order.date);
                                            
                                            return (
                                                <tr key={order._id || idx}>
                                                    <td><strong>{order.orderId}</strong></td>
                                                    <td>
                                                        <div>{order.customerName || (order.customer && order.customer.name)}</div>
                                                    </td>
                                                    <td>{orderDate.toLocaleDateString()}</td>
                                                    <td>₹{finalTotal.toLocaleString()}</td>
                                                    <td className="text-success">₹{advance.toLocaleString()}</td>
                                                    <td className={balance > 0 ? 'text-danger fw-bold' : ''}>
                                                        ₹{balance.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan="6" className="text-center text-muted py-4">
                                                    No orders found in this date range.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RevenueDashboard;
