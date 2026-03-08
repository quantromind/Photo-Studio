import { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import { HiOutlinePlus, HiOutlineArrowRight, HiOutlinePhotograph, HiOutlineTrash, HiOutlineShare, HiOutlineEye, HiOutlineClipboardCopy, HiOutlineExclamationCircle, HiOutlineCurrencyRupee, HiOutlinePrinter } from 'react-icons/hi';
import './OrdersPage.css';

const PAGE_SIZE = 10;

const ALL_STATUSES = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered', 'completed'];
const STATUS_LABELS = {
    reception: 'Reception', designing: 'Designing', printing: 'Printing',
    binding: 'Binding', quality_check: 'Quality Check', delivered: 'Delivered', completed: 'Completed'
};

// Helper component for SLA Progress Bar
const SlaProgressBar = ({ createdAt, estimatedCompletion, status }) => {
    if (!estimatedCompletion || status === 'completed' || status === 'delivered') return null;

    const start = new Date(createdAt).getTime();
    const end = new Date(estimatedCompletion).getTime();
    const now = Date.now();

    const totalDuration = end - start;
    const elapsed = now - start;
    let progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

    let colorClass = 'progress-normal';
    if (progress > 85) colorClass = 'progress-critical';
    else if (progress > 60) colorClass = 'progress-warning';

    const isOverdue = now > end;

    return (
        <div className="sla-progress-wrapper" title={isOverdue ? "SLA Overdue!" : "Time elapsed"}>
            <div className="sla-progress-bar">
                <div className={`sla-progress-fill ${colorClass}`} style={{ width: `${isOverdue ? 100 : progress}%` }}></div>
            </div>
            <small className={`sla-text ${isOverdue ? 'text-critical' : ''}`}>
                {isOverdue ? 'Overdue!' : `${Math.round(progress)}% elapsed`}
            </small>
        </div>
    );
};

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showBillingModal, setShowBillingModal] = useState(null);
    const [filter, setFilter] = useState('active'); // Default to Active
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [slaWarning, setSlaWarning] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [advancingStatus, setAdvancingStatus] = useState(null);
    const [tabCounts, setTabCounts] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [billingData, setBillingData] = useState({ totalAmount: 0, advancePayment: 0, discount: 0, tax: 0 });
    const [printInvoiceData, setPrintInvoiceData] = useState(null);
    const [formData, setFormData] = useState({
        customerName: '', customerEmail: '', customerPhone: '',
        categoryIds: [], notes: '', totalAmount: ''
    });

    useEffect(() => {
        fetchOrders();
        setSearchQuery(''); // Clear search when tab changes
        setCurrentPage(1);  // Reset pagination on tab change
    }, [filter]);

    useEffect(() => {
        fetchCategories();
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await API.get('/orders/stats');
            const d = res.data;
            setTabCounts({
                active: d.activeCount || 0,
                deadline: d.deadlineCount || 0,
                overdue: d.overdueCount || 0,
                history: d.historyCount || 0,
                ...(d.statusCounts || {})
            });
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    };

    const fetchOrders = async () => {
        try {
            const url = `/orders?status=${filter}`;
            const res = await API.get(url);
            setOrders(res.data.orders);

            // Check for SLA expiring soon in Active view
            if (filter === 'active' || filter === '') {
                const now = Date.now();
                const twoHours = 2 * 60 * 60 * 1000;
                const expiringOrders = res.data.orders.filter(o => {
                    if (!o.estimatedCompletion || o.status === 'completed' || o.status === 'delivered') return false;
                    const timeLeft = new Date(o.estimatedCompletion).getTime() - now;
                    return timeLeft > 0 && timeLeft < twoHours;
                });

                const overdueOrders = res.data.orders.filter(o => {
                    if (!o.estimatedCompletion || o.status === 'completed' || o.status === 'delivered') return false;
                    return new Date(o.estimatedCompletion).getTime() < now;
                });

                if (overdueOrders.length > 0) {
                    const msg = `⚠️ WARNING: ${overdueOrders.length} order(s) are OVERDUE!`;
                    setSlaWarning(msg);
                } else if (expiringOrders.length > 0) {
                    const msg = `⏱️ Alert: ${expiringOrders.length} order(s) are nearing their deadline (< 2 hrs remaining).`;
                    setSlaWarning(msg);
                } else {
                    setSlaWarning('');
                }
            } else {
                setSlaWarning('');
            }

            // Refresh stats whenever orders fetch (to keep counts live)
            fetchStats();

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await API.get('/categories');
            setCategories(res.data.categories);
        } catch (err) {
            console.error(err);
        }
    };

    // ===== CREATE ORDER =====
    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(''); setSuccess('');
        try {
            await API.post('/orders', formData);
            setSuccess('✅ Order created successfully!');
            setShowModal(false);
            setFormData({ customerName: '', customerEmail: '', customerPhone: '', categoryIds: [], notes: '', totalAmount: '' });
            fetchOrders();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create order');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    // ===== UPDATE BILLING =====
    const handleUpdateBilling = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(''); setSuccess('');
        try {
            await API.put(`/orders/${showBillingModal._id}/billing`, billingData);
            setSuccess(`✅ Billing info updated for Order ${showBillingModal.orderId}`);
            setShowBillingModal(null);
            fetchOrders();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update billing');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    // ===== STATUS CHANGE (with confirmation) =====
    const handleAdvanceStatus = async (order, targetStatus) => {
        if (advancingStatus) return;
        setAdvancingStatus(order._id);
        setError(''); setSuccess('');
        try {
            const body = targetStatus ? { targetStatus } : {};
            await API.put(`/orders/${order._id}/status`, body);
            const newStatus = targetStatus || ALL_STATUSES[ALL_STATUSES.indexOf(order.status) + 1];
            setSuccess(`✅ Order ${order.orderId} moved to ${STATUS_LABELS[newStatus]}`);
            setShowStatusModal(null);
            fetchOrders();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update status');
            setTimeout(() => setError(''), 5000);
        } finally {
            setAdvancingStatus(null);
        }
    };

    // ===== IMAGE UPLOAD =====
    const handleUploadImages = async (orderId) => {
        if (uploading || selectedFiles.length === 0) return;
        setUploading(true);
        setError('');
        try {
            const formData = new FormData();
            selectedFiles.forEach(f => formData.append('images', f));
            await API.post(`/images/upload/${orderId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess(`✅ ${selectedFiles.length} image(s) uploaded successfully!`);
            setSelectedFiles([]);
            setShowUploadModal(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchOrders();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload images');
            setTimeout(() => setError(''), 5000);
        } finally {
            setUploading(false);
        }
    };

    // ===== DELETE ORDER =====
    const handleDeleteOrder = async (orderId, orderNum) => {
        if (!window.confirm(`Are you sure you want to delete order ${orderNum}? This cannot be undone.`)) return;
        try {
            await API.delete(`/orders/${orderId}`);
            setSuccess(`✅ Order ${orderNum} deleted`);
            fetchOrders();
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete order');
            setTimeout(() => setError(''), 5000);
        }
    };

    // ===== COPY SHARE LINK =====
    const handleCopyShareLink = (orderId) => {
        const link = `${window.location.origin}/album/${orderId}`;
        navigator.clipboard.writeText(link).then(() => {
            setSuccess(`✅ Album link copied: ${link}`);
            setTimeout(() => setSuccess(''), 4000);
        });
    };

    const statuses = ['active', 'deadline', 'overdue', 'history', ...ALL_STATUSES.filter(s => s !== 'completed')];

    // ===== QUICK PRINT INVOICE =====
    const handleQuickPrint = (order) => {
        setPrintInvoiceData({
            order,
            billing: {
                totalAmount: order.totalAmount || 0,
                advancePayment: order.advancePayment || 0,
                discount: order.discount || 0,
                tax: order.tax || 0
            }
        });
    };

    useEffect(() => {
        if (printInvoiceData) {
            const timer = setTimeout(() => {
                window.print();
                setPrintInvoiceData(null);
            }, 300); // Wait for React to render the printable area
            return () => clearTimeout(timer);
        }
    }, [printInvoiceData]);

    if (loading) return <LoadingSpinner text="Loading orders..." />;

    // Client-side search filter — works within current tab
    const q = searchQuery.toLowerCase().trim();
    const filteredOrders = q
        ? orders.filter(o =>
            o.orderId?.toLowerCase().includes(q) ||
            o.customer?.name?.toLowerCase().includes(q) ||
            o.customer?.phone?.includes(q) ||
            o.customer?.email?.toLowerCase().includes(q)
        )
        : orders;

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // Determine which order is being printed via modal or quick-print
    const invoiceOrder = printInvoiceData ? printInvoiceData.order : showBillingModal;
    const currentBillingData = printInvoiceData ? printInvoiceData.billing : billingData;

    return (
        <div className="orders-page fade-in">
            {/* ===== PRINT ONLY INVOICE ===== */}
            {invoiceOrder && invoiceOrder.studio && (
                <div className="print-only">
                    <div className="invoice-header">
                        <div className="invoice-top-bar">
                            <div style={{ width: '30%' }}></div>
                            <div className="invoice-title-main">TAX INVOICE</div>
                            <div className="invoice-meta">
                                <div>INVOICE NO: {invoiceOrder.orderId}</div>
                                <div>DATE: {new Date().toLocaleDateString('en-GB')}</div>
                            </div>
                        </div>
                        <div className="invoice-studio-details">
                            <div className="invoice-logo-box">
                                {invoiceOrder.studio.logo ? (
                                    <img src={`https://photostudio.nakshatratechnologies.in${invoiceOrder.studio.logo}`} alt="Logo" />
                                ) : (
                                    <span>Insert Your<br />LOGO</span>
                                )}
                            </div>
                            <div className="invoice-address-box">
                                <h1>{invoiceOrder.studio.name}</h1>
                                {invoiceOrder.studio.address && <p>ADDRESS: {invoiceOrder.studio.address}</p>}
                                {invoiceOrder.studio.phone && <p>Phone: {invoiceOrder.studio.phone} {invoiceOrder.studio.email ? `| ${invoiceOrder.studio.email}` : ''}</p>}
                                {invoiceOrder.studio.gstin && <p>GSTIN: {invoiceOrder.studio.gstin}</p>}
                                {invoiceOrder.studio.pan && <p>PAN NO: {invoiceOrder.studio.pan}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="invoice-header invoice-party-details">
                        <strong>PARTY'S NAME:</strong> {invoiceOrder.customer?.name} <br />
                        {invoiceOrder.customer?.phone && <>Phone: {invoiceOrder.customer.phone} <br /></>}
                        {invoiceOrder.customer?.email && <>Email: {invoiceOrder.customer.email} <br /></>}
                        <br />
                    </div>

                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Particulars (Descriptions & Specifications)</th>
                                <th>HSN / SAC Code</th>
                                <th>Qty</th>
                                <th>Rate (₹)</th>
                                <th>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ height: '300px', verticalAlign: 'top' }}>
                                <td>
                                    <strong>{invoiceOrder.categories?.map(c => c.name).join(', ')}</strong> <br />
                                    <span style={{ color: '#555', fontSize: '12px' }}>{invoiceOrder.notes}</span>
                                </td>
                                <td>-</td>
                                <td>1</td>
                                <td>{currentBillingData.totalAmount}</td>
                                <td>{currentBillingData.totalAmount}</td>
                            </tr>
                            <tr style={{ fontWeight: 'bold' }}>
                                <td colSpan="3" rowSpan="3" style={{ border: 'none', borderRight: '1px solid black' }}>
                                    {invoiceOrder.studio.bankDetails && (
                                        <div style={{ fontSize: '11px', marginTop: '20px' }}>
                                            <u>Bank Details:</u><br />
                                            {invoiceOrder.studio.bankDetails.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                        </div>
                                    )}
                                </td>
                                <td style={{ textAlign: 'right' }}>Total Amount</td>
                                <td className="amount-col">{currentBillingData.totalAmount}</td>
                            </tr>
                            <tr>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Advance Paid</td>
                                <td className="amount-col">{currentBillingData.advancePayment}</td>
                            </tr>
                            <tr>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Discount</td>
                                <td className="amount-col">{currentBillingData.discount}</td>
                            </tr>
                            <tr>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Tax (%)</td>
                                <td className="amount-col">{currentBillingData.tax}%</td>
                            </tr>
                            <tr style={{ fontWeight: 'bold', fontSize: '15px' }}>
                                <td colSpan="3" style={{ border: 'none', borderRight: '1px solid black', textAlign: 'center' }}>
                                    Thank you for your business!
                                </td>
                                <td style={{ textAlign: 'right' }}>Balance Due</td>
                                <td className="amount-col" style={{ backgroundColor: '#ccc', color: '#000' }}>
                                    {Math.max(0, Math.round(
                                        (currentBillingData.totalAmount - currentBillingData.discount)
                                        * (1 + (currentBillingData.tax / 100))
                                        - currentBillingData.advancePayment
                                    ))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            <div className="page-header">
                <h1>Orders</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <HiOutlinePlus /> New Order
                </button>
            </div>

            {slaWarning && (
                <div className="alert alert-warning slide-up" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HiOutlineExclamationCircle size={24} />
                    <strong>{slaWarning}</strong>
                </div>
            )}
            {success && <div className="alert alert-success">{success}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            <div className="orders-filters">
                {statuses.map((s) => (
                    <button key={s} className={`filter-btn ${filter === s ? 'filter-btn--active' : ''} ${s === 'deadline' && tabCounts.deadline > 0 ? 'filter-btn--deadline' : ''}`}
                        onClick={() => { setFilter(s); setLoading(true); }}>
                        {s === 'active' ? 'Active Orders' : s === 'history' ? 'Order History' : s === 'overdue' ? 'Overdue' : s === 'deadline' ? '⏰ Approaching Deadline' : STATUS_LABELS[s]}

                        {/* Per-tab count badge */}
                        {tabCounts[s] > 0 && (
                            <span className={`tab-count ${s === 'deadline' ? 'tab-count--deadline' : s === 'overdue' ? 'tab-count--overdue' : ''}`}>
                                {tabCounts[s]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ===== SEARCH BAR ===== */}
            <div className="orders-search-bar">
                <span className="orders-search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search by order ID, customer name, phone or email..."
                    className="orders-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="orders-search-clear" onClick={() => setSearchQuery('')} title="Clear search">✕</button>
                )}
                {searchQuery && (
                    <span className="orders-search-count">
                        {filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            <div className="table-container glass-card">
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Images</th>
                            <th>Est. Completion</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    {searchQuery ? `No orders match "${searchQuery}"` : 'No orders found for this view'}
                                </td>
                            </tr>
                        ) : (
                            paginatedOrders.map((order) => (
                                <tr key={order._id}>
                                    <td>
                                        <strong
                                            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline' }}
                                            onClick={() => handleQuickPrint(order)}
                                            title="Click to Download/Print Invoice"
                                        >
                                            {order.orderId}
                                        </strong>
                                    </td>
                                    <td>
                                        <div>{order.customer?.name}</div>
                                        <small style={{ color: 'var(--text-muted)' }}>{order.customer?.phone}</small>
                                    </td>
                                    <td>{order.categories?.map(c => c.name).join(', ')}</td>
                                    <td><StatusBadge status={order.status} /></td>
                                    <td>
                                        <span className="image-count">{order.images?.length || 0} 📷</span>
                                    </td>
                                    <td style={{ minWidth: '150px' }}>
                                        {order.status === 'completed' || order.status === 'delivered' ? (
                                            order.wasOverdue ? (
                                                <span style={{ color: 'var(--status-critical)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    ⚠️ Completed Late
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--status-completed)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    ✅ On Time
                                                </span>
                                            )
                                        ) : order.estimatedCompletion ? (
                                            <SlaProgressBar createdAt={order.createdAt} estimatedCompletion={order.estimatedCompletion} status={order.status} />
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            {order.status !== 'completed' && (
                                                <button className="btn btn-sm btn-success"
                                                    disabled={advancingStatus === order._id}
                                                    onClick={() => setShowStatusModal(order)}
                                                    title="Change Status">
                                                    <HiOutlineArrowRight />
                                                </button>
                                            )}
                                            <button className="btn btn-sm btn-secondary"
                                                onClick={() => {
                                                    setBillingData({
                                                        totalAmount: order.totalAmount || 0,
                                                        advancePayment: order.advancePayment || 0,
                                                        discount: order.discount || 0,
                                                        tax: order.tax || 0
                                                    });
                                                    setShowBillingModal(order);
                                                }}
                                                title="Billing & Invoice">
                                                <HiOutlineCurrencyRupee />
                                            </button>
                                            <button className="btn btn-sm btn-secondary"
                                                onClick={() => setShowUploadModal(order)}
                                                title="Upload Images">
                                                <HiOutlinePhotograph />
                                            </button>
                                            <button className="btn btn-sm btn-secondary"
                                                onClick={() => setShowDetailModal(order)}
                                                title="View Details">
                                                <HiOutlineEye />
                                            </button>
                                            <button className="btn btn-sm btn-secondary"
                                                onClick={() => handleCopyShareLink(order.orderId)}
                                                title="Copy Album Link">
                                                <HiOutlineShare />
                                            </button>
                                            <button className="btn btn-sm btn-danger"
                                                onClick={() => handleDeleteOrder(order._id, order.orderId)}
                                                title="Delete Order">
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
            />
            {showModal && (

                <div className="modal-overlay" onClick={() => !submitting && setShowModal(false)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Order</h2>
                            <button className="modal-close" onClick={() => !submitting && setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreateOrder}>
                                <div className="form-group">
                                    <label>Customer Name *</label>
                                    <input type="text" className="form-control" required
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Customer Email *</label>
                                    <input type="email" className="form-control" required
                                        value={formData.customerEmail}
                                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Customer Phone *</label>
                                    <input type="tel" className="form-control" required pattern="[0-9]{10}" title="Please enter a valid 10-digit phone number"
                                        value={formData.customerPhone}
                                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Services / Categories *</label>
                                    <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                                        {categories.map((cat) => (
                                            <label key={cat._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    value={cat._id}
                                                    checked={formData.categoryIds.includes(cat._id)}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            categoryIds: checked
                                                                ? [...prev.categoryIds, cat._id]
                                                                : prev.categoryIds.filter(id => id !== cat._id)
                                                        }));
                                                    }}
                                                />
                                                {cat.name} <small style={{ color: 'var(--text-muted)' }}>(SLA: {cat.slaHours}h)</small>
                                            </label>
                                        ))}
                                    </div>
                                    {formData.categoryIds.length === 0 && (
                                        <small style={{ color: 'var(--status-critical)' }}>Please select at least one service.</small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Total Amount (₹)</label>
                                    <input type="number" className="form-control"
                                        value={formData.totalAmount}
                                        onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} />
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? '⏳ Creating...' : 'Create Order'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== STATUS CHANGE MODAL ===== */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>Change Status — {showStatusModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowStatusModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                                Current: <StatusBadge status={showStatusModal.status} />
                            </p>
                            <div className="status-options">
                                {ALL_STATUSES.map((s, i) => {
                                    const currentIdx = ALL_STATUSES.indexOf(showStatusModal.status);
                                    const isCurrent = i === currentIdx;
                                    const isPast = i < currentIdx;
                                    return (
                                        <button key={s}
                                            className={`status-option ${isCurrent ? 'next' : ''} ${isPast ? 'past' : ''}`}
                                            disabled={isPast || advancingStatus}
                                            onClick={() => {
                                                if (isCurrent) {
                                                    const nextStatus = ALL_STATUSES[currentIdx + 1];
                                                    if (nextStatus) handleAdvanceStatus(showStatusModal, nextStatus);
                                                } else {
                                                    handleAdvanceStatus(showStatusModal, s);
                                                }
                                            }}>
                                            <span className="status-option__num">{i + 1}</span>
                                            <span>{STATUS_LABELS[s]}</span>
                                            {isCurrent && <span className="status-option__tag">Next →</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== IMAGE UPLOAD MODAL ===== */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h2>Upload Images — {showUploadModal.orderId}</h2>
                            <button className="modal-close" onClick={() => !uploading && setShowUploadModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.85rem' }}>
                                Customer: {showUploadModal.customer?.name} | Current images: {showUploadModal.images?.length || 0}
                            </p>

                            {/* Existing Images */}
                            {showUploadModal.images?.length > 0 && (
                                <div className="image-gallery">
                                    {showUploadModal.images.map((img) => (
                                        <div key={img._id} className="gallery-thumb">
                                            <img src={`https://photostudio.nakshatratechnologies.in${img.url}`} alt={img.originalName} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="upload-area">
                                <input type="file" multiple accept="image/*" ref={fileInputRef}
                                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))} />
                                {selectedFiles.length > 0 && (
                                    <p style={{ color: 'var(--accent)', fontSize: '0.85rem', marginTop: '8px' }}>
                                        {selectedFiles.length} file(s) selected
                                    </p>
                                )}
                            </div>

                            {/* Share link */}
                            <div className="share-section">
                                <button className="btn btn-secondary btn-sm" onClick={() => handleCopyShareLink(showUploadModal.orderId)}>
                                    <HiOutlineClipboardCopy /> Copy Album Link for Customer
                                </button>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(null)} disabled={uploading}>Close</button>
                                <button className="btn btn-primary" disabled={uploading || selectedFiles.length === 0}
                                    onClick={() => handleUploadImages(showUploadModal._id)}>
                                    {uploading ? '⏳ Uploading...' : `Upload ${selectedFiles.length} Image(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ORDER DETAIL MODAL ===== */}
            {showDetailModal && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h2>Order Details — {showDetailModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowDetailModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div><strong>Customer:</strong> {showDetailModal.customer?.name}</div>
                                <div><strong>Email:</strong> {showDetailModal.customer?.email}</div>
                                <div><strong>Phone:</strong> {showDetailModal.customer?.phone || '—'}</div>
                                <div><strong>Categories:</strong> {showDetailModal.categories?.map(c => c.name).join(', ')}</div>
                                <div><strong>Max SLA:</strong> {showDetailModal.categories?.reduce((max, c) => c.slaHours > max ? c.slaHours : max, 0)}h</div>
                                <div><strong>Amount:</strong> ₹{showDetailModal.totalAmount || 0}</div>
                                <div><strong>Status:</strong> <StatusBadge status={showDetailModal.status} /></div>
                                <div><strong>Created:</strong> {new Date(showDetailModal.createdAt).toLocaleString('en-IN')}</div>
                                <div><strong>Est. Completion:</strong> {showDetailModal.estimatedCompletion ? new Date(showDetailModal.estimatedCompletion).toLocaleString('en-IN') : '—'}</div>
                                <div><strong>Images:</strong> {showDetailModal.images?.length || 0}</div>
                            </div>

                            {showDetailModal.notes && (
                                <div style={{ marginTop: '12px' }}>
                                    <strong>Notes:</strong>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{showDetailModal.notes}</p>
                                </div>
                            )}

                            {/* Process Timestamps */}
                            <div style={{ marginTop: '20px' }}>
                                <strong style={{ display: 'block', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                                    Process Timestamps
                                </strong>
                                <ul className="timestamp-list">
                                    {showDetailModal.statusHistory?.map((history, idx) => (
                                        <li key={idx} className="timestamp-item">
                                            <div className="timestamp-dot"></div>
                                            <div className="timestamp-content">
                                                <span className="timestamp-status">{STATUS_LABELS[history.status] || history.status}</span>
                                                <span className="timestamp-date">{new Date(history.changedAt).toLocaleString('en-IN')}</span>
                                                {history.changedBy?.name && (
                                                    <span className="timestamp-by">by {history.changedBy.name}</span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Images preview */}
                            {showDetailModal.images?.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <strong>Photos:</strong>
                                    <div className="image-gallery" style={{ marginTop: '8px' }}>
                                        {showDetailModal.images.map((img) => (
                                            <div key={img._id} className="gallery-thumb">
                                                <img src={`https://photostudio.nakshatratechnologies.in${img.url}`} alt={img.originalName} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => handleCopyShareLink(showDetailModal.orderId)}>
                                    <HiOutlineShare /> Share Album
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowDetailModal(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BILLING MODAL ===== */}
            {showBillingModal && (
                <div className="modal-overlay" onClick={() => !submitting && setShowBillingModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>Billing & Invoice — {showBillingModal.orderId}</h2>
                            <button className="modal-close" onClick={() => !submitting && setShowBillingModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleUpdateBilling}>
                                <div className="form-group">
                                    <label>Total Amount (₹)</label>
                                    <input type="number" min="0" className="form-control" required
                                        value={billingData.totalAmount}
                                        onChange={(e) => setBillingData({ ...billingData, totalAmount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Advance Payment (₹)</label>
                                    <input type="number" min="0" className="form-control"
                                        value={billingData.advancePayment}
                                        onChange={(e) => setBillingData({ ...billingData, advancePayment: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Discount (₹)</label>
                                    <input type="number" min="0" className="form-control"
                                        value={billingData.discount}
                                        onChange={(e) => setBillingData({ ...billingData, discount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Tax (%)</label>
                                    <input type="number" min="0" max="100" className="form-control"
                                        value={billingData.tax}
                                        onChange={(e) => setBillingData({ ...billingData, tax: Number(e.target.value) })}
                                    />
                                    <small style={{ color: 'var(--text-muted)' }}>Tax applied after discount</small>
                                </div>

                                <div className="balance-calc" style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Subtotal:</span>
                                        <span>₹{billingData.totalAmount - billingData.discount}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Tax ({billingData.tax}%):</span>
                                        <span>+ ₹{Math.round((billingData.totalAmount - billingData.discount) * (billingData.tax / 100))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Advance Paid:</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span>Balance Due:</span>
                                        <span style={{ color: (billingData.totalAmount - billingData.advancePayment - billingData.discount) > 0 ? 'var(--status-printing)' : 'var(--status-completed)' }}>
                                            ₹{Math.max(0, billingData.totalAmount - billingData.advancePayment - billingData.discount)}
                                        </span>
                                    </div>
                                </div>

                                <div className="modal-footer" style={{ marginTop: '20px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowBillingModal(null)} disabled={submitting}>Cancel</button>
                                    <button type="button" className="btn btn-secondary" onClick={() => {
                                        window.print();
                                    }}>
                                        <HiOutlinePrinter /> Print Invoice
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? '⏳ Saving...' : 'Save Billing Details'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
