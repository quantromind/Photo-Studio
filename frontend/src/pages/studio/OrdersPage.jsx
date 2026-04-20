import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { HiOutlinePlus, HiOutlineArrowRight, HiOutlinePhotograph, HiOutlineTrash, HiOutlineShare, HiOutlineEye, HiOutlineClipboardCopy, HiOutlineExclamationCircle, HiOutlineCurrencyRupee, HiOutlinePrinter, HiOutlineBan } from 'react-icons/hi';
import './OrdersPage.css';
import { getFileUrl } from '../../utils/urlHelper';

const PAGE_SIZE = 10;

const ALL_STATUSES = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered'];
const STATUS_LABELS = {
    reception: 'Reception', designing: 'Designing', printing: 'Printing',
    binding: 'Binding', quality_check: 'Quality Check', delivered: 'Delivered',
    cancelled: 'Cancelled'
};

// Helper component for SLA Progress Bar
const SlaProgressBar = ({ createdAt, estimatedCompletion, status }) => {
    if (!estimatedCompletion || status === 'delivered') return null;

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
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const customerFilter = queryParams.get('customer');

    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [orders, setOrders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showBillingModal, setShowBillingModal] = useState(null);
    const [showFullPaidModal, setShowFullPaidModal] = useState(null);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [filter, setFilter] = useState(customerFilter ? '' : 'active');
    const [error, setError] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
    const [slaWarning, setSlaWarning] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [advancingStatus, setAdvancingStatus] = useState(null);
    const [tabCounts, setTabCounts] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [catSearchQuery, setCatSearchQuery] = useState('');
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [billingData, setBillingData] = useState({ totalAmount: 0, advancePayment: 0, discount: 0, tax: 0, billImages: [] });
    const [printInvoiceData, setPrintInvoiceData] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerPrices, setCustomerPrices] = useState({});
    const [formData, setFormData] = useState({
        customerName: '', customerEmail: '', customerPhone: '', coupleName: '',
        categoryIds: [], notes: '', totalAmount: '', isParty: false
    });

    useEffect(() => {
        fetchOrders();
        setSearchQuery(''); // Clear search when tab changes
        setCurrentPage(1);  // Reset pagination on tab change
    }, [filter, customerFilter]);

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
                cancelled: d.cancelledCount || 0,
                ...(d.statusCounts || {})
            });
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    };

    const fetchOrders = async () => {
        try {
            let url = `/orders?status=${filter}`;
            if (customerFilter) url += `&customer=${customerFilter}`;
            const res = await API.get(url);
            setOrders(res.data.orders);

            if (filter === 'active' || filter === '') {
                const now = Date.now();
                const twoHours = 2 * 60 * 60 * 1000;
                const expiringOrders = res.data.orders.filter(o => {
                    if (!o.estimatedCompletion || o.status === 'delivered') return false;
                    const timeLeft = new Date(o.estimatedCompletion).getTime() - now;
                    return timeLeft > 0 && timeLeft < twoHours;
                });

                const overdueOrders = res.data.orders.filter(o => {
                    if (!o.estimatedCompletion || o.status === 'delivered') return false;
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

    // Customer Lookup
    useEffect(() => {
        const lookupCustomer = async () => {
            if (formData.customerPhone?.length === 10) {
                try {
                    // Try party first
                    const partyRes = await API.get('/parties');
                    let p = partyRes.data.parties.find(party => party.phone === formData.customerPhone);
                    if (p) {
                        p.isParty = true;
                        setSelectedCustomer(p);
                        setFormData(prev => ({
                            ...prev,
                            customerName: p.name,
                            customerEmail: p.email || '',
                            isParty: true
                        }));
                        return;
                    }

                    // Try customer
                    const res = await API.get('/customer/list');
                    const c = res.data.customers.find(cust => cust.phone === formData.customerPhone);
                    if (c) {
                        c.isParty = false;
                        setSelectedCustomer(c);
                        setFormData(prev => ({
                            ...prev,
                            customerName: c.name,
                            customerEmail: c.email || '',
                            isParty: false
                        }));
                    } else {
                        setSelectedCustomer(null);
                        setFormData(prev => ({ ...prev, isParty: false }));
                    }
                } catch (err) {
                    console.error('Lookup failed', err);
                }
            } else {
                setSelectedCustomer(null);
            }
        };
        lookupCustomer();
    }, [formData.customerPhone]);

    // Auto-calculate total amount
    useEffect(() => {
        if (formData.categoryIds.length > 0) {
            let total = 0;
            const isParty = formData.isParty;
            formData.categoryIds.forEach(id => {
                const cat = categories.find(c => c._id === id);
                if (cat) {
                    if (isParty) {
                        // Priority: 1. Custom party price, 2. Default party price, 3. Base price
                        const customPriceObj = selectedCustomer?.partyPrices?.find(p => (p.category?._id || p.category) === id);
                        const customPrice = customPriceObj ? customPriceObj.price : 0;
                        
                        if (customPrice > 0) {
                            total += customPrice;
                        } else if (cat.partyPrice > 0) {
                            total += cat.partyPrice;
                        } else {
                            total += (cat.basePrice || 0);
                        }
                    } else {
                        total += (cat.basePrice || 0);
                    }
                }
            });
            setFormData(prev => ({ ...prev, totalAmount: total }));
        }
    }, [formData.categoryIds, formData.isParty, categories, selectedCustomer]);

    // ===== CREATE ORDER =====
    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            await API.post('/orders', formData);
            showSuccess('Order created successfully!');
            setShowModal(false);
            setFormData({ customerName: '', customerEmail: '', customerPhone: '', coupleName: '', categoryIds: [], notes: '', totalAmount: '', isParty: false });
            setSelectedCustomer(null);
            setCustomerPrices({});
            fetchOrders();
            setCatSearchQuery('');
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
        setError('');
        try {
            await API.put(`/orders/${showBillingModal._id}/billing`, billingData);
            showSuccess(`Billing info updated for Order ${showBillingModal.orderId}`);
            setShowBillingModal(null);
            fetchOrders();
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
        setError('');
        try {
            const body = targetStatus ? { targetStatus } : {};
            await API.put(`/orders/${order._id}/status`, body);
            const newStatus = targetStatus || ALL_STATUSES[ALL_STATUSES.indexOf(order.status) + 1];
            showSuccess(`Order ${order.orderId} moved to ${STATUS_LABELS[newStatus]}`);
            setShowStatusModal(null);
            fetchOrders();
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
            showSuccess(`${selectedFiles.length} image(s) uploaded successfully!`);
            setSelectedFiles([]);
            setShowUploadModal(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload images');
            setTimeout(() => setError(''), 5000);
        } finally {
            setUploading(false);
        }
    };

    // ===== DELETE IMAGE =====
    const handleDeleteImage = async (imageId, orderId) => {
        setConfirmDialog({
            open: true, title: 'Remove Image?', message: 'This image will be permanently deleted.', variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/images/${imageId}`);
                    showSuccess('Image removed successfully');
                    if (showUploadModal && showUploadModal._id === orderId) {
                        setShowUploadModal(prev => ({ ...prev, images: prev.images.filter(img => img._id !== imageId) }));
                    }
                    fetchOrders();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete image');
                }
            }
        });
    };

    // ===== DELETE ORDER =====
    const handleDeleteOrder = async (orderId, orderNum) => {
        setConfirmDialog({
            open: true, title: 'Delete Order?', message: `Are you sure you want to delete order ${orderNum}? This cannot be undone.`, variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/orders/${orderId}`);
                    showSuccess(`Order ${orderNum} deleted`);
                    fetchOrders();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete order');
                }
            }
        });
    };

    // ===== CANCEL ORDER =====
    const handleCancelOrder = async () => {
        if (submitting || !showCancelModal) return;
        setSubmitting(true);
        setError('');
        try {
            await API.put(`/orders/${showCancelModal._id}/cancel`, { reason: cancelReason });
            showSuccess(`Order ${showCancelModal.orderId} has been cancelled`);
            setShowCancelModal(null);
            setCancelReason('');
            fetchOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel order');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    // ===== COPY SHARE LINK =====
    const handleCopyShareLink = (orderId) => {
        const link = `${window.location.origin}/album/${orderId}`;
        navigator.clipboard.writeText(link).then(() => {
            showSuccess(`Album link copied!`);
        });
    };

    // ===== SHARE TO WHATSAPP =====
    const handleShareWhatsApp = (order) => {
        const trackingLink = `${window.location.origin}/track`;
        const albumLink = `${window.location.origin}/album/${order.orderId}`;
        const message = `Hello ${order.customer?.name || ''},\n\nYour Order ID is: *${order.orderId}*\n\nYou can track your order status here: ${trackingLink}\nView your album here: ${albumLink}`;

        let phone = order.customer?.phone ? order.customer.phone.replace(/\D/g, '') : '';
        if (phone.length === 10) phone = `91${phone}`;

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // ===== DIRECT STATUS ADVANCE (STAFF ONLY) =====
    const handleDirectAdvance = async (order) => {
        setConfirmDialog({
            open: true, title: 'Complete Step?', message: 'Mark this step as complete? Order will move to the next status.', variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setAdvancingStatus(order._id);
                try {
                    await API.put(`/orders/${order._id}/status`, { note: 'Step completed' });
                    fetchOrders();
                    showSuccess('Step completed');
                } catch (err) {
                    console.error(err);
                    showError(err.response?.data?.message || 'Failed to update status');
                } finally {
                    setAdvancingStatus(null);
                }
            }
        });
    };

    // ===== MARK AS FULL PAID (Quick Action) =====
    const handleMarkAsPaid = (order) => {
        const balance = getBalanceDue(order);
        if (balance <= 0) return;
        setShowFullPaidModal(order);
    };

    const handleConfirmFullPaid = async () => {
        if (!showFullPaidModal || submitting) return;
        const order = showFullPaidModal;
        const balance = getBalanceDue(order);
        
        try {
            setSubmitting(true);
            const finalTotal = Math.round(order.taxType === 'inclusive'
                ? Math.max(0, order.totalAmount - order.discount)
                : Math.max(0, order.totalAmount - order.discount) * (1 + (order.tax || 0) / 100));
                
            await API.put(`/orders/${order._id}/billing`, { 
                advancePayment: finalTotal 
            });
            
            showSuccess(`Order ${order.orderId} marked as fully paid`);
            setShowFullPaidModal(null);
            fetchOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update payment');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    const getBalanceDue = (o) => {
        const total = o.totalAmount || 0;
        const discount = o.discount || 0;
        const tax = o.tax || 0;
        const taxType = o.taxType || 'exclusive';
        const advance = o.advancePayment || 0;
        
        const taxableAmount = Math.max(0, total - discount);
        let finalTotal = taxableAmount;
        if (taxType !== 'inclusive') {
             finalTotal += (taxableAmount * tax / 100);
        }
        return Math.max(0, Math.round(finalTotal - advance));
    };

    // Define which tabs are visible based on role
    const statuses = user?.role === 'staff' && !user?.assignedSteps?.includes('reception')
        ? ['active', 'overdue', 'history', ...(user?.assignedSteps || [])]
        : ['active', 'deadline', 'overdue', 'history', 'cancelled', ...ALL_STATUSES];

    // ===== QUICK PRINT INVOICE =====
    const handleQuickPrint = (order) => {
        setPrintInvoiceData({
            order,
            billing: {
                totalAmount: order.totalAmount || 0,
                advancePayment: order.advancePayment || 0,
                discount: order.discount || 0,
                tax: order.tax || 0,
                taxType: order.taxType || 'exclusive',
                billImages: order.billImages?.map(img => img._id || img) || []
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

    // Resolve bill images to full objects for rendering
    const selectedBillImages = (invoiceOrder?.images || []).filter(img => 
        (currentBillingData.billImages || []).some(bi => (bi._id || bi) === img._id)
    );

    return (
        <div className="orders-page fade-in">
            {/* ===== PRINT ONLY INVOICE (PORTAL) ===== */}
            {invoiceOrder && invoiceOrder.studio && createPortal(
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
                                    <img src={getFileUrl(invoiceOrder.studio.logo)} alt="Logo" />
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
                        <strong>PARTY'S NAME:</strong> {invoiceOrder.customer?.name} {invoiceOrder.coupleName && `(${invoiceOrder.coupleName})`} <br />
                        {invoiceOrder.customer?.phone && <>Phone: {invoiceOrder.customer.phone} <br /></>}
                        {invoiceOrder.customer?.email && <>Email: {invoiceOrder.customer.email} <br /></>}
                        <br />
                    </div>

                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Particulars (Descriptions & Specifications)</th>
                                <th className="hsn-col">HSN / SAC Code</th>
                                <th className="qty-col">Qty</th>
                                <th className="rate-col">Rate (₹)</th>
                                <th className="amount-col">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(invoiceOrder.categories || []).map((cat, idx) => (
                                <tr key={idx} style={{ verticalAlign: 'top' }}>
                                    <td>
                                        <strong>{cat.name}</strong>
                                        {idx === 0 && currentBillingData.notes && (
                                            <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>
                                                {currentBillingData.notes}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{cat.hsnCode || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>1</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {invoiceOrder.isParty ? (cat.partyPrice || 0) : (cat.basePrice || 0) || (idx === 0 ? currentBillingData.totalAmount : 0)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {invoiceOrder.isParty ? (cat.partyPrice || 0) : (cat.basePrice || 0) || (idx === 0 ? currentBillingData.totalAmount : 0)}
                                    </td>
                                </tr>
                            ))}
                            {/* Fill empty space if few items */}
                            {(invoiceOrder.categories?.length || 0) < 3 && (
                                <tr style={{ height: '60px' }}>
                                    <td colSpan="5"></td>
                                </tr>
                            )}
                            <tr style={{ fontWeight: 'bold' }}>
                                <td colSpan="3" rowSpan={invoiceOrder.studio.bankDetails ? 6 : 5} style={{ border: 'none', borderRight: '1px solid black', verticalAlign: 'top' }}>
                                    {invoiceOrder.studio.bankDetails && (
                                        <div style={{ fontSize: '10px', marginTop: '10px' }}>
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
                            {currentBillingData.tax > 0 && (
                                <>
                                    <tr>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>CGST ({currentBillingData.tax / 2}%)</td>
                                        <td className="amount-col">
                                            {Math.round((currentBillingData.taxType === 'inclusive' 
                                                ? (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) - (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) / (1 + currentBillingData.tax / 100)))
                                                : (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) * (currentBillingData.tax / 100))) / 2)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>SGST ({currentBillingData.tax / 2}%)</td>
                                        <td className="amount-col">
                                            {Math.round((currentBillingData.taxType === 'inclusive' 
                                                ? (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) - (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) / (1 + currentBillingData.tax / 100)))
                                                : (Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) * (currentBillingData.tax / 100))) / 2)}
                                        </td>
                                    </tr>
                                </>
                            )}
                            {currentBillingData.tax === 0 && (
                                <tr>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Tax (0%)</td>
                                    <td className="amount-col">0</td>
                                </tr>
                            )}
                            <tr style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                <td style={{ textAlign: 'right' }}>Balance Due</td>
                                <td className="amount-col" style={{ backgroundColor: '#f9f9f9', color: '#000' }}>
                                    ₹{Math.max(0, Math.round(
                                        (currentBillingData.taxType === 'inclusive' 
                                            ? Math.max(0, currentBillingData.totalAmount - currentBillingData.discount)
                                            : Math.max(0, currentBillingData.totalAmount - currentBillingData.discount) * (1 + (currentBillingData.tax / 100))
                                        ) - currentBillingData.advancePayment
                                    ))}
                                </td>
                            </tr>
                            <tr style={{ border: 'none' }}>
                                <td colSpan="5" style={{ border: 'none', padding: '10px 0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ width: '65%' }}>
                                            {selectedBillImages.length > 0 && (
                                                <div className="invoice-bill-photos">
                                                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>EVENT PHOTOS:</div>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        {selectedBillImages.map((img, i) => (
                                                            <div key={i} style={{ width: '120px', height: '120px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <img src={getFileUrl(img.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ width: '30%', textAlign: 'center' }}>
                                            {invoiceOrder.studio.paymentQR && (
                                                <div className="invoice-qr-section">
                                                    <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>SCAN TO PAY:</div>
                                                    <div style={{ border: '1px solid #000', padding: '5px', borderRadius: '5px', display: 'inline-block' }}>
                                                        <img src={getFileUrl(invoiceOrder.studio.paymentQR)} alt="Payment QR" style={{ width: '100px', height: '100px' }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <tr style={{ border: 'none' }}>
                                <td colSpan="5" style={{ border: 'none', borderTop: '1px solid black', textAlign: 'center', padding: '15px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    ✨ Thank you for choosing {invoiceOrder.studio.name}! ✨
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>,
                document.body
            )}

            <div className="page-header">
                <h1>Orders</h1>
                {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && (
                    <button className="btn btn-primary" onClick={() => navigate('/orders/new')}>
                        <HiOutlinePlus /> New Order
                    </button>
                )}
            </div>

            {customerFilter && (
                <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <span>Showing orders for <strong>{orders[0]?.customer?.name || 'Customer'}</strong></span>
                    <button className="btn btn-sm btn-secondary" onClick={() => navigate('/orders')}>Clear Filter</button>
                </div>
            )}

            {slaWarning && (
                <div className="alert alert-warning slide-up" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HiOutlineExclamationCircle size={24} />
                    <strong>{slaWarning}</strong>
                </div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText={confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            <div className="orders-filters">
                {statuses.map((s) => (
                    <button key={s} className={`filter-btn ${filter === s ? 'filter-btn--active' : ''} ${s === 'deadline' && tabCounts.deadline > 0 ? 'filter-btn--deadline' : ''}`}
                        onClick={() => { setFilter(s); setLoading(true); }}>
                        {s === 'active' ? 'Active Orders' : s === 'history' ? 'Order History' : s === 'overdue' ? 'Overdue' : s === 'deadline' ? '⏰ Approaching Deadline' : s === 'cancelled' ? '🚫 Cancelled' : STATUS_LABELS[s]}

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
                            {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && (
                                <th>Due Amount</th>
                            )}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
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
                                        {order.status === 'cancelled' ? (
                                            <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                🚫 Cancelled
                                            </span>
                                        ) : order.status === 'delivered' ? (
                                            order.wasOverdue ? (
                                                <span style={{ color: 'var(--status-critical)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    ⚠️ Delivered Late
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--status-delivered)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                    ✅ On Time
                                                </span>
                                            )
                                        ) : order.estimatedCompletion ? (
                                            <SlaProgressBar createdAt={order.createdAt} estimatedCompletion={order.estimatedCompletion} status={order.status} />
                                        ) : '—'}
                                    </td>
                                    {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && (
                                        <td style={{ fontWeight: 'bold', color: getBalanceDue(order) > 0 ? 'var(--status-critical)' : 'var(--status-delivered)' }}>
                                            ₹{getBalanceDue(order)}
                                        </td>
                                    )}
                                    <td>
                                        <div className="action-btns">
                                            {order.status !== 'delivered' && order.status !== 'cancelled' && (user?.role !== 'staff' || user?.assignedSteps?.includes('reception') || user?.assignedSteps?.includes(order.status)) && (
                                                <button className="btn btn-sm btn-success"
                                                    disabled={advancingStatus === order._id}
                                                    onClick={() => {
                                                        if (user?.role === 'staff' && !user?.assignedSteps?.includes('reception')) {
                                                            handleDirectAdvance(order);
                                                        } else {
                                                            setShowStatusModal(order);
                                                        }
                                                    }}
                                                    title={user?.role === 'staff' && !user?.assignedSteps?.includes('reception') ? "Mark step as done" : "Change Status"}>
                                                    <HiOutlineArrowRight />
                                                </button>
                                            )}
                                            {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && (
                                                <button className="btn btn-sm btn-secondary"
                                                    onClick={() => {
                                                        setBillingData({
                                                            totalAmount: order.totalAmount || 0,
                                                            advancePayment: order.advancePayment || 0,
                                                            discount: order.discount || 0,
                                                            tax: order.tax || 0,
                                                            taxType: order.taxType || 'exclusive',
                                                            notes: order.notes || '',
                                                            billImages: order.billImages?.map(img => img._id || img) || []
                                                        });
                                                        setShowBillingModal(order);
                                                    }}
                                                    title="Billing & Invoice">
                                                    <HiOutlineCurrencyRupee />
                                                </button>
                                            )}
                                            {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && getBalanceDue(order) > 0 && (
                                                <button className="btn btn-sm btn-outline-success"
                                                    onClick={() => handleMarkAsPaid(order)}
                                                    style={{ color: 'var(--status-delivered)', borderColor: 'var(--status-delivered)' }}
                                                    title="Mark as Fully Paid">
                                                    <HiOutlineCurrencyRupee />
                                                </button>
                                            )}
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
                                                onClick={() => handleShareWhatsApp(order)}
                                                title="Share on WhatsApp">
                                                <HiOutlineShare />
                                            </button>
                                            {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                <button className="btn btn-sm btn-warning"
                                                    onClick={() => { setShowCancelModal(order); setCancelReason(''); }}
                                                    title="Cancel Order">
                                                    <HiOutlineBan />
                                                </button>
                                            )}
                                            {(user?.role !== 'staff' || user?.assignedSteps?.includes('reception')) && (
                                                <button className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteOrder(order._id, order.orderId)}
                                                    title="Delete Order">
                                                    <HiOutlineTrash />
                                                </button>
                                            )}
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
                                            <img src={getFileUrl(img.url)} alt={img.originalName} />
                                            <button 
                                                className="thumb-delete-btn" 
                                                title="Remove Image"
                                                onClick={() => handleDeleteImage(img._id, showUploadModal._id)}
                                            >
                                                ×
                                            </button>
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
                                <div><strong>Couple Name:</strong> {showDetailModal.coupleName || '—'}</div>
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
                                                <img src={getFileUrl(img.url)} alt={img.originalName} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => handleShareWhatsApp(showDetailModal)}>
                                    <HiOutlineShare /> Share on WhatsApp
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
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input type="number" min="0" className="form-control"
                                            value={billingData.advancePayment}
                                            onChange={(e) => setBillingData({ ...billingData, advancePayment: Number(e.target.value) })}
                                            style={{ flex: 1 }}
                                        />
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm"
                                            style={{ whiteSpace: 'nowrap', padding: '0 12px', background: 'var(--status-delivered)', color: 'white', border: 'none' }}
                                            onClick={() => {
                                                const finalTotal = Math.round(billingData.taxType === 'inclusive' 
                                                    ? Math.max(0, billingData.totalAmount - billingData.discount) 
                                                    : Math.max(0, billingData.totalAmount - billingData.discount) * (1 + billingData.tax / 100));
                                                setBillingData({ ...billingData, advancePayment: finalTotal });
                                            }}
                                            title="Set payment to full balance amount"
                                        >
                                            Full Paid
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Discount (₹)</label>
                                    <input type="number" min="0" className="form-control"
                                        value={billingData.discount}
                                        onChange={(e) => setBillingData({ ...billingData, discount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Invoice Description / Notes</label>
                                    <textarea className="form-control" rows="2"
                                        placeholder="Specific details to show on invoice..."
                                        value={billingData.notes}
                                        onChange={(e) => setBillingData({ ...billingData, notes: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label>Tax Type</label>
                                        <select className="form-control" 
                                            value={billingData.taxType || 'exclusive'}
                                            onChange={(e) => setBillingData({ ...billingData, taxType: e.target.value })}>
                                            <option value="exclusive">Exclusive</option>
                                            <option value="inclusive">Inclusive</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label>GST Tax (%)</label>
                                        <input type="number" min="0" max="100" className="form-control"
                                            value={billingData.tax}
                                            onChange={(e) => setBillingData({ ...billingData, tax: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="balance-calc" style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-card)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Subtotal (After Discount):</span>
                                        <span>₹{Math.max(0, billingData.totalAmount - billingData.discount)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Tax ({billingData.tax}% {billingData.taxType}):</span>
                                        <span>+ ₹{Math.round(billingData.taxType === 'inclusive' 
                                            ? Math.max(0, billingData.totalAmount - billingData.discount) - (Math.max(0, billingData.totalAmount - billingData.discount) / (1 + billingData.tax / 100))
                                            : Math.max(0, billingData.totalAmount - billingData.discount) * (billingData.tax / 100))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                                        <span>Final Invoice Amount:</span>
                                        <span>₹{Math.round(billingData.taxType === 'inclusive'
                                            ? Math.max(0, billingData.totalAmount - billingData.discount)
                                            : Math.max(0, billingData.totalAmount - billingData.discount) * (1 + billingData.tax / 100))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Advance Paid:</span>
                                        <span style={{color: 'var(--status-delivered)'}}>- ₹{billingData.advancePayment}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span>Balance Due:</span>
                                        <span style={{ color: (Math.round(billingData.taxType === 'inclusive' ? Math.max(0, billingData.totalAmount - billingData.discount) : Math.max(0, billingData.totalAmount - billingData.discount) * (1 + billingData.tax / 100)) - billingData.advancePayment) > 0 ? 'var(--status-printing)' : 'var(--status-completed)' }}>
                                            ₹{Math.max(0, Math.round(billingData.taxType === 'inclusive' 
                                            ? Math.max(0, billingData.totalAmount - billingData.discount) 
                                            : Math.max(0, billingData.totalAmount - billingData.discount) * (1 + billingData.tax / 100)) - billingData.advancePayment)}
                                        </span>
                                    </div>
                                </div>

                                {/* Select 3 Photos for Bill */}
                                <div className="bill-photo-selection" style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                                    <h4 style={{ marginBottom: '10px', fontSize: '1rem' }}>Select 3 Photos for Bill</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                        Selected: {billingData.billImages.length} / 3
                                    </p>
                                    <div className="bill-img-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                        {showBillingModal.images?.map((img) => {
                                            const isSelected = billingData.billImages.includes(img._id);
                                            return (
                                                <div key={img._id} 
                                                    className={`bill-img-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setBillingData({ ...billingData, billImages: billingData.billImages.filter(id => id !== img._id) });
                                                        } else if (billingData.billImages.length < 3) {
                                                            setBillingData({ ...billingData, billImages: [...billingData.billImages, img._id] });
                                                        } else {
                                                            alert('You can only select up to 3 photos.');
                                                        }
                                                    }}
                                                    style={{ 
                                                        position: 'relative', 
                                                        aspectRatio: '1', 
                                                        borderRadius: '4px', 
                                                        overflow: 'hidden', 
                                                        cursor: 'pointer',
                                                        border: isSelected ? '3px solid var(--primary)' : '1px solid var(--border)',
                                                        opacity: isSelected ? 1 : (billingData.billImages.length < 3 ? 1 : 0.5)
                                                    }}
                                                >
                                                    <img src={getFileUrl(img.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    {isSelected && (
                                                        <div style={{ position: 'absolute', top: '2px', right: '2px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {(!showBillingModal.images || showBillingModal.images.length === 0) && (
                                            <p style={{ gridColumn: 'span 4', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No photos uploaded yet.</p>
                                        )}
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

            {/* ===== CANCEL ORDER MODAL ===== */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => !submitting && setShowCancelModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header" style={{ borderBottom: '3px solid #ef4444' }}>
                            <h2 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HiOutlineBan /> Cancel Order — {showCancelModal.orderId}
                            </h2>
                            <button className="modal-close" onClick={() => !submitting && setShowCancelModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                                <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>⚠️ This action cannot be undone</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    Cancelling this order will remove it from active orders and revenue calculations. Customer: <strong>{showCancelModal.customer?.name}</strong>
                                </p>
                            </div>
                            <div className="form-group">
                                <label style={{ fontWeight: 600 }}>Reason for Cancellation</label>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    placeholder="e.g., Customer request, Payment issue, Duplicate order..."
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCancelModal(null)} disabled={submitting}>
                                    Go Back
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleCancelOrder}
                                    disabled={submitting}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <HiOutlineBan /> {submitting ? '⏳ Cancelling...' : 'Confirm Cancel Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== FULL PAYMENT CONFIRMATION MODAL ===== */}
            {showFullPaidModal && (
                <div className="modal-overlay" onClick={() => !submitting && setShowFullPaidModal(null)}>
                    <div className="modal slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header" style={{ borderBottom: '3px solid var(--status-delivered)' }}>
                            <h2 style={{ color: 'var(--status-delivered)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HiOutlineCurrencyRupee /> Full Payment Received?
                            </h2>
                            <button className="modal-close" onClick={() => !submitting && setShowFullPaidModal(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
                            <div className="payment-icon-large" style={{ 
                                fontSize: '3rem', 
                                color: 'var(--status-delivered)', 
                                marginBottom: '15px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <HiOutlineCurrencyRupee />
                            </div>
                            
                            <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Confirm Full Payment</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '25px', lineHeight: '1.5' }}>
                                Are you sure you want to mark Order <strong>{showFullPaidModal.orderId}</strong> as fully paid? <br />
                                The balance amount of <strong>₹{getBalanceDue(showFullPaidModal)}</strong> will be added.
                            </p>

                            <div className="modal-footer" style={{ justifyContent: 'center', gap: '15px', borderTop: 'none', padding: '0' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowFullPaidModal(null)} disabled={submitting} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={handleConfirmFullPaid}
                                    disabled={submitting}
                                    style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--status-delivered)' }}
                                >
                                    {submitting ? '⏳ Updating...' : 'Yes, Mark Paid'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
