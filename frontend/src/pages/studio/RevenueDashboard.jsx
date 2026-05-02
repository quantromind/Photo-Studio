import { useState, useEffect } from 'react';
import API from '../../api/axios';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { HiOutlineCurrencyRupee, HiOutlineCash, HiOutlineDocumentReport, HiOutlineChartPie, HiOutlineDownload, HiOutlineFilter, HiOutlineTrendingUp } from 'react-icons/hi';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './RevenueDashboard.css';

const CHART_COLORS = ['#6C63FF', '#00D4AA', '#FFA726', '#FF5252', '#9C27B0', '#03A9F4', '#4CAF50', '#607D8B'];

const RevenueDashboard = () => {
    const [stats, setStats] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [error, setError] = useState('');
    const [pieMode, setPieMode] = useState('category'); // 'category' or 'monthly'
    
    // Helper to get local date as yyyy-mm-dd (avoids IST→UTC shift from toISOString)
    const toLocalDateStr = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // Default to first day of current month to today
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return toLocalDateStr(d);
    });
    const [endDate, setEndDate] = useState(() => {
        return toLocalDateStr(new Date());
    });

    useEffect(() => {
        fetchRevenueData();
    }, [startDate, endDate]);

    const setQuickFilter = (type) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
                start = now;
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case 'lastMonth':
                start.setMonth(now.getMonth() - 1);
                start.setDate(1);
                end.setMonth(now.getMonth() - 1);
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                end.setDate(lastDay.getDate());
                break;
            case 'thisYear':
                start.setMonth(0, 1);
                break;
            case 'allTime':
                start = new Date(2020, 0, 1); // Or any logical start
                break;
            default:
                break;
        }

        setStartDate(toLocalDateStr(start));
        setEndDate(toLocalDateStr(end));
    };

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

    // Custom Tooltip for Trend Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-chart-tooltip">
                    <p className="label">{new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="intro">Revenue: <span className="value">₹{payload[0].value.toLocaleString()}</span></p>
                    <p className="desc">Orders: {payload[0].payload.orders}</p>
                </div>
            );
        }
        return null;
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

            // ---- Sheet 3: Categories (NEW) ----
            if (stats?.categoryData) {
                const catHeaders = ['Category', 'Revenue (₹)'];
                const catRows = stats.categoryData.map(c => [c.name, c.value]);
                const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
                XLSX.utils.book_append_sheet(wb, wsCat, 'Category Breakdown');
            }

            // ---- Sheet 2: Orders Detail ----
            const detailHeaders = [
                'Order ID', 'Customer Name', 'Phone', 'Categories', 'Status', 'Gross Amount (₹)',
                'Discount (₹)', 'Net Total (₹)', 'Advance Paid (₹)', 'Balance Due (₹)', 'Date'
            ];
            const detailRows = orders.map(o => {
                return [
                    o.orderId, o.customerName, o.customerPhone,
                    o.categories, 
                    o.status, o.grossAmount || 0, o.discount || 0, o.finalInvoice || 0, o.advancePaid || 0, o.balanceDue || 0, 
                    o.createdAt
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

    // ===== PDF GENERATION =====
    const handleGeneratePdf = () => {
        setGeneratingPdf(true);
        try {
            const doc = new jsPDF();
            
            // Branding/Header
            doc.setFillColor(41, 128, 185); // Professional blue
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text("PhotoStudio Premium", 15, 20);
            
            // Sub-header
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(16);
            doc.text("Revenue & Analytics Report", 15, 45);
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Period: ${startDate} to ${endDate}`, 15, 55);
            doc.text(`Generated On: ${new Date().toLocaleString()}`, 15, 62);
            
            // Format Currency
            const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString('en-IN')}`;

            // Financial Summary Block
            autoTable(doc, {
                startY: 70,
                head: [['Financial Summary', 'Amount']],
                body: [
                    ['Gross Revenue (Before tax & discount)', formatCurrency(stats?.totalBillings)],
                    ['Discounts Given', formatCurrency(stats?.totalDiscount)],
                    ['Net Taxable Amount', formatCurrency((stats?.totalBillings || 0) - (stats?.totalDiscount || 0))],
                    ['Tax Collected (Estimated)', formatCurrency(stats?.totalTaxCollected)],
                    ['Final Invoice Value', formatCurrency((stats?.totalBillings || 0) - (stats?.totalDiscount || 0) + (stats?.totalTaxCollected || 0))],
                    ['Advance / Collected Amount', formatCurrency(stats?.totalAdvance)],
                    ['Pending Balance Due', formatCurrency(stats?.pendingBalance)]
                ],
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                styles: { fontSize: 10, cellPadding: 5 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
            });

            // Orders Details
            const orderRows = orders.map(o => {
                return [
                    o.orderId,
                    o.customerName || '-',
                    o.createdAt,
                    formatCurrency(o.finalInvoice || 0),
                    formatCurrency(o.advancePaid || 0),
                    formatCurrency(o.balanceDue || 0)
                ];
            });

            if (orderRows.length > 0) {
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 15,
                    head: [['Order ID', 'Customer', 'Date', 'Total', 'Advance', 'Balance']],
                    body: orderRows,
                    theme: 'striped',
                    headStyles: { fillColor: [52, 73, 94], textColor: 255 },
                    styles: { fontSize: 9 },
                    columnStyles: { 
                        3: { halign: 'right' }, 
                        4: { halign: 'right' }, 
                        5: { halign: 'right', fontStyle: 'bold' } 
                    }
                });
            } else {
                doc.setFontSize(11);
                doc.text("No orders found for this period.", 15, doc.lastAutoTable.finalY + 20);
            }

            // Direct download
            doc.save(`Revenue_Report_${startDate}_to_${endDate}.pdf`);

        } catch (err) {
            console.error('PDF Generation failed', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setGeneratingPdf(false);
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
        pendingBalance = 0,
        timeSeriesData = [],
        categoryData = [],
        monthlyData = []
    } = stats || {};

    const collectionRate = totalBillings > 0
        ? Math.round((totalAdvance / (totalBillings + totalTaxCollected - totalDiscount)) * 100)
        : 0;

    const activeChartData = pieMode === 'category' ? categoryData : monthlyData;

    return (
        <div className="revenue-dashboard fade-in">
            {/* Header section hidden in print */}
            <div className="page-header no-print">
                <div>
                    <h1>Revenue & Analytics</h1>
                    <p className="revenue-subtitle">Financial insights, collections overview, and detailed billing</p>
                </div>
                <div className="revenue-actions-group">
                    <div className="quick-filters no-print">
                        <button className="btn-filter" onClick={() => setQuickFilter('today')}>Today</button>
                        <button className="btn-filter" onClick={() => setQuickFilter('thisMonth')}>This Month</button>
                        <button className="btn-filter" onClick={() => setQuickFilter('lastMonth')}>Last Month</button>
                        <button className="btn-filter" onClick={() => setQuickFilter('thisYear')}>This Year</button>
                    </div>
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
                    <button className="btn btn-secondary" onClick={handleGeneratePdf} disabled={generatingPdf} title="Download PDF Report">
                        <HiOutlineDocumentReport /> {generatingPdf ? 'Generating...' : 'Download PDF'}
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

                    {/* ===== CHARTS SECTION ===== */}
                    <div className="revenue-charts-grid">
                        <div className="chart-card glass-card">
                            <div className="chart-header">
                                <HiOutlineTrendingUp className="text-primary" />
                                <h3>Revenue Trend (Daily)</h3>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={timeSeriesData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#999', fontSize: 11 }}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        />
                                        <YAxis 
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#999', fontSize: 11 }}
                                            tickFormatter={(val) => `₹${val/1000}k`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="revenue" 
                                            stroke="#6C63FF" 
                                            fillOpacity={1} 
                                            fill="url(#colorRevenue)" 
                                            strokeWidth={3}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="chart-card glass-card">
                            <div className="chart-header">
                                <div className="chart-header-with-toggle">
                                    <div className="flex-align-center gap-2">
                                        <HiOutlineChartPie className="text-accent" />
                                        <h3>Distribution Breakdown</h3>
                                    </div>
                                    <div className="pie-toggle-group">
                                        <button 
                                            className={`pie-toggle-btn ${pieMode === 'category' ? 'active' : ''}`}
                                            onClick={() => setPieMode('category')}
                                        >
                                            Category
                                        </button>
                                        <button 
                                            className={`pie-toggle-btn ${pieMode === 'monthly' ? 'active' : ''}`}
                                            onClick={() => setPieMode('monthly')}
                                        >
                                            Monthly
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="chart-wrapper pie-chart-wrapper">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={activeChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={95}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        >
                                            {activeChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
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
                                            return (
                                                <tr key={order.orderId || idx}>
                                                    <td><strong>{order.orderId}</strong></td>
                                                    <td>
                                                        <div>{order.customerName || '-'}</div>
                                                    </td>
                                                    <td>{order.createdAt}</td>
                                                    <td>₹{Number(order.finalInvoice || 0).toLocaleString('en-IN')}</td>
                                                    <td className="text-success">₹{Number(order.advancePaid || 0).toLocaleString('en-IN')}</td>
                                                    <td className={order.balanceDue > 0 ? 'text-danger fw-bold' : ''}>
                                                        ₹{Number(order.balanceDue || 0).toLocaleString('en-IN')}
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
