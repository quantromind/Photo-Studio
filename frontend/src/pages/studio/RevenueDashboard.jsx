import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlineCurrencyRupee, HiOutlineCash, HiOutlineDocumentReport, HiOutlineChartPie, HiOutlineDownload } from 'react-icons/hi';
import * as XLSX from 'xlsx';
import './RevenueDashboard.css';

const RevenueDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchRevenueStats();
    }, []);

    const fetchRevenueStats = async () => {
        try {
            const res = await API.get('/orders/revenue');
            if (res.data.success) {
                setStats(res.data);
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
            const res = await API.get('/orders/revenue-export');
            const orders = res.data.orders || [];

            const wb = XLSX.utils.book_new();

            // ---- Sheet 1: Summary ----
            const summaryData = [
                ['Revenue Summary Report'],
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
                'Order ID', 'Customer Name', 'Phone', 'Email',
                'Category', 'Status', 'Gross Amount (₹)',
                'Discount (₹)', 'Tax %', 'Tax Amount (₹)',
                'Final Invoice (₹)', 'Advance Paid (₹)', 'Balance Due (₹)', 'Date'
            ];
            const detailRows = orders.map(o => [
                o.orderId, o.customerName, o.customerPhone, o.customerEmail,
                o.categories, o.status, o.grossAmount,
                o.discount, o.taxPercent, o.taxAmount,
                o.finalInvoice, o.advancePaid, o.balanceDue, o.createdAt
            ]);
            const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
            wsDetail['!cols'] = detailHeaders.map((h, i) => ({ wch: i < 4 ? 22 : 16 }));
            XLSX.utils.book_append_sheet(wb, wsDetail, 'Orders Detail');

            // Trigger download
            XLSX.writeFile(wb, `Revenue_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error('Export failed', err);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <LoadingSpinner text="Analyzing Revenue Data..." />;

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

    // Default to 0 if null
    const {
        totalBillings = 0,
        totalAdvance = 0,
        totalDiscount = 0,
        totalTaxCollected = 0,
        pendingBalance = 0
    } = stats || {};

    // For a beautiful visual, calculate collection percentage
    const collectionRate = totalBillings > 0
        ? Math.round((totalAdvance / (totalBillings + totalTaxCollected - totalDiscount)) * 100)
        : 0;

    return (
        <div className="revenue-dashboard fade-in">
            <div className="page-header">
                <div>
                    <h1>Revenue Dashboard</h1>
                    <p className="revenue-subtitle">Financial insights and collections overview</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => window.print()} title="Print Report">
                        <HiOutlineDocumentReport /> Print
                    </button>
                    <button className="btn btn-primary" onClick={handleExportExcel} disabled={exporting}>
                        <HiOutlineDownload /> {exporting ? 'Exporting...' : 'Export to Excel'}
                    </button>
                </div>
            </div>

            <div className="revenue-cards-grid">
                {/* Total Billings Card */}
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

                {/* Collected Amount Card */}
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

                {/* Pending Balance Card */}
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

        </div>
    );
};

export default RevenueDashboard;
