import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineArrowLeft, HiOutlineUser, HiOutlinePhone, HiOutlineMail, HiOutlineClipboardList, HiOutlineCurrencyRupee, HiOutlineChatAlt2, HiOutlineSparkles, HiOutlineClock, HiOutlineArrowRight, HiOutlinePhotograph, HiOutlineTrash, HiOutlineShare, HiOutlineEye, HiOutlineBan, HiOutlinePrinter } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import API from '../../api/axios';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './NewOrderPage.css';
import '../studio/OrdersPage.css';

// SLA Progress Bar (same as OrdersPage)
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

const ALL_STATUSES = ['reception', 'designing', 'printing', 'binding', 'quality_check', 'delivered'];
const STATUS_LABELS = {
    reception: 'Reception', designing: 'Designing', printing: 'Printing',
    binding: 'Binding', quality_check: 'Quality Check', delivered: 'Delivered',
    cancelled: 'Cancelled'
};

const NewOrderPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [error, setError] = useState('');
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
    const [recentOrders, setRecentOrders] = useState([]);
    const [advancingStatus, setAdvancingStatus] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(null);
    const [showBillingModal, setShowBillingModal] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(null);
    const [showOrderPreview, setShowOrderPreview] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [billingData, setBillingData] = useState({ totalAmount: 0, advancePayment: 0, discount: 0, tax: 0 });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef2 = useRef(null);
    const listRef = useRef(null);
    const searchInputRef = useRef(null);
    const dropdownWrapperRef = useRef(null);

    // Filtered categories (memoized)
    const filteredCategories = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return categories;
        return categories.filter(cat =>
            String(cat.Description || cat.description || '').toLowerCase().includes(term) ||
            String(cat.name || '').toLowerCase().includes(term)
        );
    }, [categories, searchTerm]);

    // Reset highlight when search or dropdown changes
    useEffect(() => {
        setHighlightIndex(0);
    }, [searchTerm, showCategoryDropdown]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                showCategoryDropdown &&
                dropdownWrapperRef.current &&
                !dropdownWrapperRef.current.contains(e.target)
            ) {
                setShowCategoryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCategoryDropdown]);

    // Toggle a category selection
    const toggleCategory = useCallback((catId) => {
        setFormData(prev => ({
            ...prev,
            categoryIds: prev.categoryIds.includes(catId)
                ? prev.categoryIds.filter(id => id !== catId)
                : [...prev.categoryIds, catId]
        }));
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, []);

    // Keyboard handler
    const handleSearchKeyDown = (e) => {
        if (!showCategoryDropdown) return;
        const len = filteredCategories.length;
        if (len === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => {
                const next = prev < len - 1 ? prev + 1 : 0;
                scrollToItem(next);
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => {
                const next = prev > 0 ? prev - 1 : len - 1;
                scrollToItem(next);
                return next;
            });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCategories[highlightIndex]) {
                toggleCategory(filteredCategories[highlightIndex]._id);
            }
        } else if (e.key === 'Escape') {
            setShowCategoryDropdown(false);
        }
    };

    const scrollToItem = (index) => {
        if (listRef.current) {
            const items = listRef.current.querySelectorAll('.dropdown-item');
            if (items[index]) {
                items[index].scrollIntoView({ block: 'nearest' });
            }
        }
    };

    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        coupleName: '',
        categoryIds: [],
        notes: '',
        totalAmount: '',
        isParty: false
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, ordRes] = await Promise.all([
                    API.get(`/categories?t=${Date.now()}`),
                    API.get('/orders?limit=10')
                ]);
                if (catRes.data?.categories) {
                    setCategories(catRes.data.categories);
                }
                if (ordRes.data?.orders) {
                    setRecentOrders(ordRes.data.orders);
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Customer Lookup Logic
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

    // Price Calculation Helper
    const getPriceForCategory = useCallback((cat) => {
        if (!cat) return 0;
        if (formData.isParty) {
            const customPriceObj = selectedCustomer?.partyPrices?.find(p => (p.category?._id || p.category) === cat._id);
            const customPrice = customPriceObj ? customPriceObj.price : 0;
            if (customPrice > 0) return customPrice;
            if (cat.partyPrice > 0) return cat.partyPrice;
            return (cat.basePrice || 0);
        } else {
            return (cat.basePrice || 0);
        }
    }, [formData.isParty, selectedCustomer]);

    // Auto-calculate total amount
    useEffect(() => {
        let total = 0;
        formData.categoryIds.forEach(id => {
            const cat = categories.find(c => c._id === id);
            if (cat) {
                total += getPriceForCategory(cat);
            }
        });
        setFormData(prev => ({ ...prev, totalAmount: total }));
    }, [formData.categoryIds, getPriceForCategory, categories]);

    // Refetch recent orders
    const fetchRecentOrders = async () => {
        try {
            const ordRes = await API.get('/orders?limit=10');
            if (ordRes.data?.orders) setRecentOrders(ordRes.data.orders);
        } catch (err) {
            console.error('Failed to fetch recent orders', err);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (submitting) return;
        if (formData.categoryIds.length === 0) {
            setError('Please select at least one service.');
            return;
        }
        setError('');
        setShowOrderPreview(true);
    };

    const handleConfirmSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                ...formData,
                customerPhone: formData.customerPhone || '0000000000',
            };
            
            await API.post('/orders', payload);
            
            showSuccess('New Order created successfully!');
            setShowOrderPreview(false);
            
            // Reset form
            setFormData({
                customerName: '', customerEmail: '', customerPhone: '', 
                coupleName: '', categoryIds: [], notes: '', 
                totalAmount: '', isParty: false
            });
            setSelectedCustomer(null);
            fetchRecentOrders();
            setTimeout(() => navigate('/orders'), 1500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create order');
            setSubmitting(false);
        }
    };

    // ===== ACTION HANDLERS (same as OrdersPage) =====
    const getBalanceDue = (o) => {
        const total = o.totalAmount || 0;
        const discount = o.discount || 0;
        const tax = o.tax || 0;
        const taxType = o.taxType || 'exclusive';
        const advance = o.advancePayment || 0;
        const taxableAmount = Math.max(0, total - discount);
        let finalTotal = taxableAmount;
        if (taxType !== 'inclusive') finalTotal += (taxableAmount * tax / 100);
        return Math.max(0, Math.round(finalTotal - advance));
    };

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
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update status');
            setTimeout(() => setError(''), 5000);
        } finally {
            setAdvancingStatus(null);
        }
    };

    const handleDirectAdvance = async (order) => {
        setConfirmDialog({
            open: true, title: 'Complete Step?', message: 'Mark this step as complete? Order will move to the next status.', variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setAdvancingStatus(order._id);
                try {
                    await API.put(`/orders/${order._id}/status`, { note: 'Step completed' });
                    fetchRecentOrders();
                    showSuccess('Step completed');
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to update status');
                } finally {
                    setAdvancingStatus(null);
                }
            }
        });
    };

    const handleShareWhatsApp = (order) => {
        const trackingLink = `${window.location.origin}/track`;
        const albumLink = `${window.location.origin}/album/${order.orderId}`;
        const message = `Hello ${order.customer?.name || ''},\n\nYour Order ID is: *${order.orderId}*\n\nYou can track your order status here: ${trackingLink}\nView your album here: ${albumLink}`;
        let phone = order.customer?.phone ? order.customer.phone.replace(/\D/g, '') : '';
        if (phone.length === 10) phone = `91${phone}`;
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDeleteOrder = async (orderId, orderNum) => {
        setConfirmDialog({
            open: true, title: 'Delete Order?', message: `Are you sure you want to delete order ${orderNum}? This cannot be undone.`, variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                try {
                    await API.delete(`/orders/${orderId}`);
                    showSuccess(`Order ${orderNum} deleted`);
                    fetchRecentOrders();
                } catch (err) {
                    showError(err.response?.data?.message || 'Failed to delete order');
                }
            }
        });
    };

    const handleCancelOrder = async () => {
        if (submitting || !showCancelModal) return;
        setSubmitting(true);
        setError('');
        try {
            await API.put(`/orders/${showCancelModal._id}/cancel`, { reason: cancelReason });
            showSuccess(`Order ${showCancelModal.orderId} has been cancelled`);
            setShowCancelModal(null);
            setCancelReason('');
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel order');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

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
            if (fileInputRef2.current) fileInputRef2.current.value = '';
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload images');
            setTimeout(() => setError(''), 5000);
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateBilling = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            await API.put(`/orders/${showBillingModal._id}/billing`, billingData);
            showSuccess(`Billing info updated for Order ${showBillingModal.orderId}`);
            setShowBillingModal(null);
            fetchRecentOrders();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update billing');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner text="Preparing new order..." />;

    return (
        <div className="new-order-page">
            <header className="new-order-header">
                <button className="back-btn" onClick={() => navigate('/orders')}>
                    <HiOutlineArrowLeft /> Back to Orders
                </button>
                <div className="header-title">
                    <HiOutlineSparkles className="sparkle-icon" />
                    <h1>Create New Order</h1>
                </div>
            </header>

            <motion.div 
                className="new-order-container"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <form className="new-order-form glass-card" onSubmit={handleSubmit}>
                    <div className="form-main-grid">
                        {/* Section 1: Customer Details */}
                        <div className="form-section">
                            <h3 className="section-title"><HiOutlineUser /> Customer Info</h3>
                            
                             <div className="form-group floating">
                                <HiOutlinePhone className="input-icon" />
                                <input 
                                    type="tel" 
                                    required 
                                    pattern="[0-9]{10}"
                                    placeholder=" "
                                    value={formData.customerPhone}
                                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                                />
                                <label>Phone Number *</label>
                            </div>

                            <AnimatePresence>
                                {selectedCustomer && (
                                    <motion.div 
                                        className="customer-badge"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        Found {selectedCustomer.isParty ? 'Party' : 'Customer'}: <strong>{selectedCustomer.name}</strong>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="form-row">
                                <div className="form-group floating">
                                    <HiOutlineUser className="input-icon" />
                                    <input 
                                        type="text" 
                                        required
                                        placeholder=" "
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                                    />
                                    <label>Customer Name *</label>
                                </div>
                                <div className="form-group floating">
                                    <HiOutlineUser className="input-icon" style={{ opacity: 0.5 }} />
                                    <input 
                                        type="text" 
                                        placeholder=" "
                                        value={formData.coupleName}
                                        onChange={(e) => setFormData({...formData, coupleName: e.target.value})}
                                    />
                                    <label>Couple Name</label>
                                </div>
                            </div>

                            <div className="form-group floating">
                                <HiOutlineMail className="input-icon" />
                                <input 
                                    type="email" 
                                    placeholder=" "
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                                />
                                <label>Email Address</label>
                            </div>
                        </div>

                        {/* Section 2: Order Details */}
                        <div className="form-section">
                            <h3 className="section-title"><HiOutlineClipboardList /> Service Details</h3>

                            <div className="form-group multi-select-group" ref={dropdownWrapperRef}>
                                <label className="field-label">Select Services / Categories *</label>
                                <div className="services-selector-wrapper">
                                    <div className="services-selector" onClick={() => { setShowCategoryDropdown(true); searchInputRef.current?.focus(); }}>
                                        <div className="selected-tags">
                                            {formData.categoryIds.length > 0 ? (
                                                categories.filter(c => formData.categoryIds.includes(c._id)).map(c => (
                                                    <span key={c._id} className="service-tag">
                                                        {String(c.name)}
                                                        <button type="button" onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                categoryIds: prev.categoryIds.filter(id => id !== c._id)
                                                            }));
                                                        }}>×</button>
                                                    </span>
                                                ))
                                            ) : null}
                                            <input 
                                                ref={searchInputRef}
                                                type="text"
                                                className="service-search-input"
                                                placeholder={formData.categoryIds.length === 0 ? "Type to search (e.g. Photobook)..." : "Add more..."}
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    setShowCategoryDropdown(true);
                                                }}
                                                onFocus={() => setShowCategoryDropdown(true)}
                                                onKeyDown={handleSearchKeyDown}
                                            />
                                        </div>
                                        <span className={`dropdown-arrow ${showCategoryDropdown ? 'open' : ''}`}>▼</span>
                                    </div>
                                </div>
                                
                                <AnimatePresence>
                                    {showCategoryDropdown && (
                                        <motion.div 
                                            className="services-dropdown"
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <div className="services-dropdown-header">
                                                <span>Item Type</span>
                                                <span>Item Name</span>
                                                <span style={{ textAlign: 'right' }}>Price</span>
                                            </div>
                                            <div className="services-list-container" ref={listRef}>
                                                {filteredCategories.length > 0 ? filteredCategories.map((cat, idx) => (
                                                    <div 
                                                        key={cat._id} 
                                                        className={`dropdown-item row-layout ${idx === highlightIndex ? 'highlighted' : ''} ${formData.categoryIds.includes(cat._id) ? 'selected' : ''}`}
                                                        onClick={() => toggleCategory(cat._id)}
                                                        onMouseEnter={() => setHighlightIndex(idx)}
                                                    >
                                                        <div className="item-row">
                                                            <span className="col-group">{cat.Description || cat.description || 'General'}</span>
                                                            <span className="col-name">{String(cat.name)}</span>
                                                            <span className="col-price" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>₹{getPriceForCategory(cat)}</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="no-data-msg">No matching services found.</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Selected Services Summary */}
                            {formData.categoryIds.length > 0 && (
                                <div className="selected-services-summary bg-dark-glass p-3 mb-4 rounded">
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-muted)' }}>Selected Services Summary</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {formData.categoryIds.map(id => {
                                            const cat = categories.find(c => c._id === id);
                                            if (!cat) return null;
                                            return (
                                                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                                    <span>{cat.name}</span>
                                                    <strong>₹{getPriceForCategory(cat)}</strong>
                                                </div>
                                            );
                                        })}
                                        <hr style={{ borderColor: 'var(--border-color)', margin: '4px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                                            <strong>Subtotal:</strong>
                                            <strong style={{ color: 'var(--primary)' }}>₹{formData.totalAmount}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-group floating">
                                <HiOutlineCurrencyRupee className="input-icon" />
                                <input 
                                    type="number" 
                                    required
                                    placeholder=" "
                                    value={formData.totalAmount}
                                    onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                                />
                                <label>Final Total Amount (₹) *</label>
                            </div>

                            <div className="form-group floating" style={{ height: 'auto' }}>
                                <HiOutlineChatAlt2 className="input-icon" style={{ top: '24px' }} />
                                <textarea 
                                    rows="1"
                                    placeholder=" "
                                    value={formData.notes}
                                    style={{ resize: 'none', overflow: 'hidden', minHeight: '60px' }}
                                    onInput={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                        setFormData({...formData, notes: e.target.value});
                                    }}
                                ></textarea>
                                <label>Notes / Requirements</label>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        {error && <div className="form-error">{error}</div>}
                        <div className="button-group">
                            <button type="button" className="btn btn-outlined" onClick={() => navigate('/orders')}>Cancel</button>
                            <button type="button" className="btn btn-primary btn-glow" onClick={handleSubmit} disabled={submitting}>
                                Review Order
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>

            {/* Order Preview Modal */}
            {showOrderPreview && (
                <div className="modal-overlay" onClick={() => setShowOrderPreview(false)}>
                    <div className="modal slide-up" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Review Order Details</h2>
                            <button className="modal-close" onClick={() => setShowOrderPreview(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '15px' }}>Customer Information</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Name</div>
                                        <div style={{ fontWeight: '500' }}>{formData.customerName || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Phone</div>
                                        <div style={{ fontWeight: '500' }}>{formData.customerPhone || 'N/A'}</div>
                                    </div>
                                    {formData.coupleName && (
                                        <div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Couple Name</div>
                                            <div style={{ fontWeight: '500' }}>{formData.coupleName}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '15px' }}>Selected Services</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {formData.categoryIds.map(id => {
                                        const cat = categories.find(c => c._id === id);
                                        return cat ? (
                                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{cat.name}</span>
                                                <strong>₹{getPriceForCategory(cat)}</strong>
                                            </div>
                                        ) : null;
                                    })}
                                    <hr style={{ borderColor: 'var(--border-color)', margin: '15px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem' }}>
                                        <strong>Total Amount:</strong>
                                        <strong style={{ color: 'var(--primary)' }}>₹{formData.totalAmount}</strong>
                                    </div>
                                </div>
                            </div>

                            {formData.notes && (
                                <div className="preview-section" style={{ background: 'var(--bg-glass)', padding: '20px', borderRadius: '12px' }}>
                                    <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '10px' }}>Notes</h3>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{formData.notes}</p>
                                </div>
                            )}

                            {error && <div className="alert alert-error" style={{ marginTop: '15px' }}>{error}</div>}
                        </div>
                        <div className="modal-footer" style={{ padding: '20px' }}>
                            <button className="btn btn-outlined" onClick={() => setShowOrderPreview(false)} disabled={submitting}>
                                Edit Order
                            </button>
                            <button className="btn btn-primary btn-glow" onClick={handleConfirmSubmit} disabled={submitting}>
                                {submitting ? 'Creating...' : 'Confirm & Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Orders Table — Same as Orders Page */}
            {recentOrders.length > 0 && (
                <motion.div 
                    className="recent-orders-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    <h3 className="recent-orders-title"><HiOutlineClock /> Recent Orders</h3>
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
                                    <th>Due Amount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => (
                                    <tr key={order._id}>
                                        <td>
                                            <strong style={{ color: 'var(--primary)' }}>
                                                {order.orderId}
                                            </strong>
                                        </td>
                                        <td>
                                            <div>{order.customer?.name || order.party?.name || '-'}</div>
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
                                        <td style={{ fontWeight: 'bold', color: getBalanceDue(order) > 0 ? 'var(--status-critical)' : 'var(--status-delivered)' }}>
                                            ₹{getBalanceDue(order)}
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                    <button className="btn btn-sm btn-success"
                                                        disabled={advancingStatus === order._id}
                                                        onClick={() => {
                                                            if (user?.role === 'staff' && !user?.assignedSteps?.includes('reception')) {
                                                                handleDirectAdvance(order);
                                                            } else {
                                                                setShowStatusModal(order);
                                                            }
                                                        }}
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
                                                            tax: order.tax || 0,
                                                            taxType: order.taxType || 'exclusive'
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
                                                    onClick={() => handleShareWhatsApp(order)}
                                                    title="Share on WhatsApp">
                                                    <HiOutlineShare />
                                                </button>
                                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                    <button className="btn btn-sm btn-warning"
                                                        onClick={() => { setShowCancelModal(order); setCancelReason(''); }}
                                                        title="Cancel Order">
                                                        <HiOutlineBan />
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteOrder(order._id, order.orderId)}
                                                    title="Delete Order">
                                                    <HiOutlineTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* ===== STATUS CHANGE MODAL ===== */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Change Status — {showStatusModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowStatusModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="status-options">
                                {ALL_STATUSES.map((s, i) => {
                                    const currentIdx = ALL_STATUSES.indexOf(showStatusModal.status);
                                    const isNext = i === currentIdx + 1;
                                    const isCurrent = s === showStatusModal.status;
                                    const isPast = i < currentIdx;
                                    return (
                                        <button
                                            key={s}
                                            className={`status-option ${isNext ? 'next' : ''} ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                                            onClick={() => handleAdvanceStatus(showStatusModal, s)}
                                            disabled={advancingStatus || isCurrent || isPast}
                                        >
                                            <span className="status-option__num">{i + 1}</span>
                                            {STATUS_LABELS[s]}
                                            {isNext && <span className="status-option__tag">NEXT →</span>}
                                            {isCurrent && <span className="status-option__tag current-tag">CURRENT</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DETAIL MODAL ===== */}
            {showDetailModal && (
                <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Order Details — {showDetailModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowDetailModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div>Customer</div><div><strong>{showDetailModal.customer?.name || '-'}</strong></div>
                                <div>Phone</div><div><strong>{showDetailModal.customer?.phone || '-'}</strong></div>
                                <div>Email</div><div><strong>{showDetailModal.customer?.email || '-'}</strong></div>
                                <div>Couple Name</div><div><strong>{showDetailModal.coupleName || '-'}</strong></div>
                                <div>Category</div><div><strong>{showDetailModal.categories?.map(c => c.name).join(', ')}</strong></div>
                                <div>Status</div><div><StatusBadge status={showDetailModal.status} /></div>
                                <div>Total Amount</div><div><strong>₹{showDetailModal.totalAmount || 0}</strong></div>
                                <div>Advance Paid</div><div><strong>₹{showDetailModal.advancePayment || 0}</strong></div>
                                <div>Balance Due</div><div><strong style={{ color: 'var(--status-critical)' }}>₹{getBalanceDue(showDetailModal)}</strong></div>
                                <div>Notes</div><div><strong>{showDetailModal.notes || '-'}</strong></div>
                                <div>Created</div><div><strong>{new Date(showDetailModal.createdAt).toLocaleString('en-IN')}</strong></div>
                            </div>
                            {showDetailModal.images?.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '8px' }}>Images ({showDetailModal.images.length})</h4>
                                    <div className="image-gallery">
                                        {showDetailModal.images.map((img, i) => (
                                            <div key={i} className="gallery-thumb">
                                                <img src={`https://photostudio.nakshatratechnologies.in${img.url || img}`} alt="" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {showDetailModal.statusHistory?.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <h4 style={{ marginBottom: '8px' }}>Status History</h4>
                                    <ul className="timestamp-list">
                                        {showDetailModal.statusHistory.map((h, i) => (
                                            <li key={i} className="timestamp-item">
                                                <span className="timestamp-dot"></span>
                                                <div className="timestamp-content">
                                                    <span className="timestamp-status">{STATUS_LABELS[h.status] || h.status}</span>
                                                    <span className="timestamp-date">{new Date(h.changedAt).toLocaleString('en-IN')}</span>
                                                    {h.notes && <span className="timestamp-by">{h.notes}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== UPLOAD MODAL ===== */}
            {showUploadModal && (
                <div className="modal-overlay" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload Images — {showUploadModal.orderId}</h2>
                            <button className="modal-close" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>×</button>
                        </div>
                        <div className="modal-body">
                            {showUploadModal.images?.length > 0 && (
                                <div className="image-gallery">
                                    {showUploadModal.images.map((img, i) => (
                                        <div key={i} className="gallery-thumb">
                                            <img src={`https://photostudio.nakshatratechnologies.in${img.url || img}`} alt="" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="upload-area">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    ref={fileInputRef2}
                                    onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                                />
                            </div>
                            {selectedFiles.length > 0 && <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>{selectedFiles.length} file(s) selected</p>}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowUploadModal(null); setSelectedFiles([]); }}>Cancel</button>
                            <button className="btn btn-primary" disabled={uploading || selectedFiles.length === 0} onClick={() => handleUploadImages(showUploadModal._id)}>
                                {uploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BILLING MODAL ===== */}
            {showBillingModal && (
                <div className="modal-overlay" onClick={() => setShowBillingModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Billing — {showBillingModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowBillingModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleUpdateBilling}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Total Amount (₹)</label>
                                    <input className="form-control" type="number" value={billingData.totalAmount} onChange={(e) => setBillingData({ ...billingData, totalAmount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Advance Payment (₹)</label>
                                    <input className="form-control" type="number" value={billingData.advancePayment} onChange={(e) => setBillingData({ ...billingData, advancePayment: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Discount (₹)</label>
                                    <input className="form-control" type="number" value={billingData.discount} onChange={(e) => setBillingData({ ...billingData, discount: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label>Tax (%)</label>
                                    <input className="form-control" type="number" value={billingData.tax} onChange={(e) => setBillingData({ ...billingData, tax: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBillingModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Billing'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== CANCEL MODAL ===== */}
            {showCancelModal && (
                <div className="modal-overlay" onClick={() => setShowCancelModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Cancel Order — {showCancelModal.orderId}</h2>
                            <button className="modal-close" onClick={() => setShowCancelModal(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Reason for cancellation</label>
                                <textarea className="form-control" rows="3" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional cancellation reason..."></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCancelModal(null)}>Go Back</button>
                            <button className="btn btn-danger" onClick={handleCancelOrder} disabled={submitting}>{submitting ? 'Cancelling...' : 'Confirm Cancel'}</button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog
                isOpen={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText={confirmDialog.variant === 'danger' ? 'Delete' : 'Confirm'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

        </div>
    );
};

export default NewOrderPage;
